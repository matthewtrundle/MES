'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

export type StockStatus = 'OK' | 'Low' | 'Critical' | 'Out of Stock';

export interface StockVsReorderRow {
  materialCode: string;
  description: string | null;
  currentStock: number;
  reorderPoint: number | null;
  targetStock: number | null;
  unitOfMeasure: string;
  status: StockStatus;
  lotCount: number;
}

export interface InventoryTurnRow {
  materialCode: string;
  description: string | null;
  totalConsumed: number;
  avgOnHand: number;
  turns: number;
}

export interface InventoryValuationRow {
  materialCode: string;
  name: string;
  category: string;
  qtyOnHand: number;
  standardCost: number;
  totalValue: number;
}

export interface InventoryValuationResult {
  items: InventoryValuationRow[];
  totalValuation: number;
  byCategory: Array<{ category: string; value: number; count: number }>;
}

export interface ExpiringLot {
  lotNumber: string;
  materialCode: string;
  description: string | null;
  qtyRemaining: number;
  expiresAt: string;
  daysUntilExpiry: number;
  supplier: string | null;
}

/**
 * Compare current stock levels against reorder points and targets.
 */
export async function getStockVsReorder(): Promise<StockVsReorderRow[]> {
  await requireRole(['admin', 'supervisor']);

  const [lots, partMasters] = await Promise.all([
    prisma.materialLot.findMany({
      where: { status: 'available' },
      select: {
        materialCode: true,
        description: true,
        qtyRemaining: true,
        unitOfMeasure: true,
      },
    }),
    prisma.partMaster.findMany({
      select: {
        partNumber: true,
        reorderPoint: true,
        targetStockLevel: true,
      },
    }),
  ]);

  // Index part masters by part number
  const partMap = new Map(partMasters.map((p) => [p.partNumber, p]));

  // Group lots by material code
  const grouped = new Map<string, {
    description: string | null;
    totalQty: number;
    unitOfMeasure: string;
    lotCount: number;
  }>();

  for (const lot of lots) {
    const existing = grouped.get(lot.materialCode);
    if (existing) {
      existing.totalQty += lot.qtyRemaining;
      existing.lotCount += 1;
    } else {
      grouped.set(lot.materialCode, {
        description: lot.description,
        totalQty: lot.qtyRemaining,
        unitOfMeasure: lot.unitOfMeasure,
        lotCount: 1,
      });
    }
  }

  // Also include materials with zero stock that have a part master entry
  for (const pm of partMasters) {
    if (!grouped.has(pm.partNumber) && (pm.reorderPoint != null || pm.targetStockLevel != null)) {
      grouped.set(pm.partNumber, {
        description: null,
        totalQty: 0,
        unitOfMeasure: 'EA',
        lotCount: 0,
      });
    }
  }

  const rows: StockVsReorderRow[] = [];
  for (const [materialCode, data] of grouped.entries()) {
    const pm = partMap.get(materialCode);
    const reorderPoint = pm?.reorderPoint ?? null;
    const targetStock = pm?.targetStockLevel ?? null;

    let status: StockStatus = 'OK';
    if (data.totalQty === 0) {
      status = 'Out of Stock';
    } else if (reorderPoint != null && data.totalQty <= reorderPoint * 0.5) {
      status = 'Critical';
    } else if (reorderPoint != null && data.totalQty <= reorderPoint) {
      status = 'Low';
    }

    rows.push({
      materialCode,
      description: data.description,
      currentStock: Math.round(data.totalQty * 100) / 100,
      reorderPoint,
      targetStock,
      unitOfMeasure: data.unitOfMeasure,
      status,
      lotCount: data.lotCount,
    });
  }

  // Sort: critical/out of stock first, then low, then OK
  const statusOrder: Record<StockStatus, number> = {
    'Out of Stock': 0,
    'Critical': 1,
    'Low': 2,
    'OK': 3,
  };
  return rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

/**
 * Calculate inventory turnover by material code.
 */
export async function getInventoryTurns(days: number = 90): Promise<InventoryTurnRow[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [issueTransactions, currentLots] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'issue',
        timestamp: { gte: since },
      },
      select: {
        quantity: true,
        materialLot: {
          select: { materialCode: true, description: true },
        },
      },
    }),
    prisma.materialLot.findMany({
      where: { status: 'available' },
      select: {
        materialCode: true,
        description: true,
        qtyRemaining: true,
      },
    }),
  ]);

  // Sum consumed (issue transactions are negative, so take abs)
  const consumed = new Map<string, { total: number; description: string | null }>();
  for (const tx of issueTransactions) {
    const mc = tx.materialLot.materialCode;
    const existing = consumed.get(mc) || { total: 0, description: tx.materialLot.description };
    existing.total += Math.abs(tx.quantity);
    consumed.set(mc, existing);
  }

  // Sum current on-hand by material code
  const onHand = new Map<string, number>();
  for (const lot of currentLots) {
    onHand.set(lot.materialCode, (onHand.get(lot.materialCode) ?? 0) + lot.qtyRemaining);
  }

  // Calculate turns
  const rows: InventoryTurnRow[] = [];
  const allCodes = new Set([...consumed.keys(), ...onHand.keys()]);

  for (const materialCode of allCodes) {
    const totalConsumed = consumed.get(materialCode)?.total ?? 0;
    const avgOnHandValue = onHand.get(materialCode) ?? 0;
    const description = consumed.get(materialCode)?.description ?? null;

    // Annualize: turns = (consumed / period) * 365 / avg on-hand
    const annualizedConsumption = totalConsumed * (365 / days);
    const turns = avgOnHandValue > 0
      ? Math.round((annualizedConsumption / avgOnHandValue) * 10) / 10
      : 0;

    if (totalConsumed > 0 || avgOnHandValue > 0) {
      rows.push({
        materialCode,
        description,
        totalConsumed: Math.round(totalConsumed * 100) / 100,
        avgOnHand: Math.round(avgOnHandValue * 100) / 100,
        turns,
      });
    }
  }

  return rows.sort((a, b) => a.turns - b.turns);
}

/**
 * Calculate inventory valuation: on-hand qty * standard cost.
 */
export async function getInventoryValuation(): Promise<InventoryValuationResult> {
  await requireRole(['admin', 'supervisor']);

  const [lots, partMasters] = await Promise.all([
    prisma.materialLot.findMany({
      where: { status: 'available', qtyRemaining: { gt: 0 } },
      select: {
        materialCode: true,
        qtyRemaining: true,
      },
    }),
    prisma.partMaster.findMany({
      select: {
        partNumber: true,
        name: true,
        category: true,
        standardCost: true,
      },
    }),
  ]);

  const partMap = new Map(partMasters.map((p) => [p.partNumber, p]));

  // Aggregate on-hand by material code
  const onHand = new Map<string, number>();
  for (const lot of lots) {
    onHand.set(lot.materialCode, (onHand.get(lot.materialCode) ?? 0) + lot.qtyRemaining);
  }

  const items: InventoryValuationRow[] = [];
  let totalValuation = 0;
  const categoryTotals = new Map<string, { value: number; count: number }>();

  for (const [materialCode, qty] of onHand.entries()) {
    const pm = partMap.get(materialCode);
    const standardCost = pm?.standardCost ?? 0;
    const name = pm?.name ?? materialCode;
    const category = pm?.category ?? 'uncategorized';
    const totalValue = Math.round(qty * standardCost * 100) / 100;

    items.push({
      materialCode,
      name,
      category,
      qtyOnHand: Math.round(qty * 100) / 100,
      standardCost,
      totalValue,
    });

    totalValuation += totalValue;

    const cat = categoryTotals.get(category) || { value: 0, count: 0 };
    cat.value += totalValue;
    cat.count += 1;
    categoryTotals.set(category, cat);
  }

  return {
    items: items.sort((a, b) => b.totalValue - a.totalValue),
    totalValuation: Math.round(totalValuation * 100) / 100,
    byCategory: Array.from(categoryTotals.entries())
      .map(([category, data]) => ({
        category,
        value: Math.round(data.value * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * Find lots expiring within N days.
 */
export async function getExpiringInventory(withinDays: number = 30): Promise<ExpiringLot[]> {
  await requireRole(['admin', 'supervisor']);

  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

  const lots = await prisma.materialLot.findMany({
    where: {
      status: 'available',
      qtyRemaining: { gt: 0 },
      expiresAt: { not: null, lte: cutoff },
    },
    select: {
      lotNumber: true,
      materialCode: true,
      description: true,
      qtyRemaining: true,
      expiresAt: true,
      supplier: true,
    },
    orderBy: { expiresAt: 'asc' },
  });

  const now = Date.now();

  return lots.map((lot) => ({
    lotNumber: lot.lotNumber,
    materialCode: lot.materialCode,
    description: lot.description,
    qtyRemaining: lot.qtyRemaining,
    expiresAt: lot.expiresAt!.toISOString(),
    daysUntilExpiry: Math.ceil((lot.expiresAt!.getTime() - now) / (24 * 60 * 60 * 1000)),
    supplier: lot.supplier,
  }));
}
