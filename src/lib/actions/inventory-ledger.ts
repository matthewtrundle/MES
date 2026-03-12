'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { z } from 'zod';
import { uuid, nonNegativeNumber } from '@/lib/validation/schemas';

// ── Validation Schemas ────────────────────────────────────────────

const transactionTypeEnum = z.enum([
  'receive',
  'issue',
  'return',
  'scrap',
  'adjustment',
  'transfer',
]);

const referenceTypeEnum = z.enum([
  'work_order',
  'kit',
  'ncr',
  'manual',
]);

const recordTransactionSchema = z.object({
  materialLotId: uuid,
  transactionType: transactionTypeEnum,
  quantity: z.number(), // positive or negative
  referenceType: referenceTypeEnum.optional(),
  referenceId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

const transactionFilterSchema = z.object({
  materialLotId: uuid.optional(),
  materialCode: z.string().optional(),
  transactionType: transactionTypeEnum.optional(),
  referenceType: referenceTypeEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

export type TransactionType = z.infer<typeof transactionTypeEnum>;
export type ReferenceType = z.infer<typeof referenceTypeEnum>;

// ── Core Transaction Recording ────────────────────────────────────

/**
 * Record an inventory transaction to the append-only ledger.
 * This is the core function that all inventory operations should use.
 */
export async function recordTransaction(data: z.infer<typeof recordTransactionSchema>) {
  const validated = recordTransactionSchema.parse(data);
  const user = await requireRole(['admin', 'supervisor', 'operator']);

  const lot = await prisma.materialLot.findUnique({
    where: { id: validated.materialLotId },
  });

  if (!lot) {
    throw new Error('Material lot not found');
  }

  const previousQty = lot.qtyRemaining;
  const newQty = previousQty + validated.quantity;

  if (newQty < 0) {
    throw new Error(
      `Insufficient quantity. Available: ${previousQty}, requested change: ${validated.quantity}`
    );
  }

  // Update lot quantity and record transaction atomically
  const newStatus = newQty === 0 ? 'depleted' : lot.status;

  const [transaction] = await prisma.$transaction([
    prisma.inventoryTransaction.create({
      data: {
        materialLotId: validated.materialLotId,
        transactionType: validated.transactionType,
        quantity: validated.quantity,
        previousQty,
        newQty,
        referenceType: validated.referenceType ?? null,
        referenceId: validated.referenceId ?? null,
        reason: validated.reason ?? null,
        operatorId: user.id,
      },
    }),
    prisma.materialLot.update({
      where: { id: validated.materialLotId },
      data: {
        qtyRemaining: newQty,
        status: newStatus,
      },
    }),
  ]);

  // Emit event
  const site = await prisma.site.findFirst();
  if (site) {
    await emitEvent({
      eventType: 'inventory_transaction_recorded',
      siteId: site.id,
      operatorId: user.id,
      payload: {
        transactionId: transaction.id,
        lotNumber: lot.lotNumber,
        materialCode: lot.materialCode,
        transactionType: validated.transactionType,
        quantity: validated.quantity,
        previousQty,
        newQty,
        referenceType: validated.referenceType ?? null,
        referenceId: validated.referenceId ?? null,
        reason: validated.reason ?? null,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  return transaction;
}

// ── Query Functions ───────────────────────────────────────────────

/**
 * Get all transactions for a specific material lot
 */
export async function getTransactionsForLot(lotId: string) {
  await requireRole(['admin', 'supervisor']);

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { materialLotId: lotId },
    include: {
      materialLot: {
        select: {
          lotNumber: true,
          materialCode: true,
          description: true,
        },
      },
      operator: {
        select: { name: true },
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  return transactions;
}

/**
 * Get a filtered, paginated summary of inventory transactions
 */
export async function getTransactionsSummary(
  filters?: z.infer<typeof transactionFilterSchema>
) {
  await requireRole(['admin', 'supervisor']);

  const validated = transactionFilterSchema.parse(filters ?? {});

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (validated.materialLotId) {
    where.materialLotId = validated.materialLotId;
  }

  if (validated.materialCode) {
    where.materialLot = { materialCode: validated.materialCode };
  }

  if (validated.transactionType) {
    where.transactionType = validated.transactionType;
  }

  if (validated.referenceType) {
    where.referenceType = validated.referenceType;
  }

  if (validated.startDate || validated.endDate) {
    where.timestamp = {};
    if (validated.startDate) {
      where.timestamp.gte = validated.startDate;
    }
    if (validated.endDate) {
      where.timestamp.lte = validated.endDate;
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        materialLot: {
          select: {
            lotNumber: true,
            materialCode: true,
            description: true,
          },
        },
        operator: {
          select: { name: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: validated.limit,
      skip: validated.offset,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return { transactions, total, limit: validated.limit, offset: validated.offset };
}

/**
 * Get recent transactions (for the dashboard)
 */
export async function getRecentTransactions(limit: number = 20) {
  await requireRole(['admin', 'supervisor']);

  const transactions = await prisma.inventoryTransaction.findMany({
    include: {
      materialLot: {
        select: {
          lotNumber: true,
          materialCode: true,
          description: true,
        },
      },
      operator: {
        select: { name: true },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return transactions;
}
