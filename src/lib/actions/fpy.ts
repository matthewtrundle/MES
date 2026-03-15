'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { validate } from '@/lib/validation/schemas';
import { z } from 'zod';

// ── Validation Schemas ──────────────────────────────────────────────

const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).optional();

const stationFPYSchema = z.object({
  stationId: z.string().uuid(),
  dateRange: dateRangeSchema,
});

const overallFPYSchema = z.object({
  siteId: z.string().uuid(),
  dateRange: dateRangeSchema,
});

const fpyTrendSchema = z.object({
  stationId: z.string().uuid(),
  period: z.enum(['daily', 'weekly']),
  intervals: z.number().int().min(1).max(90).default(7),
});

const fpyByProductSchema = z.object({
  siteId: z.string().uuid(),
  dateRange: dateRangeSchema,
});

// ── Types ───────────────────────────────────────────────────────────

export interface FPYResult {
  totalAttempted: number;
  firstPassCount: number;
  fpy: number; // percentage 0-100
}

export interface StationFPYResult extends FPYResult {
  stationId: string;
  stationName: string;
  stationType: string;
  sequenceOrder: number;
}

export interface FPYTrendPoint {
  periodStart: string; // ISO date string
  periodLabel: string;
  fpy: number;
  totalAttempted: number;
  firstPassCount: number;
}

export interface ProductFPYResult extends FPYResult {
  productCode: string;
  productName: string | null;
}

// ── Helper ──────────────────────────────────────────────────────────

function buildDateFilter(dateRange?: { from?: Date; to?: Date }) {
  if (!dateRange) return {};
  const filter: { gte?: Date; lte?: Date } = {};
  if (dateRange.from) filter.gte = dateRange.from;
  if (dateRange.to) filter.lte = dateRange.to;
  return Object.keys(filter).length > 0 ? { completedAt: filter } : {};
}

function calculateFPY(executions: { isRework: boolean; result: string | null }[]): FPYResult {
  // Only count completed executions (with a result)
  const completed = executions.filter((e) => e.result !== null);
  const totalAttempted = completed.length;

  // First-pass = not a rework attempt AND result is 'pass'
  const firstPassCount = completed.filter((e) => !e.isRework && e.result === 'pass').length;

  // Total first-attempt executions (not rework) - this is the denominator
  const firstAttempts = completed.filter((e) => !e.isRework).length;

  const fpy = firstAttempts > 0
    ? Math.round((firstPassCount / firstAttempts) * 1000) / 10
    : 100;

  return { totalAttempted, firstPassCount, fpy };
}

// ── Server Actions ──────────────────────────────────────────────────

/**
 * Calculate FPY for a specific station
 * FPY = (units passing first time without rework) / (total first-attempt units) x 100%
 */
export async function calculateStationFPY(
  stationId: string,
  dateRange?: { from?: Date; to?: Date }
): Promise<StationFPYResult> {
  validate(stationFPYSchema, { stationId, dateRange });
  await requireRole(['admin', 'supervisor']);

  const station = await prisma.station.findUnique({
    where: { id: stationId },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      stationId,
      completedAt: { not: null },
      ...buildDateFilter(dateRange),
    },
    select: {
      isRework: true,
      result: true,
    },
  });

  const fpyResult = calculateFPY(executions);

  return {
    ...fpyResult,
    stationId: station.id,
    stationName: station.name,
    stationType: station.stationType,
    sequenceOrder: station.sequenceOrder,
  };
}

/**
 * Calculate overall FPY across all stations for a site
 */
export async function calculateOverallFPY(
  siteId: string,
  dateRange?: { from?: Date; to?: Date }
): Promise<FPYResult> {
  validate(overallFPYSchema, { siteId, dateRange });
  await requireRole(['admin', 'supervisor']);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      station: { siteId },
      completedAt: { not: null },
      ...buildDateFilter(dateRange),
    },
    select: {
      isRework: true,
      result: true,
    },
  });

  return calculateFPY(executions);
}

/**
 * Get FPY for all stations in a site (for dashboard display)
 */
export async function getAllStationsFPY(
  siteId: string,
  dateRange?: { from?: Date; to?: Date }
): Promise<StationFPYResult[]> {
  validate(overallFPYSchema, { siteId, dateRange });
  await requireRole(['admin', 'supervisor']);

  const stations = await prisma.station.findMany({
    where: { siteId, active: true },
    orderBy: { sequenceOrder: 'asc' },
  });

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      station: { siteId },
      completedAt: { not: null },
      ...buildDateFilter(dateRange),
    },
    select: {
      stationId: true,
      isRework: true,
      result: true,
    },
  });

  // Group executions by station
  const byStation = new Map<string, { isRework: boolean; result: string | null }[]>();
  for (const exec of executions) {
    const list = byStation.get(exec.stationId) || [];
    list.push(exec);
    byStation.set(exec.stationId, list);
  }

  return stations.map((station) => {
    const stationExecs = byStation.get(station.id) || [];
    const fpyResult = calculateFPY(stationExecs);
    return {
      ...fpyResult,
      stationId: station.id,
      stationName: station.name,
      stationType: station.stationType,
      sequenceOrder: station.sequenceOrder,
    };
  });
}

/**
 * Get FPY trend over time for a specific station
 */
export async function getFPYTrend(
  stationId: string,
  period: 'daily' | 'weekly' = 'daily',
  intervals: number = 7
): Promise<FPYTrendPoint[]> {
  validate(fpyTrendSchema, { stationId, period, intervals });
  await requireRole(['admin', 'supervisor']);

  const now = new Date();
  const msPerInterval = period === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const since = new Date(now.getTime() - intervals * msPerInterval);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      stationId,
      completedAt: { gte: since, not: null },
    },
    select: {
      completedAt: true,
      isRework: true,
      result: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const trendPoints: FPYTrendPoint[] = [];

  for (let i = 0; i < intervals; i++) {
    const periodStart = new Date(now.getTime() - (intervals - i) * msPerInterval);
    const periodEnd = new Date(periodStart.getTime() + msPerInterval);

    const periodExecs = executions.filter((e) => {
      const t = e.completedAt!.getTime();
      return t >= periodStart.getTime() && t < periodEnd.getTime();
    });

    const fpyResult = calculateFPY(periodExecs);

    const label = period === 'daily'
      ? periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `Week of ${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    trendPoints.push({
      periodStart: periodStart.toISOString(),
      periodLabel: label,
      fpy: fpyResult.fpy,
      totalAttempted: fpyResult.totalAttempted,
      firstPassCount: fpyResult.firstPassCount,
    });
  }

  return trendPoints;
}

/**
 * Get FPY broken down by product/routing
 */
export async function getFPYByProduct(
  siteId: string,
  dateRange?: { from?: Date; to?: Date }
): Promise<ProductFPYResult[]> {
  validate(fpyByProductSchema, { siteId, dateRange });
  await requireRole(['admin', 'supervisor']);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      station: { siteId },
      completedAt: { not: null },
      ...buildDateFilter(dateRange),
    },
    select: {
      isRework: true,
      result: true,
      unit: {
        select: {
          workOrder: {
            select: {
              productCode: true,
              productName: true,
            },
          },
        },
      },
    },
  });

  // Group by product code
  const byProduct = new Map<string, {
    productName: string | null;
    executions: { isRework: boolean; result: string | null }[];
  }>();

  for (const exec of executions) {
    const code = exec.unit.workOrder.productCode;
    const existing = byProduct.get(code) || {
      productName: exec.unit.workOrder.productName,
      executions: [],
    };
    existing.executions.push(exec);
    byProduct.set(code, existing);
  }

  return Array.from(byProduct.entries()).map(([productCode, data]) => {
    const fpyResult = calculateFPY(data.executions);
    return {
      ...fpyResult,
      productCode,
      productName: data.productName,
    };
  });
}
