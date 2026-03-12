'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

export interface OperatorProductivityRow {
  operatorId: string;
  operatorName: string;
  unitsProcessed: number;
  avgCycleTime: number;
  fpy: number;
  totalHoursWorked: number;
  mostActiveStation: string | null;
  mostActiveStationId: string | null;
}

export interface OperatorTrendPoint {
  date: string;
  unitsCompleted: number;
  fpy: number;
}

export interface OperatorComparisonRow {
  operatorId: string;
  operatorName: string;
  unitsPerDay: number;
  fpy: number;
  avgCycleTime: number;
}

/**
 * Get productivity metrics for all operators within a time window.
 */
export async function getOperatorProductivity(days: number = 30): Promise<OperatorProductivityRow[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      operatorId: true,
      stationId: true,
      result: true,
      isRework: true,
      cycleTimeMinutes: true,
      operator: { select: { name: true } },
      station: { select: { name: true } },
    },
  });

  // Group by operator
  const byOperator = new Map<string, {
    name: string;
    totalUnits: number;
    totalCycleTime: number;
    cycleTimeCount: number;
    firstAttemptTotal: number;
    firstAttemptPass: number;
    stationCounts: Map<string, { count: number; name: string }>;
  }>();

  for (const exec of executions) {
    let op = byOperator.get(exec.operatorId);
    if (!op) {
      op = {
        name: exec.operator.name,
        totalUnits: 0,
        totalCycleTime: 0,
        cycleTimeCount: 0,
        firstAttemptTotal: 0,
        firstAttemptPass: 0,
        stationCounts: new Map(),
      };
      byOperator.set(exec.operatorId, op);
    }

    op.totalUnits += 1;

    if (exec.cycleTimeMinutes != null) {
      op.totalCycleTime += exec.cycleTimeMinutes;
      op.cycleTimeCount += 1;
    }

    if (!exec.isRework) {
      op.firstAttemptTotal += 1;
      if (exec.result === 'pass') {
        op.firstAttemptPass += 1;
      }
    }

    const sc = op.stationCounts.get(exec.stationId) || { count: 0, name: exec.station.name };
    sc.count += 1;
    op.stationCounts.set(exec.stationId, sc);
  }

  const rows: OperatorProductivityRow[] = [];
  for (const [operatorId, op] of byOperator.entries()) {
    let mostActiveStation: string | null = null;
    let mostActiveStationId: string | null = null;
    let maxCount = 0;
    for (const [stationId, sc] of op.stationCounts.entries()) {
      if (sc.count > maxCount) {
        maxCount = sc.count;
        mostActiveStation = sc.name;
        mostActiveStationId = stationId;
      }
    }

    rows.push({
      operatorId,
      operatorName: op.name,
      unitsProcessed: op.totalUnits,
      avgCycleTime: op.cycleTimeCount > 0
        ? Math.round((op.totalCycleTime / op.cycleTimeCount) * 100) / 100
        : 0,
      fpy: op.firstAttemptTotal > 0
        ? Math.round((op.firstAttemptPass / op.firstAttemptTotal) * 1000) / 10
        : 100,
      totalHoursWorked: Math.round((op.totalCycleTime / 60) * 100) / 100,
      mostActiveStation,
      mostActiveStationId,
    });
  }

  return rows.sort((a, b) => b.unitsProcessed - a.unitsProcessed);
}

/**
 * Get daily trend data for a specific operator.
 */
export async function getOperatorTrend(operatorId: string, days: number = 14): Promise<OperatorTrendPoint[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      operatorId,
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      completedAt: true,
      result: true,
      isRework: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  // Group by day
  const byDay = new Map<string, { total: number; firstAttemptTotal: number; firstAttemptPass: number }>();

  for (const exec of executions) {
    if (!exec.completedAt) continue;
    const dateKey = exec.completedAt.toISOString().slice(0, 10);
    const day = byDay.get(dateKey) || { total: 0, firstAttemptTotal: 0, firstAttemptPass: 0 };
    day.total += 1;
    if (!exec.isRework) {
      day.firstAttemptTotal += 1;
      if (exec.result === 'pass') {
        day.firstAttemptPass += 1;
      }
    }
    byDay.set(dateKey, day);
  }

  // Fill in missing days with zeros
  const result: OperatorTrendPoint[] = [];
  const current = new Date(since);
  const today = new Date();
  while (current <= today) {
    const dateKey = current.toISOString().slice(0, 10);
    const day = byDay.get(dateKey);
    result.push({
      date: dateKey,
      unitsCompleted: day?.total ?? 0,
      fpy: day && day.firstAttemptTotal > 0
        ? Math.round((day.firstAttemptPass / day.firstAttemptTotal) * 1000) / 10
        : 100,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Side-by-side comparison of operators.
 */
export async function getOperatorComparison(days: number = 30): Promise<OperatorComparisonRow[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      operatorId: true,
      result: true,
      isRework: true,
      cycleTimeMinutes: true,
      completedAt: true,
      operator: { select: { name: true } },
    },
  });

  const byOperator = new Map<string, {
    name: string;
    totalUnits: number;
    totalCycleTime: number;
    cycleTimeCount: number;
    firstAttemptTotal: number;
    firstAttemptPass: number;
    activeDays: Set<string>;
  }>();

  for (const exec of executions) {
    let op = byOperator.get(exec.operatorId);
    if (!op) {
      op = {
        name: exec.operator.name,
        totalUnits: 0,
        totalCycleTime: 0,
        cycleTimeCount: 0,
        firstAttemptTotal: 0,
        firstAttemptPass: 0,
        activeDays: new Set(),
      };
      byOperator.set(exec.operatorId, op);
    }

    op.totalUnits += 1;
    if (exec.completedAt) {
      op.activeDays.add(exec.completedAt.toISOString().slice(0, 10));
    }
    if (exec.cycleTimeMinutes != null) {
      op.totalCycleTime += exec.cycleTimeMinutes;
      op.cycleTimeCount += 1;
    }
    if (!exec.isRework) {
      op.firstAttemptTotal += 1;
      if (exec.result === 'pass') {
        op.firstAttemptPass += 1;
      }
    }
  }

  const rows: OperatorComparisonRow[] = [];
  for (const [operatorId, op] of byOperator.entries()) {
    const activeDayCount = op.activeDays.size || 1;
    rows.push({
      operatorId,
      operatorName: op.name,
      unitsPerDay: Math.round((op.totalUnits / activeDayCount) * 10) / 10,
      fpy: op.firstAttemptTotal > 0
        ? Math.round((op.firstAttemptPass / op.firstAttemptTotal) * 1000) / 10
        : 100,
      avgCycleTime: op.cycleTimeCount > 0
        ? Math.round((op.totalCycleTime / op.cycleTimeCount) * 100) / 100
        : 0,
    });
  }

  return rows.sort((a, b) => b.unitsPerDay - a.unitsPerDay);
}
