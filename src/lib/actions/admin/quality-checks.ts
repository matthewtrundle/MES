'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import type {
  CheckType,
  MeasurementParameters,
  ChecklistParameters,
  PassFailParameters,
} from '@/lib/types/quality-checks';

export async function getQualityCheckDefinitions() {
  await requireRole(['admin']);

  const definitions = await prisma.qualityCheckDefinition.findMany({
    include: {
      _count: {
        select: {
          results: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return definitions;
}

export async function createQualityCheckDefinition(data: {
  name: string;
  checkType: CheckType;
  parameters: MeasurementParameters | ChecklistParameters | PassFailParameters;
  stationIds: string[];
}) {
  await requireRole(['admin']);

  const definition = await prisma.qualityCheckDefinition.create({
    data: {
      name: data.name,
      checkType: data.checkType,
      parameters: data.parameters as object,
      stationIds: data.stationIds,
      active: true,
    },
  });

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');

  return definition;
}

export async function updateQualityCheckDefinition(
  id: string,
  data: {
    name?: string;
    checkType?: CheckType;
    parameters?: MeasurementParameters | ChecklistParameters | PassFailParameters;
    stationIds?: string[];
    active?: boolean;
  }
) {
  await requireRole(['admin']);

  const existing = await prisma.qualityCheckDefinition.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Quality check definition not found');
  }

  const definition = await prisma.qualityCheckDefinition.update({
    where: { id },
    data: {
      ...data,
      parameters: data.parameters as object | undefined,
    },
  });

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');

  return definition;
}

export async function deleteQualityCheckDefinition(id: string) {
  await requireRole(['admin']);

  const existing = await prisma.qualityCheckDefinition.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          results: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Quality check definition not found');
  }

  // If definition has been used, soft delete (deactivate) instead of hard delete
  if (existing._count.results > 0) {
    await prisma.qualityCheckDefinition.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.qualityCheckDefinition.delete({
      where: { id },
    });
  }

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');
}

export async function getStationsForQualityChecks() {
  const stations = await prisma.station.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      stationType: true,
      site: {
        select: { name: true },
      },
    },
    orderBy: [{ siteId: 'asc' }, { sequenceOrder: 'asc' }],
  });

  return stations;
}
