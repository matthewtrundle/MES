'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

// ── Types ────────────────────────────────────────────────────────────

export interface SupplierLeadTimeData {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  avgActualLeadTimeDays: number;
  avgExpectedLeadTimeDays: number;
  onTimeRate: number;
  totalPOs: number;
  recentTrend: number[];
}

export interface PartLeadTimeData {
  partNumber: string;
  partName: string;
  avgLeadTimeDays: number;
  orderCount: number;
  lastOrderDate: Date;
}

export interface MonthlyLeadTimeTrend {
  month: string;
  avgLeadTimeDays: number;
  poCount: number;
}

// ── Helper: calculate days between two dates ─────────────────────────

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

// ── Get Lead Time Analytics (by supplier) ────────────────────────────

export async function getLeadTimeAnalytics(): Promise<SupplierLeadTimeData[]> {
  await requireRole(['admin', 'supervisor']);

  const receivedPOs = await prisma.purchaseOrder.findMany({
    where: {
      status: 'fully_received',
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          supplierId: true,
        },
      },
      lineItems: {
        select: {
          expectedLeadTimeDays: true,
        },
      },
    },
    orderBy: { orderDate: 'desc' },
  });

  // Group by supplier
  const supplierMap = new Map<string, {
    supplier: { id: string; name: string; supplierId: string };
    actualLeadTimes: number[];
    expectedLeadTimes: number[];
    onTimeCount: number;
  }>();

  for (const po of receivedPOs) {
    const actualDays = daysBetween(po.orderDate, po.updatedAt);
    const avgExpectedForPO = po.lineItems.length > 0
      ? po.lineItems.reduce((sum, li) => sum + (li.expectedLeadTimeDays ?? 0), 0) / po.lineItems.filter(li => li.expectedLeadTimeDays != null).length
      : 0;

    let entry = supplierMap.get(po.supplierId);
    if (!entry) {
      entry = {
        supplier: po.supplier,
        actualLeadTimes: [],
        expectedLeadTimes: [],
        onTimeCount: 0,
      };
      supplierMap.set(po.supplierId, entry);
    }

    entry.actualLeadTimes.push(actualDays);

    const expectedItems = po.lineItems.filter(li => li.expectedLeadTimeDays != null);
    if (expectedItems.length > 0) {
      entry.expectedLeadTimes.push(avgExpectedForPO);
      if (actualDays <= avgExpectedForPO) {
        entry.onTimeCount += 1;
      }
    }
  }

  const results: SupplierLeadTimeData[] = [];

  for (const [, entry] of supplierMap) {
    const totalPOs = entry.actualLeadTimes.length;
    const avgActual = entry.actualLeadTimes.reduce((a, b) => a + b, 0) / totalPOs;
    const avgExpected = entry.expectedLeadTimes.length > 0
      ? entry.expectedLeadTimes.reduce((a, b) => a + b, 0) / entry.expectedLeadTimes.length
      : 0;
    const onTimeRate = entry.expectedLeadTimes.length > 0
      ? Math.round((entry.onTimeCount / totalPOs) * 100)
      : 100;

    // Last 5 actual lead times for sparkline (most recent first in the array, reverse for chronological)
    const recentTrend = entry.actualLeadTimes.slice(0, 5).reverse();

    results.push({
      supplierId: entry.supplier.id,
      supplierName: entry.supplier.name,
      supplierCode: entry.supplier.supplierId,
      avgActualLeadTimeDays: Math.round(avgActual * 10) / 10,
      avgExpectedLeadTimeDays: Math.round(avgExpected * 10) / 10,
      onTimeRate,
      totalPOs,
      recentTrend,
    });
  }

  // Sort by total POs descending
  return results.sort((a, b) => b.totalPOs - a.totalPOs);
}

// ── Get Lead Time By Part ────────────────────────────────────────────

export async function getLeadTimeByPart(supplierId?: string): Promise<PartLeadTimeData[]> {
  await requireRole(['admin', 'supervisor']);

  const where: Record<string, unknown> = {
    purchaseOrder: { status: 'fully_received' },
  };

  if (supplierId) {
    where.purchaseOrder = {
      status: 'fully_received',
      supplierId,
    };
  }

  const lineItems = await prisma.purchaseOrderLineItem.findMany({
    where,
    select: {
      partNumber: true,
      description: true,
      purchaseOrder: {
        select: {
          orderDate: true,
          updatedAt: true,
        },
      },
    },
  });

  // Group by part number
  const partMap = new Map<string, {
    partName: string;
    leadTimes: number[];
    lastOrderDate: Date;
  }>();

  for (const item of lineItems) {
    const actualDays = daysBetween(item.purchaseOrder.orderDate, item.purchaseOrder.updatedAt);

    let entry = partMap.get(item.partNumber);
    if (!entry) {
      entry = {
        partName: item.description || item.partNumber,
        leadTimes: [],
        lastOrderDate: item.purchaseOrder.orderDate,
      };
      partMap.set(item.partNumber, entry);
    }

    entry.leadTimes.push(actualDays);
    if (item.purchaseOrder.orderDate > entry.lastOrderDate) {
      entry.lastOrderDate = item.purchaseOrder.orderDate;
    }
  }

  const results: PartLeadTimeData[] = [];

  for (const [partNumber, entry] of partMap) {
    const avgLeadTime = entry.leadTimes.reduce((a, b) => a + b, 0) / entry.leadTimes.length;

    results.push({
      partNumber,
      partName: entry.partName,
      avgLeadTimeDays: Math.round(avgLeadTime * 10) / 10,
      orderCount: entry.leadTimes.length,
      lastOrderDate: entry.lastOrderDate,
    });
  }

  return results.sort((a, b) => b.orderCount - a.orderCount);
}

// ── Get Lead Time Trend (monthly) ────────────────────────────────────

export async function getLeadTimeTrend(months: number = 6): Promise<MonthlyLeadTimeTrend[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const receivedPOs = await prisma.purchaseOrder.findMany({
    where: {
      status: 'fully_received',
      orderDate: { gte: since },
    },
    select: {
      orderDate: true,
      updatedAt: true,
    },
    orderBy: { orderDate: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { totalDays: number; count: number }>();

  for (const po of receivedPOs) {
    const actualDays = daysBetween(po.orderDate, po.updatedAt);
    const monthKey = po.orderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    let entry = monthMap.get(monthKey);
    if (!entry) {
      entry = { totalDays: 0, count: 0 };
      monthMap.set(monthKey, entry);
    }

    entry.totalDays += actualDays;
    entry.count += 1;
  }

  // Ensure we have entries for all months in the range
  const results: MonthlyLeadTimeTrend[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    const entry = monthMap.get(monthKey);
    results.push({
      month: monthKey,
      avgLeadTimeDays: entry ? Math.round((entry.totalDays / entry.count) * 10) / 10 : 0,
      poCount: entry?.count ?? 0,
    });
  }

  return results;
}
