'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
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
  await requireRole(['admin']);

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
  await requireRole(['admin']);

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

  revalidatePath('/admin/stations');
  revalidatePath('/station');

  return station;
}

export async function deleteStation(id: string) {
  await requireRole(['admin']);

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

  revalidatePath('/admin/stations');
  revalidatePath('/station');
}

export async function reorderStations(siteId: string, stationOrder: string[]) {
  await requireRole(['admin']);

  // Update each station with its new sequence order
  await prisma.$transaction(
    stationOrder.map((stationId, index) =>
      prisma.station.update({
        where: { id: stationId },
        data: { sequenceOrder: index + 1 },
      })
    )
  );

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
