'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireUser } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

/**
 * Get downtime reasons for a site
 */
export async function getDowntimeReasons(siteId: string) {
  const reasons = await prisma.downtimeReason.findMany({
    where: {
      siteId,
      active: true,
    },
    orderBy: [{ isPlanned: 'asc' }, { code: 'asc' }],
  });

  return reasons;
}

/**
 * Start a downtime interval at a station
 */
export async function startDowntime(stationId: string, notes?: string) {
  const user = await requireUser();

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { site: true },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  // Check if there's already active downtime at this station
  const activeDowntime = await prisma.downtimeInterval.findFirst({
    where: {
      stationId,
      endedAt: null,
    },
  });

  if (activeDowntime) {
    throw new Error('Downtime is already active at this station');
  }

  const downtime = await prisma.downtimeInterval.create({
    data: {
      stationId,
      operatorId: user.id,
      startedAt: new Date(),
      notes,
    },
  });

  await emitEvent({
    eventType: 'downtime_started',
    siteId: station.siteId,
    stationId,
    operatorId: user.id,
    payload: {
      stationName: station.name,
      notes,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('downtime_started', `${stationId}:${downtime.id}`),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return downtime;
}

/**
 * Select a reason for an active downtime
 */
export async function selectDowntimeReason(downtimeId: string, reasonId: string) {
  const user = await requireUser();

  const downtime = await prisma.downtimeInterval.findUnique({
    where: { id: downtimeId },
    include: {
      station: { include: { site: true } },
    },
  });

  if (!downtime) {
    throw new Error('Downtime interval not found');
  }

  if (downtime.endedAt) {
    throw new Error('Cannot update reason for ended downtime');
  }

  const reason = await prisma.downtimeReason.findUnique({
    where: { id: reasonId },
  });

  if (!reason) {
    throw new Error('Downtime reason not found');
  }

  const updatedDowntime = await prisma.downtimeInterval.update({
    where: { id: downtimeId },
    data: { reasonId },
  });

  await emitEvent({
    eventType: 'downtime_reason_selected',
    siteId: downtime.station.siteId,
    stationId: downtime.stationId,
    operatorId: user.id,
    payload: {
      stationName: downtime.station.name,
      reasonCode: reason.code,
      reasonDescription: reason.description,
      lossType: reason.lossType,
      isPlanned: reason.isPlanned,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('downtime_reason_selected', `${downtimeId}:${reasonId}`),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return updatedDowntime;
}

/**
 * End a downtime interval
 */
export async function endDowntime(downtimeId: string, notes?: string) {
  const user = await requireUser();

  const downtime = await prisma.downtimeInterval.findUnique({
    where: { id: downtimeId },
    include: {
      station: { include: { site: true } },
      reason: true,
    },
  });

  if (!downtime) {
    throw new Error('Downtime interval not found');
  }

  if (downtime.endedAt) {
    throw new Error('Downtime has already ended');
  }

  const endedAt = new Date();
  const durationMinutes = Math.round(
    (endedAt.getTime() - downtime.startedAt.getTime()) / 60000
  );

  const updatedDowntime = await prisma.downtimeInterval.update({
    where: { id: downtimeId },
    data: {
      endedAt,
      notes: notes ? (downtime.notes ? `${downtime.notes}\n${notes}` : notes) : downtime.notes,
    },
  });

  await emitEvent({
    eventType: 'downtime_ended',
    siteId: downtime.station.siteId,
    stationId: downtime.stationId,
    operatorId: user.id,
    payload: {
      stationName: downtime.station.name,
      reasonCode: downtime.reason?.code ?? 'UNSPECIFIED',
      reasonDescription: downtime.reason?.description ?? 'No reason specified',
      lossType: downtime.reason?.lossType ?? 'other',
      isPlanned: downtime.reason?.isPlanned ?? false,
      durationMinutes,
      notes,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('downtime_ended', downtimeId),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/supervisor/downtime');

  return updatedDowntime;
}

/**
 * Get active downtime for a station
 */
export async function getActiveDowntime(stationId: string) {
  const downtime = await prisma.downtimeInterval.findFirst({
    where: {
      stationId,
      endedAt: null,
    },
    include: {
      reason: true,
      operator: true,
    },
  });

  return downtime;
}

/**
 * Get downtime intervals for a station within a time range
 */
export async function getStationDowntime(
  stationId: string,
  startTime: Date,
  endTime: Date
) {
  const intervals = await prisma.downtimeInterval.findMany({
    where: {
      stationId,
      startedAt: { gte: startTime },
      OR: [{ endedAt: { lte: endTime } }, { endedAt: null }],
    },
    include: {
      reason: true,
      operator: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  return intervals;
}

/**
 * Get downtime summary by reason (Pareto data)
 */
export async function getDowntimePareto(siteId: string, startTime: Date, endTime: Date) {
  // Get all downtime intervals in the range
  const intervals = await prisma.downtimeInterval.findMany({
    where: {
      station: {
        siteId,
      },
      startedAt: { gte: startTime },
      endedAt: { not: null, lte: endTime },
    },
    include: {
      reason: true,
      station: true,
    },
  });

  // Calculate duration and group by reason
  const reasonTotals: Record<
    string,
    {
      code: string;
      description: string;
      lossType: string;
      isPlanned: boolean;
      totalMinutes: number;
      count: number;
    }
  > = {};

  for (const interval of intervals) {
    const durationMinutes = Math.round(
      ((interval.endedAt as Date).getTime() - interval.startedAt.getTime()) / 60000
    );

    const reasonCode = interval.reason?.code ?? 'UNSPECIFIED';
    const key = reasonCode;

    if (!reasonTotals[key]) {
      reasonTotals[key] = {
        code: reasonCode,
        description: interval.reason?.description ?? 'Unspecified',
        lossType: interval.reason?.lossType ?? 'other',
        isPlanned: interval.reason?.isPlanned ?? false,
        totalMinutes: 0,
        count: 0,
      };
    }

    reasonTotals[key].totalMinutes += durationMinutes;
    reasonTotals[key].count += 1;
  }

  // Convert to array and sort by total minutes (descending)
  const paretoData = Object.values(reasonTotals).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );

  // Calculate cumulative percentage
  const totalDowntimeMinutes = paretoData.reduce((sum, item) => sum + item.totalMinutes, 0);

  let cumulativeMinutes = 0;
  const paretoWithCumulative = paretoData.map((item) => {
    cumulativeMinutes += item.totalMinutes;
    return {
      ...item,
      percentage: totalDowntimeMinutes > 0 ? (item.totalMinutes / totalDowntimeMinutes) * 100 : 0,
      cumulativePercentage: totalDowntimeMinutes > 0 ? (cumulativeMinutes / totalDowntimeMinutes) * 100 : 0,
    };
  });

  return {
    data: paretoWithCumulative,
    totalMinutes: totalDowntimeMinutes,
    intervalCount: intervals.length,
  };
}

/**
 * Get downtime by station summary
 */
export async function getDowntimeByStation(siteId: string, startTime: Date, endTime: Date) {
  const intervals = await prisma.downtimeInterval.findMany({
    where: {
      station: {
        siteId,
      },
      startedAt: { gte: startTime },
      endedAt: { not: null, lte: endTime },
    },
    include: {
      station: true,
      reason: true,
    },
  });

  const stationTotals: Record<
    string,
    {
      stationId: string;
      stationName: string;
      totalMinutes: number;
      plannedMinutes: number;
      unplannedMinutes: number;
      count: number;
    }
  > = {};

  for (const interval of intervals) {
    const durationMinutes = Math.round(
      ((interval.endedAt as Date).getTime() - interval.startedAt.getTime()) / 60000
    );

    const key = interval.stationId;

    if (!stationTotals[key]) {
      stationTotals[key] = {
        stationId: interval.stationId,
        stationName: interval.station.name,
        totalMinutes: 0,
        plannedMinutes: 0,
        unplannedMinutes: 0,
        count: 0,
      };
    }

    stationTotals[key].totalMinutes += durationMinutes;
    stationTotals[key].count += 1;

    if (interval.reason?.isPlanned) {
      stationTotals[key].plannedMinutes += durationMinutes;
    } else {
      stationTotals[key].unplannedMinutes += durationMinutes;
    }
  }

  return Object.values(stationTotals).sort((a, b) => b.totalMinutes - a.totalMinutes);
}
