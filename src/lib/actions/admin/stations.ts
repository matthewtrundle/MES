'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import type { StationType } from '@/lib/types/stations';

export async function getStationsForAdmin(siteId?: string) {
  await requireRole(['admin']);

  const stations = await prisma.station.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          operations: true,
          unitExecutions: true,
          downtimeIntervals: true,
        },
      },
    },
    orderBy: [{ siteId: 'asc' }, { sequenceOrder: 'asc' }],
  });

  return stations;
}

export async function createStation(data: {
  siteId: string;
  name: string;
  stationType: StationType;
  sequenceOrder: number;
  config?: Record<string, unknown>;
}) {
  const user = await requireRole(['admin']);

  const station = await prisma.station.create({
    data: {
      siteId: data.siteId,
      name: data.name,
      stationType: data.stationType,
      sequenceOrder: data.sequenceOrder,
      config: (data.config ?? {}) as Prisma.InputJsonValue,
      active: true,
    },
  });

  await logAuditTrail(user.id, 'create', 'Station', station.id, null, { name: data.name, stationType: data.stationType });
  await emitEvent({
    eventType: 'config_changed',
    siteId: data.siteId,
    operatorId: user.id,
    payload: { action: 'station_created', stationId: station.id, name: data.name },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/stations');
  revalidatePath('/station');

  return station;
}

export async function updateStation(
  id: string,
  data: {
    name?: string;
    stationType?: StationType;
    sequenceOrder?: number;
    config?: Record<string, unknown>;
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.station.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Station not found');
  }

  const station = await prisma.station.update({
    where: { id },
    data: {
      ...data,
      config: data.config as Prisma.InputJsonValue | undefined,
    },
  });

  await logAuditTrail(user.id, 'update', 'Station', id, { name: existing.name, stationType: existing.stationType, active: existing.active }, data);
  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.siteId,
    operatorId: user.id,
    payload: { action: 'station_updated', stationId: id, changes: JSON.parse(JSON.stringify(data)) },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/stations');
  revalidatePath('/station');

  return station;
}

export async function deleteStation(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.station.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          operations: true,
          unitExecutions: true,
          downtimeIntervals: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Station not found');
  }

  const totalUsage =
    existing._count.operations +
    existing._count.unitExecutions +
    existing._count.downtimeIntervals;

  // If station has been used, soft delete (deactivate) instead of hard delete
  if (totalUsage > 0) {
    await prisma.station.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.station.delete({
      where: { id },
    });
  }

  const action = totalUsage > 0 ? 'station_deactivated' : 'station_deleted';
  await logAuditTrail(user.id, 'delete', 'Station', id, { name: existing.name, stationType: existing.stationType }, null);
  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.siteId,
    operatorId: user.id,
    payload: { action, stationId: id, name: existing.name },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/stations');
  revalidatePath('/station');
}

export async function reorderStations(siteId: string, stationOrder: string[]) {
  const user = await requireRole(['admin']);

  // Update each station with its new sequence order
  await prisma.$transaction(
    stationOrder.map((stationId, index) =>
      prisma.station.update({
        where: { id: stationId },
        data: { sequenceOrder: index + 1 },
      })
    )
  );

  await logAuditTrail(user.id, 'config_change', 'Station', siteId, null, { stationOrder });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: { action: 'stations_reordered', stationOrder },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/stations');
  revalidatePath('/station');
}

export async function getNextSequenceOrder(siteId: string): Promise<number> {
  const maxStation = await prisma.station.findFirst({
    where: { siteId },
    orderBy: { sequenceOrder: 'desc' },
    select: { sequenceOrder: true },
  });

  return (maxStation?.sequenceOrder ?? 0) + 1;
}
