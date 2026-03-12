'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgingBucket {
  label: string;
  minHours: number;
  maxHours: number | null;
  count: number;
  ncrIds: string[];
  ncrNumbers: string[];
}

export interface NCRAgingSummary {
  buckets: AgingBucket[];
  averageDaysOpen: number;
  totalOpen: number;
}

export interface NCRSeverityCount {
  severity: string;
  count: number;
}

export interface NCRTrendPoint {
  date: string;
  created: number;
  closed: number;
  openCumulative: number;
}

export interface NCRDefectTypeEntry {
  defectType: string;
  count: number;
  percentage: number;
}

export interface NCRStationEntry {
  stationId: string;
  stationName: string;
  count: number;
}

export interface NCRSourceBreakdown {
  source: string;
  count: number;
}

export interface NCRDispositionEntry {
  disposition: string;
  count: number;
}

export interface NCRResponseTimeEntry {
  severity: string;
  avgHours: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Calculate aging buckets for open NCRs.
 */
export async function getNCRAgingSummary(): Promise<NCRAgingSummary> {
  await requireRole(['admin', 'supervisor']);

  const openNCRs = await prisma.nonconformanceRecord.findMany({
    where: { status: 'open' },
    select: { id: true, ncrNumber: true, createdAt: true },
  });

  const now = new Date();

  const bucketDefs: { label: string; minHours: number; maxHours: number | null }[] = [
    { label: '<24h', minHours: 0, maxHours: 24 },
    { label: '1-3 days', minHours: 24, maxHours: 72 },
    { label: '3-7 days', minHours: 72, maxHours: 168 },
    { label: '7-14 days', minHours: 168, maxHours: 336 },
    { label: '14-30 days', minHours: 336, maxHours: 720 },
    { label: '>30 days', minHours: 720, maxHours: null },
  ];

  const buckets: AgingBucket[] = bucketDefs.map((def) => ({
    ...def,
    count: 0,
    ncrIds: [],
    ncrNumbers: [],
  }));

  let totalHoursOpen = 0;

  for (const ncr of openNCRs) {
    const hours = hoursBetween(ncr.createdAt, now);
    totalHoursOpen += hours;

    for (const bucket of buckets) {
      if (hours >= bucket.minHours && (bucket.maxHours === null || hours < bucket.maxHours)) {
        bucket.count++;
        bucket.ncrIds.push(ncr.id);
        bucket.ncrNumbers.push(ncr.ncrNumber ?? ncr.id.slice(0, 8));
        break;
      }
    }
  }

  return {
    buckets,
    averageDaysOpen:
      openNCRs.length > 0
        ? Math.round((totalHoursOpen / openNCRs.length / 24) * 10) / 10
        : 0,
    totalOpen: openNCRs.length,
  };
}

/**
 * Count of open NCRs by severity.
 */
export async function getNCRBySeverity(): Promise<NCRSeverityCount[]> {
  await requireRole(['admin', 'supervisor']);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: { status: { in: ['open', 'dispositioned'] } },
    select: { id: true, defectType: true },
  });

  // Since severity field may not exist yet, derive from defectType heuristic
  // or use a raw query. We'll use groupBy on the field if available.
  // The task states severity exists, so use it via raw SQL to be safe.
  const results = await prisma.$queryRaw<{ severity: string; count: bigint }[]>`
    SELECT COALESCE(severity, 'minor') as severity, COUNT(*)::bigint as count
    FROM nonconformance_records
    WHERE status IN ('open', 'dispositioned')
    GROUP BY COALESCE(severity, 'minor')
    ORDER BY
      CASE COALESCE(severity, 'minor')
        WHEN 'critical' THEN 1
        WHEN 'major' THEN 2
        WHEN 'minor' THEN 3
        ELSE 4
      END
  `;

  return results.map((r) => ({
    severity: r.severity,
    count: Number(r.count),
  }));
}

/**
 * NCR creation and closure trend over time.
 */
export async function getNCRTrend(days: number = 30): Promise<NCRTrendPoint[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const [allNCRs, openBeforePeriod] = await Promise.all([
    prisma.nonconformanceRecord.findMany({
      where: {
        OR: [
          { createdAt: { gte: since } },
          { closedAt: { gte: since } },
        ],
      },
      select: { createdAt: true, closedAt: true },
    }),
    prisma.nonconformanceRecord.count({
      where: {
        createdAt: { lt: since },
        OR: [{ closedAt: null }, { closedAt: { gte: since } }],
      },
    }),
  ]);

  // Build day-by-day map
  const dayMap = new Map<string, { created: number; closed: number }>();

  // Initialize all days in the range
  for (let d = 0; d <= days; d++) {
    const date = new Date(since.getTime() + d * 24 * 60 * 60 * 1000);
    dayMap.set(dateKey(date), { created: 0, closed: 0 });
  }

  for (const ncr of allNCRs) {
    if (ncr.createdAt >= since) {
      const key = dateKey(ncr.createdAt);
      const entry = dayMap.get(key);
      if (entry) entry.created++;
    }
    if (ncr.closedAt && ncr.closedAt >= since) {
      const key = dateKey(ncr.closedAt);
      const entry = dayMap.get(key);
      if (entry) entry.closed++;
    }
  }

  // Build cumulative trend
  const trend: NCRTrendPoint[] = [];
  let cumulative = openBeforePeriod;

  const sortedKeys = [...dayMap.keys()].sort();
  for (const key of sortedKeys) {
    const entry = dayMap.get(key)!;
    cumulative += entry.created - entry.closed;
    trend.push({
      date: key,
      created: entry.created,
      closed: entry.closed,
      openCumulative: cumulative,
    });
  }

  return trend;
}

/**
 * Pareto data: count by defectType, sorted desc. Include percentage.
 */
export async function getNCRByDefectType(days: number = 90): Promise<NCRDefectTypeEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: { createdAt: { gte: since } },
    select: { defectType: true },
  });

  const counts = new Map<string, number>();
  for (const ncr of ncrs) {
    counts.set(ncr.defectType, (counts.get(ncr.defectType) ?? 0) + 1);
  }

  const total = ncrs.length;
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([defectType, count]) => ({
      defectType,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

  return sorted;
}

/**
 * Count by station, include station name.
 */
export async function getNCRByStation(days: number = 90): Promise<NCRStationEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: {
      createdAt: { gte: since },
      stationId: { not: null },
    },
    select: {
      stationId: true,
      station: { select: { name: true } },
    },
  });

  const counts = new Map<string, { name: string; count: number }>();
  for (const ncr of ncrs) {
    if (!ncr.stationId) continue;
    const existing = counts.get(ncr.stationId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(ncr.stationId, {
        name: ncr.station?.name ?? 'Unknown',
        count: 1,
      });
    }
  }

  return [...counts.entries()]
    .map(([stationId, data]) => ({
      stationId,
      stationName: data.name,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Breakdown by source (production vs iqc).
 */
export async function getNCRBySource(days: number = 90): Promise<NCRSourceBreakdown[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: { createdAt: { gte: since } },
    select: { source: true },
  });

  const counts = new Map<string, number>();
  for (const ncr of ncrs) {
    counts.set(ncr.source, (counts.get(ncr.source) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Count by disposition type (rework/scrap/use_as_is/defer).
 */
export async function getNCRDispositionBreakdown(days: number = 90): Promise<NCRDispositionEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const since = sinceDate(days);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: {
      createdAt: { gte: since },
      disposition: { not: null },
    },
    select: { disposition: true },
  });

  const counts = new Map<string, number>();
  for (const ncr of ncrs) {
    if (ncr.disposition) {
      counts.set(ncr.disposition, (counts.get(ncr.disposition) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([disposition, count]) => ({ disposition, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Average time from creation to disposition, by severity.
 */
export async function getNCRResponseTime(): Promise<NCRResponseTimeEntry[]> {
  await requireRole(['admin', 'supervisor']);

  const results = await prisma.$queryRaw<
    { severity: string; avg_hours: number; count: bigint }[]
  >`
    SELECT
      COALESCE(severity, 'minor') as severity,
      EXTRACT(EPOCH FROM AVG(
        COALESCE(closed_at, updated_at) - created_at
      )) / 3600.0 as avg_hours,
      COUNT(*)::bigint as count
    FROM nonconformance_records
    WHERE status IN ('dispositioned', 'closed')
      AND disposition IS NOT NULL
    GROUP BY COALESCE(severity, 'minor')
    ORDER BY
      CASE COALESCE(severity, 'minor')
        WHEN 'critical' THEN 1
        WHEN 'major' THEN 2
        WHEN 'minor' THEN 3
        ELSE 4
      END
  `;

  return results.map((r) => ({
    severity: r.severity,
    avgHours: Math.round(Number(r.avg_hours) * 10) / 10,
    count: Number(r.count),
  }));
}
