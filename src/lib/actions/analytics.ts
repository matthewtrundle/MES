'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

/**
 * Get cycle time statistics by station
 */
export async function getCycleTimeByStation(siteId?: string) {
  await requireRole(['admin', 'supervisor']);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      cycleTimeMinutes: { not: null },
      result: 'pass',
      ...(siteId && { station: { siteId } }),
    },
    select: {
      stationId: true,
      station: { select: { name: true, sequenceOrder: true } },
      cycleTimeMinutes: true,
    },
  });

  // Group by station
  const stationStats: Record<string, {
    stationId: string;
    stationName: string;
    sequenceOrder: number;
    avgCycleTime: number;
    minCycleTime: number;
    maxCycleTime: number;
    count: number;
  }> = {};

  for (const exec of executions) {
    const ct = exec.cycleTimeMinutes!;
    if (!stationStats[exec.stationId]) {
      stationStats[exec.stationId] = {
        stationId: exec.stationId,
        stationName: exec.station.name,
        sequenceOrder: exec.station.sequenceOrder,
        avgCycleTime: 0,
        minCycleTime: Infinity,
        maxCycleTime: 0,
        count: 0,
      };
    }

    const s = stationStats[exec.stationId];
    s.count += 1;
    s.avgCycleTime += ct;
    s.minCycleTime = Math.min(s.minCycleTime, ct);
    s.maxCycleTime = Math.max(s.maxCycleTime, ct);
  }

  // Finalize averages
  for (const s of Object.values(stationStats)) {
    s.avgCycleTime = Math.round((s.avgCycleTime / s.count) * 100) / 100;
    s.minCycleTime = Math.round(s.minCycleTime * 100) / 100;
    s.maxCycleTime = Math.round(s.maxCycleTime * 100) / 100;
  }

  return Object.values(stationStats).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * Get cycle time trend for a specific station over time
 */
export async function getCycleTimeTrend(stationId: string, days: number = 7) {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      stationId,
      cycleTimeMinutes: { not: null },
      result: 'pass',
      completedAt: { gte: since },
    },
    select: {
      cycleTimeMinutes: true,
      completedAt: true,
      unit: { select: { serialNumber: true } },
    },
    orderBy: { completedAt: 'asc' },
  });

  return executions.map((e) => ({
    cycleTimeMinutes: e.cycleTimeMinutes!,
    completedAt: e.completedAt!,
    serialNumber: e.unit.serialNumber,
  }));
}

/**
 * Get cycle time outliers (units that took significantly longer than average)
 */
export async function getCycleTimeOutliers(stationId: string, stdDevMultiplier: number = 2) {
  await requireRole(['admin', 'supervisor']);

  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      stationId,
      cycleTimeMinutes: { not: null },
      result: 'pass',
    },
    select: {
      id: true,
      cycleTimeMinutes: true,
      completedAt: true,
      unit: { select: { serialNumber: true } },
      operator: { select: { name: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  if (executions.length < 5) return [];

  const cycleTimes = executions.map((e) => e.cycleTimeMinutes!);
  const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
  const variance = cycleTimes.reduce((a, b) => a + (b - avg) ** 2, 0) / cycleTimes.length;
  const stdDev = Math.sqrt(variance);
  const threshold = avg + stdDevMultiplier * stdDev;

  return executions
    .filter((e) => e.cycleTimeMinutes! > threshold)
    .map((e) => ({
      ...e,
      cycleTimeMinutes: e.cycleTimeMinutes!,
      deviationFromAvg: Math.round(((e.cycleTimeMinutes! - avg) / avg) * 100),
    }));
}
