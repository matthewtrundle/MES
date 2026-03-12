'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

/**
 * Get inventory summary grouped by material code
 */
export async function getInventorySummary() {
  await requireRole(['admin', 'supervisor']);

  const lots = await prisma.materialLot.findMany({
    where: {
      qtyRemaining: { gt: 0 },
    },
    select: {
      materialCode: true,
      description: true,
      qtyRemaining: true,
      unitOfMeasure: true,
      status: true,
      expiresAt: true,
    },
  });

  // Also get kitted (committed) quantities
  const kitLines = await prisma.kitLine.findMany({
    where: {
      kit: { status: { in: ['pending', 'in_progress', 'complete'] } },
      qtyPicked: { gt: 0 },
    },
    select: {
      materialCode: true,
      qtyPicked: true,
    },
  });

  // Group by material code
  const summary: Record<string, {
    materialCode: string;
    description: string | null;
    unitOfMeasure: string;
    totalOnHand: number;
    committed: number;
    available: number;
    lotCount: number;
    expiringCount: number;
  }> = {};

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const lot of lots) {
    if (!summary[lot.materialCode]) {
      summary[lot.materialCode] = {
        materialCode: lot.materialCode,
        description: lot.description,
        unitOfMeasure: lot.unitOfMeasure,
        totalOnHand: 0,
        committed: 0,
        available: 0,
        lotCount: 0,
        expiringCount: 0,
      };
    }

    const entry = summary[lot.materialCode];
    if (lot.status === 'available') {
      entry.totalOnHand += lot.qtyRemaining;
      entry.lotCount += 1;
    }
    if (lot.expiresAt && lot.expiresAt > now && lot.expiresAt <= sevenDays) {
      entry.expiringCount += 1;
    }
  }

  // Subtract committed quantities
  for (const line of kitLines) {
    if (summary[line.materialCode]) {
      summary[line.materialCode].committed += line.qtyPicked;
    }
  }

  // Calculate available = onHand - committed
  for (const entry of Object.values(summary)) {
    entry.available = Math.max(0, entry.totalOnHand - entry.committed);
  }

  return Object.values(summary).sort((a, b) => a.materialCode.localeCompare(b.materialCode));
}

/**
 * Get all material lots with remaining quantity (for individual lot management)
 */
export async function getAllLots() {
  await requireRole(['admin', 'supervisor']);

  const lots = await prisma.materialLot.findMany({
    where: {
      qtyRemaining: { gt: 0 },
    },
    orderBy: [{ materialCode: 'asc' }, { receivedAt: 'asc' }],
  });

  return lots;
}

/**
 * Get materials with low stock based on consumption rate
 */
export async function getLowStockMaterials(thresholdDays: number = 14) {
  await requireRole(['admin', 'supervisor']);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get consumption over last 30 days grouped by material code
  const consumptions = await prisma.unitMaterialConsumption.findMany({
    where: {
      timestamp: { gte: thirtyDaysAgo },
    },
    include: {
      materialLot: {
        select: { materialCode: true },
      },
    },
  });

  // Calculate daily consumption rate per material
  const rates: Record<string, { totalConsumed: number; materialCode: string }> = {};
  for (const c of consumptions) {
    const code = c.materialLot.materialCode;
    if (!rates[code]) {
      rates[code] = { totalConsumed: 0, materialCode: code };
    }
    rates[code].totalConsumed += c.qtyConsumed;
  }

  // Get current on-hand
  const onHand = await prisma.materialLot.groupBy({
    by: ['materialCode'],
    where: {
      status: 'available',
      qtyRemaining: { gt: 0 },
    },
    _sum: { qtyRemaining: true },
  });

  const onHandMap = Object.fromEntries(
    onHand.map((o) => [o.materialCode, o._sum.qtyRemaining ?? 0])
  );

  const lowStock = [];
  for (const [code, rate] of Object.entries(rates)) {
    const dailyRate = rate.totalConsumed / 30;
    const currentQty = onHandMap[code] ?? 0;
    const daysRemaining = dailyRate > 0 ? currentQty / dailyRate : Infinity;

    if (daysRemaining <= thresholdDays) {
      lowStock.push({
        materialCode: code,
        currentOnHand: currentQty,
        dailyConsumptionRate: Math.round(dailyRate * 100) / 100,
        daysRemaining: Math.round(daysRemaining),
      });
    }
  }

  return lowStock.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Get lots expiring within a given number of days
 */
export async function getExpiringLots(withinDays: number = 7) {
  await requireRole(['admin', 'supervisor']);

  const now = new Date();
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const lots = await prisma.materialLot.findMany({
    where: {
      qtyRemaining: { gt: 0 },
      expiresAt: {
        not: null,
        gt: now,
        lte: threshold,
      },
    },
    orderBy: { expiresAt: 'asc' },
  });

  return lots;
}

/**
 * Get material transaction history for a material code
 */
export async function getMaterialTransactionHistory(materialCode: string) {
  await requireRole(['admin', 'supervisor']);

  // Get receiving history
  const lots = await prisma.materialLot.findMany({
    where: { materialCode },
    select: {
      id: true,
      lotNumber: true,
      qtyReceived: true,
      qtyRemaining: true,
      status: true,
      receivedAt: true,
      expiresAt: true,
      receivedBy: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
  });

  // Get consumption history
  const consumptions = await prisma.unitMaterialConsumption.findMany({
    where: {
      materialLot: { materialCode },
    },
    include: {
      materialLot: { select: { lotNumber: true } },
      unit: { select: { serialNumber: true } },
      station: { select: { name: true } },
      operator: { select: { name: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  return { lots, consumptions };
}
