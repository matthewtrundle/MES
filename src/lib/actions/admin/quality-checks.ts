'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import type {
  CheckType,
  MeasurementParameters,
  ChecklistParameters,
  PassFailParameters,
} from '@/lib/types/quality-checks';

async function getSiteIdFromStations(stationIds: string[]): Promise<string> {
  if (stationIds.length === 0) {
    const site = await prisma.site.findFirst({ where: { active: true }, select: { id: true } });
    return site?.id ?? 'unknown';
  }
  const station = await prisma.station.findUnique({ where: { id: stationIds[0] }, select: { siteId: true } });
  return station?.siteId ?? 'unknown';
}

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
  const user = await requireRole(['admin']);

  const definition = await prisma.qualityCheckDefinition.create({
    data: {
      name: data.name,
      checkType: data.checkType,
      parameters: data.parameters as object,
      stationIds: data.stationIds,
      active: true,
    },
  });

  const siteId = await getSiteIdFromStations(data.stationIds);
  await logAuditTrail(user.id, 'create', 'QualityCheckDefinition', definition.id, null, { name: data.name, checkType: data.checkType });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: { action: 'quality_check_created', definitionId: definition.id, name: data.name },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/quality');

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
  const user = await requireRole(['admin']);

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

  const siteId = await getSiteIdFromStations(data.stationIds ?? existing.stationIds);
  await logAuditTrail(user.id, 'update', 'QualityCheckDefinition', id, { name: existing.name, checkType: existing.checkType, active: existing.active }, { ...data, parameters: undefined });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: { action: 'quality_check_updated', definitionId: id, name: definition.name },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/quality');

  return definition;
}

export async function deleteQualityCheckDefinition(id: string) {
  const user = await requireRole(['admin']);

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

  const action = existing._count.results > 0 ? 'quality_check_deactivated' : 'quality_check_deleted';
  const siteId = await getSiteIdFromStations(existing.stationIds);
  await logAuditTrail(user.id, 'delete', 'QualityCheckDefinition', id, { name: existing.name, checkType: existing.checkType }, null);
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: { action, definitionId: id, name: existing.name },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/quality-checks');
  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/quality');
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
