'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupplierScorecardEntry {
  supplierId: string;
  supplierDbId: string;
  name: string;
  qualificationStatus: string;
  acceptanceRate: number;
  ncrRate: number;
  onTimeDeliveryRate: number;
  totalLotsReceived: number;
  totalInspections: number;
  ncrCount: number;
  totalPOs: number;
}

export interface SupplierTrendPoint {
  month: string; // YYYY-MM
  acceptanceRate: number;
  totalInspections: number;
  conformingInspections: number;
}

export interface SupplierComparisonEntry {
  supplierId: string;
  supplierDbId: string;
  name: string;
  acceptanceRate: number;
  ncrCount: number;
  avgLeadTimeDays: number | null;
  totalPOs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Supplier scorecard: acceptance rate, NCR rate, on-time delivery, etc.
 */
export async function getSupplierScorecard(
  supplierId?: string
): Promise<SupplierScorecardEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const suppliers = await prisma.supplier.findMany({
    where: supplierId ? { id: supplierId } : { active: true },
    select: {
      id: true,
      name: true,
      supplierId: true,
      qualificationStatus: true,
    },
  });

  if (suppliers.length === 0) return [];

  const supplierIds = suppliers.map((s) => s.id);

  // Fetch all material lots for these suppliers
  const [materialLots, inspections, ncrs, purchaseOrders] = await Promise.all([
    prisma.materialLot.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { id: true, supplierId: true },
    }),
    prisma.incomingInspection.findMany({
      where: {
        materialLot: { supplierId: { in: supplierIds } },
        status: 'completed',
      },
      select: {
        id: true,
        overallResult: true,
        materialLot: { select: { supplierId: true } },
      },
    }),
    prisma.nonconformanceRecord.findMany({
      where: {
        materialLot: { supplierId: { in: supplierIds } },
      },
      select: {
        id: true,
        materialLot: { select: { supplierId: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { supplierId: { in: supplierIds } },
      select: {
        id: true,
        supplierId: true,
        expectedDate: true,
        status: true,
        lineItems: {
          select: { qtyOrdered: true, qtyReceived: true },
        },
      },
    }),
  ]);

  // Index data by supplier
  const lotCountBySupplier = new Map<string, number>();
  for (const lot of materialLots) {
    if (lot.supplierId) {
      lotCountBySupplier.set(lot.supplierId, (lotCountBySupplier.get(lot.supplierId) ?? 0) + 1);
    }
  }

  const inspectionsBySupplier = new Map<string, { total: number; conforming: number }>();
  for (const insp of inspections) {
    const sid = insp.materialLot?.supplierId;
    if (!sid) continue;
    const entry = inspectionsBySupplier.get(sid) ?? { total: 0, conforming: 0 };
    entry.total++;
    if (insp.overallResult === 'conforming') {
      entry.conforming++;
    }
    inspectionsBySupplier.set(sid, entry);
  }

  const ncrCountBySupplier = new Map<string, number>();
  for (const ncr of ncrs) {
    const sid = ncr.materialLot?.supplierId;
    if (!sid) continue;
    ncrCountBySupplier.set(sid, (ncrCountBySupplier.get(sid) ?? 0) + 1);
  }

  const poDataBySupplier = new Map<
    string,
    { total: number; onTime: number }
  >();
  for (const po of purchaseOrders) {
    const entry = poDataBySupplier.get(po.supplierId) ?? { total: 0, onTime: 0 };
    entry.total++;

    // Check on-time: if PO has expectedDate and is partially/fully received
    if (
      po.expectedDate &&
      ['partially_received', 'fully_received', 'closed'].includes(po.status)
    ) {
      // Check if total received qty meets ordered qty by expected date
      // Simplified: consider on-time if status indicates receipt happened
      // In a real system we'd compare actual receive date vs expectedDate
      const totalOrdered = po.lineItems.reduce((s, li) => s + li.qtyOrdered, 0);
      const totalReceived = po.lineItems.reduce((s, li) => s + li.qtyReceived, 0);
      if (totalReceived >= totalOrdered) {
        entry.onTime++;
      }
    }
    poDataBySupplier.set(po.supplierId, entry);
  }

  const scorecards: SupplierScorecardEntry[] = suppliers.map((supplier) => {
    const totalLots = lotCountBySupplier.get(supplier.id) ?? 0;
    const inspData = inspectionsBySupplier.get(supplier.id) ?? { total: 0, conforming: 0 };
    const ncrCount = ncrCountBySupplier.get(supplier.id) ?? 0;
    const poData = poDataBySupplier.get(supplier.id) ?? { total: 0, onTime: 0 };

    const acceptanceRate =
      inspData.total > 0
        ? Math.round((inspData.conforming / inspData.total) * 1000) / 10
        : 100;

    const ncrRate =
      totalLots > 0
        ? Math.round((ncrCount / totalLots) * 1000) / 10
        : 0;

    const onTimeDeliveryRate =
      poData.total > 0
        ? Math.round((poData.onTime / poData.total) * 1000) / 10
        : 100;

    return {
      supplierId: supplier.supplierId,
      supplierDbId: supplier.id,
      name: supplier.name,
      qualificationStatus: supplier.qualificationStatus,
      acceptanceRate,
      ncrRate,
      onTimeDeliveryRate,
      totalLotsReceived: totalLots,
      totalInspections: inspData.total,
      ncrCount,
      totalPOs: poData.total,
    };
  });

  // Sort by acceptance rate ascending (worst first to highlight issues)
  scorecards.sort((a, b) => a.acceptanceRate - b.acceptanceRate);

  return scorecards;
}

/**
 * Acceptance rate over time for a specific supplier, grouped by month.
 */
export async function getSupplierTrend(
  supplierDbId: string,
  days: number = 365
): Promise<SupplierTrendPoint[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const inspections = await prisma.incomingInspection.findMany({
    where: {
      materialLot: { supplierId: supplierDbId },
      status: 'completed',
      completedAt: { gte: since },
    },
    select: {
      overallResult: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { total: number; conforming: number }>();

  for (const insp of inspections) {
    if (!insp.completedAt) continue;
    const month = insp.completedAt.toISOString().slice(0, 7); // YYYY-MM
    const entry = monthMap.get(month) ?? { total: 0, conforming: 0 };
    entry.total++;
    if (insp.overallResult === 'conforming') {
      entry.conforming++;
    }
    monthMap.set(month, entry);
  }

  return [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      acceptanceRate:
        data.total > 0
          ? Math.round((data.conforming / data.total) * 1000) / 10
          : 100,
      totalInspections: data.total,
      conformingInspections: data.conforming,
    }));
}

/**
 * Compare top suppliers side by side.
 */
export async function getSupplierComparison(): Promise<SupplierComparisonEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const suppliers = await prisma.supplier.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      supplierId: true,
    },
  });

  if (suppliers.length === 0) return [];

  const supplierIds = suppliers.map((s) => s.id);

  const [inspections, ncrs, purchaseOrders, partSuppliers] = await Promise.all([
    prisma.incomingInspection.findMany({
      where: {
        materialLot: { supplierId: { in: supplierIds } },
        status: 'completed',
      },
      select: {
        overallResult: true,
        materialLot: { select: { supplierId: true } },
      },
    }),
    prisma.nonconformanceRecord.findMany({
      where: {
        materialLot: { supplierId: { in: supplierIds } },
      },
      select: {
        materialLot: { select: { supplierId: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { id: true, supplierId: true },
    }),
    prisma.partSupplier.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, leadTimeDays: true },
    }),
  ]);

  return suppliers.map((supplier) => {
    const supplierInspections = inspections.filter(
      (i) => i.materialLot?.supplierId === supplier.id
    );
    const conforming = supplierInspections.filter(
      (i) => i.overallResult === 'conforming'
    ).length;
    const acceptanceRate =
      supplierInspections.length > 0
        ? Math.round((conforming / supplierInspections.length) * 1000) / 10
        : 100;

    const ncrCount = ncrs.filter(
      (n) => n.materialLot?.supplierId === supplier.id
    ).length;

    const totalPOs = purchaseOrders.filter(
      (po) => po.supplierId === supplier.id
    ).length;

    const leadTimes = partSuppliers
      .filter((ps) => ps.supplierId === supplier.id && ps.leadTimeDays != null)
      .map((ps) => ps.leadTimeDays!);

    const avgLeadTimeDays =
      leadTimes.length > 0
        ? Math.round(
            (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10
          ) / 10
        : null;

    return {
      supplierId: supplier.supplierId,
      supplierDbId: supplier.id,
      name: supplier.name,
      acceptanceRate,
      ncrCount,
      avgLeadTimeDays,
      totalPOs,
    };
  }).sort((a, b) => b.totalPOs - a.totalPOs);
}
