'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { uuid, positiveNumber } from '@/lib/validation/schemas';

const receiveMaterialLotSchema = z.object({
  lotNumber: z.string().min(1, 'Lot number is required').max(50),
  materialCode: z.string().min(1, 'Material code is required').max(50),
  description: z.string().max(200).optional(),
  qtyReceived: positiveNumber,
  unitOfMeasure: z.string().min(1).max(10).default('EA'),
  supplier: z.string().max(200).optional(),
  purchaseOrderNumber: z.string().max(50).optional(),
  expiresAt: z.coerce.date().optional(),
  status: z.enum(['available', 'quarantine', 'pending_iqc']).default('available'),
  // PO-link fields
  poLineItemId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  conditionNotes: z.string().max(1000).optional(),
});

const updateMaterialLotStatusSchema = z.object({
  lotId: uuid,
  status: z.enum(['available', 'quarantine', 'expired', 'depleted', 'pending_iqc']),
});

/**
 * Receive a new material lot into inventory
 */
export async function receiveMaterialLot(data: z.infer<typeof receiveMaterialLotSchema>) {
  const validated = receiveMaterialLotSchema.parse(data);
  const user = await requireRole(['admin', 'supervisor']);

  // Check for duplicate lot number
  const existing = await prisma.materialLot.findUnique({
    where: { lotNumber: validated.lotNumber },
  });

  if (existing) {
    throw new Error(`Material lot ${validated.lotNumber} already exists`);
  }

  const site = await prisma.site.findFirst();
  if (!site) {
    throw new Error('No site configured');
  }

  // Create lot and record receiving transaction atomically
  const [lot] = await prisma.$transaction(async (tx) => {
    const newLot = await tx.materialLot.create({
      data: {
        lotNumber: validated.lotNumber,
        materialCode: validated.materialCode,
        description: validated.description,
        qtyReceived: validated.qtyReceived,
        qtyRemaining: validated.qtyReceived,
        unitOfMeasure: validated.unitOfMeasure,
        supplier: validated.supplier,
        purchaseOrderNumber: validated.purchaseOrderNumber,
        expiresAt: validated.expiresAt,
        status: validated.status,
        receivedById: user.id,
        poLineItemId: validated.poLineItemId ?? null,
        supplierId: validated.supplierId ?? null,
        carrier: validated.carrier ?? null,
        trackingNumber: validated.trackingNumber ?? null,
        conditionNotes: validated.conditionNotes ?? null,
      },
    });

    // Record inventory transaction in the ledger
    const txn = await tx.inventoryTransaction.create({
      data: {
        materialLotId: newLot.id,
        transactionType: 'receive',
        quantity: validated.qtyReceived,
        previousQty: 0,
        newQty: validated.qtyReceived,
        referenceType: 'manual',
        reason: validated.supplier
          ? `Received from ${validated.supplier}${validated.purchaseOrderNumber ? ` (PO: ${validated.purchaseOrderNumber})` : ''}`
          : 'Material receiving',
        operatorId: user.id,
      },
    });

    return [newLot, txn] as const;
  });

  await emitEvent({
    eventType: 'material_lot_received',
    siteId: site.id,
    operatorId: user.id,
    payload: {
      lotNumber: lot.lotNumber,
      materialCode: lot.materialCode,
      qtyReceived: lot.qtyReceived,
      unitOfMeasure: lot.unitOfMeasure,
      supplier: lot.supplier,
      purchaseOrderNumber: lot.purchaseOrderNumber,
      status: lot.status,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/materials');
  revalidatePath('/dashboard/inventory');

  return lot;
}

/**
 * Update the status of a material lot
 */
export async function updateMaterialLotStatus(data: z.infer<typeof updateMaterialLotStatusSchema>) {
  const validated = updateMaterialLotStatusSchema.parse(data);
  const user = await requireRole(['admin', 'supervisor']);

  const lot = await prisma.materialLot.findUnique({
    where: { id: validated.lotId },
  });

  if (!lot) {
    throw new Error('Material lot not found');
  }

  const updatedLot = await prisma.materialLot.update({
    where: { id: validated.lotId },
    data: { status: validated.status },
  });

  revalidatePath('/admin/materials');
  revalidatePath('/dashboard/inventory');

  return updatedLot;
}

/**
 * Get all material lots for admin view
 */
export async function getMaterialLotsForAdmin(filters?: {
  materialCode?: string;
  status?: string;
}) {
  await requireRole(['admin', 'supervisor']);

  const lots = await prisma.materialLot.findMany({
    where: {
      ...(filters?.materialCode && { materialCode: filters.materialCode }),
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      receivedBy: {
        select: { name: true },
      },
      _count: {
        select: { consumptions: true },
      },
    },
    orderBy: { receivedAt: 'desc' },
    take: 500,
  });

  return lots;
}

/**
 * Get distinct material codes for dropdowns
 */
export async function getDistinctMaterialCodes() {
  const lots = await prisma.materialLot.findMany({
    distinct: ['materialCode'],
    select: { materialCode: true, description: true },
    orderBy: { materialCode: 'asc' },
  });

  return lots;
}
