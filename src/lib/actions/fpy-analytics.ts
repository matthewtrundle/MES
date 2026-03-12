'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

// ============================================================================
// Types
// ============================================================================

export interface StationFPY {
  stationId: string;
  stationName: string;
  stationType: string;
  sequenceOrder: number;
  fpy: number;
  totalFirstPass: number;
  passedFirstPass: number;
}

export interface FPYTrendPoint {
  date: string;
  dateLabel: string;
  fpy: number;
  totalFirstPass: number;
  passedFirstPass: number;
}

export interface StepFPY {
  sequence: number;
  stationName: string;
  fpy: number;
  totalFirstPass: number;
  passedFirstPass: number;
}

export interface OverallFPYResult {
  fpy: number;
  totalFirstPass: number;
  passedFirstPass: number;
}

// ============================================================================
// FPY by Station
// ============================================================================

export async function getFPYByStation(days: number = 30): Promise<StationFPY[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      stationId: true,
      isRework: true,
      result: true,
      station: {
        select: { name: true, stationType: true, sequenceOrder: true },
      },
    },
  });

  // Group by station
  const stationMap = new Map<string, {
    name: string;
    stationType: string;
    sequenceOrder: number;
    totalFirstPass: number;
    passedFirstPass: number;
  }>();

  for (const exec of executions) {
    if (!stationMap.has(exec.stationId)) {
      stationMap.set(exec.stationId, {
        name: exec.station.name,
        stationType: exec.station.stationType,
        sequenceOrder: exec.station.sequenceOrder,
        totalFirstPass: 0,
        passedFirstPass: 0,
      });
    }

    const entry = stationMap.get(exec.stationId)!;

    if (!exec.isRework) {
      entry.totalFirstPass++;
      if (exec.result === 'pass') {
        entry.passedFirstPass++;
      }
    }
  }

  return Array.from(stationMap.entries())
    .map(([stationId, data]) => ({
      stationId,
      stationName: data.name,
      stationType: data.stationType,
      sequenceOrder: data.sequenceOrder,
      fpy: data.totalFirstPass > 0
        ? Math.round((data.passedFirstPass / data.totalFirstPass) * 1000) / 10
        : 100,
      totalFirstPass: data.totalFirstPass,
      passedFirstPass: data.passedFirstPass,
    }))
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

// ============================================================================
// FPY Trend over Time
// ============================================================================

export async function getFPYTrend(params: {
  stationId?: string;
  days?: number;
  granularity: 'day' | 'week';
}): Promise<FPYTrendPoint[]> {
  await requireRole(['admin', 'supervisor']);

  const { stationId, days = 30, granularity } = params;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
      ...(stationId && { stationId }),
    },
    select: {
      completedAt: true,
      isRework: true,
      result: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerWeek = 7 * msPerDay;
  const bucketMs = granularity === 'week' ? msPerWeek : msPerDay;

  // Build time buckets
  const buckets = new Map<string, { totalFirstPass: number; passedFirstPass: number; date: Date }>();
  const now = new Date();

  const numBuckets = granularity === 'week' ? Math.ceil(days / 7) : days;
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketStart = new Date(now.getTime() - i * bucketMs);
    bucketStart.setHours(0, 0, 0, 0);
    const key = bucketStart.toISOString().split('T')[0];
    buckets.set(key, { totalFirstPass: 0, passedFirstPass: 0, date: bucketStart });
  }

  for (const exec of executions) {
    if (!exec.completedAt) continue;

    const execDate = new Date(exec.completedAt);
    let bucketKey: string;

    if (granularity === 'week') {
      // Find which week bucket this falls into
      const daysSinceStart = Math.floor((execDate.getTime() - since.getTime()) / msPerDay);
      const weekIndex = Math.floor(daysSinceStart / 7);
      const weekStart = new Date(since.getTime() + weekIndex * msPerWeek);
      weekStart.setHours(0, 0, 0, 0);
      bucketKey = weekStart.toISOString().split('T')[0];
    } else {
      const d = new Date(execDate);
      d.setHours(0, 0, 0, 0);
      bucketKey = d.toISOString().split('T')[0];
    }

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { totalFirstPass: 0, passedFirstPass: 0, date: new Date(bucketKey) });
    }

    const bucket = buckets.get(bucketKey)!;
    if (!exec.isRework) {
      bucket.totalFirstPass++;
      if (exec.result === 'pass') {
        bucket.passedFirstPass++;
      }
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      date: data.date.toISOString(),
      dateLabel: data.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      fpy: data.totalFirstPass > 0
        ? Math.round((data.passedFirstPass / data.totalFirstPass) * 1000) / 10
        : 100,
      totalFirstPass: data.totalFirstPass,
      passedFirstPass: data.passedFirstPass,
    }));
}

// ============================================================================
// FPY by Step (Process Sequence)
// ============================================================================

export async function getFPYByStep(days: number = 30): Promise<StepFPY[]> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      isRework: true,
      result: true,
      operation: {
        select: { sequence: true, station: { select: { name: true } } },
      },
    },
  });

  const stepMap = new Map<number, {
    stationName: string;
    totalFirstPass: number;
    passedFirstPass: number;
  }>();

  for (const exec of executions) {
    const seq = exec.operation.sequence;
    if (!stepMap.has(seq)) {
      stepMap.set(seq, {
        stationName: exec.operation.station.name,
        totalFirstPass: 0,
        passedFirstPass: 0,
      });
    }

    const entry = stepMap.get(seq)!;
    if (!exec.isRework) {
      entry.totalFirstPass++;
      if (exec.result === 'pass') {
        entry.passedFirstPass++;
      }
    }
  }

  return Array.from(stepMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([sequence, data]) => ({
      sequence,
      stationName: data.stationName,
      fpy: data.totalFirstPass > 0
        ? Math.round((data.passedFirstPass / data.totalFirstPass) * 1000) / 10
        : 100,
      totalFirstPass: data.totalFirstPass,
      passedFirstPass: data.passedFirstPass,
    }));
}

// ============================================================================
// Overall FPY
// ============================================================================

export async function getOverallFPY(days: number = 30): Promise<OverallFPYResult> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      completedAt: { gte: since },
      result: { not: null },
    },
    select: {
      isRework: true,
      result: true,
    },
  });

  const firstPass = executions.filter((e) => !e.isRework);
  const passed = firstPass.filter((e) => e.result === 'pass');

  return {
    fpy: firstPass.length > 0
      ? Math.round((passed.length / firstPass.length) * 1000) / 10
      : 100,
    totalFirstPass: firstPass.length,
    passedFirstPass: passed.length,
  };
}
