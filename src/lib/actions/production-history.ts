'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { Prisma } from '@prisma/client';

export interface ProductionHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  productCode?: string;
  workOrderId?: string;
  serialNumber?: string;
  stationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'serial' | 'status';
  sortDir?: 'asc' | 'desc';
}

export interface ProductionHistoryUnit {
  id: string;
  serialNumber: string;
  status: string;
  createdAt: string;
  workOrder: {
    orderNumber: string;
    productCode: string;
    productName: string | null;
  };
  operations: Array<{
    stationName: string;
    result: string | null;
    cycleTimeMinutes: number | null;
    operatorName: string;
    completedAt: string | null;
    isRework: boolean;
  }>;
}

export interface ProductionHistoryResult {
  data: ProductionHistoryUnit[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductionSummary {
  totalUnits: number;
  byProductCode: Array<{ productCode: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  avgCycleTime: number;
  fpy: number;
}

/**
 * Paginated search across production history with filters.
 */
export async function searchProductionHistory(
  filters: ProductionHistoryFilters
): Promise<ProductionHistoryResult> {
  await requireRole(['admin', 'supervisor']);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Prisma.UnitWhereInput = {};

  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter || {}), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter || {}), lte: endOfDay };
  }
  if (filters.serialNumber) {
    where.serialNumber = { contains: filters.serialNumber, mode: 'insensitive' };
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.productCode || filters.workOrderId) {
    where.workOrder = {};
    if (filters.productCode) {
      where.workOrder.productCode = { contains: filters.productCode, mode: 'insensitive' };
    }
    if (filters.workOrderId) {
      where.workOrder.orderNumber = { contains: filters.workOrderId, mode: 'insensitive' };
    }
  }
  if (filters.stationId) {
    where.executions = { some: { stationId: filters.stationId } };
  }

  // Build orderBy
  let orderBy: Prisma.UnitOrderByWithRelationInput = { createdAt: 'desc' };
  if (filters.sortBy === 'serial') {
    orderBy = { serialNumber: filters.sortDir ?? 'asc' };
  } else if (filters.sortBy === 'status') {
    orderBy = { status: filters.sortDir ?? 'asc' };
  } else if (filters.sortBy === 'date') {
    orderBy = { createdAt: filters.sortDir ?? 'desc' };
  }

  const [units, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        workOrder: {
          select: {
            orderNumber: true,
            productCode: true,
            productName: true,
          },
        },
        executions: {
          select: {
            stationId: true,
            station: { select: { name: true } },
            result: true,
            cycleTimeMinutes: true,
            operator: { select: { name: true } },
            completedAt: true,
            isRework: true,
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    }),
    prisma.unit.count({ where }),
  ]);

  const data: ProductionHistoryUnit[] = units.map((unit) => ({
    id: unit.id,
    serialNumber: unit.serialNumber,
    status: unit.status,
    createdAt: unit.createdAt.toISOString(),
    workOrder: {
      orderNumber: unit.workOrder.orderNumber,
      productCode: unit.workOrder.productCode,
      productName: unit.workOrder.productName,
    },
    operations: unit.executions.map((exec) => ({
      stationName: exec.station.name,
      result: exec.result,
      cycleTimeMinutes: exec.cycleTimeMinutes,
      operatorName: exec.operator.name,
      completedAt: exec.completedAt?.toISOString() ?? null,
      isRework: exec.isRework,
    })),
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Summary statistics for a date range.
 */
export async function getProductionSummary(
  dateFrom: Date,
  dateTo: Date
): Promise<ProductionSummary> {
  await requireRole(['admin', 'supervisor']);

  const endOfDay = new Date(dateTo);
  endOfDay.setHours(23, 59, 59, 999);

  const where = {
    createdAt: { gte: dateFrom, lte: endOfDay },
  };

  const [totalUnits, byStatus, unitsByWO, executions] = await Promise.all([
    prisma.unit.count({ where }),
    prisma.unit.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.unit.findMany({
      where,
      select: {
        workOrder: { select: { productCode: true } },
      },
    }),
    prisma.unitOperationExecution.findMany({
      where: {
        completedAt: { gte: dateFrom, lte: endOfDay },
        result: { not: null },
      },
      select: {
        cycleTimeMinutes: true,
        isRework: true,
        result: true,
      },
    }),
  ]);

  // Aggregate by product code
  const productCounts = new Map<string, number>();
  for (const u of unitsByWO) {
    const pc = u.workOrder.productCode;
    productCounts.set(pc, (productCounts.get(pc) ?? 0) + 1);
  }

  // Calculate FPY
  const firstAttempts = executions.filter((e) => !e.isRework);
  const firstPassCount = firstAttempts.filter((e) => e.result === 'pass').length;
  const fpy = firstAttempts.length > 0
    ? Math.round((firstPassCount / firstAttempts.length) * 1000) / 10
    : 100;

  // Average cycle time
  const withCycleTime = executions.filter((e) => e.cycleTimeMinutes != null);
  const avgCycleTime = withCycleTime.length > 0
    ? Math.round((withCycleTime.reduce((s, e) => s + e.cycleTimeMinutes!, 0) / withCycleTime.length) * 100) / 100
    : 0;

  return {
    totalUnits,
    byProductCode: Array.from(productCounts.entries())
      .map(([productCode, count]) => ({ productCode, count }))
      .sort((a, b) => b.count - a.count),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    avgCycleTime,
    fpy,
  };
}
