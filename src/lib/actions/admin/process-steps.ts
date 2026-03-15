'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import type { DataFieldDefinition } from '@/lib/types/process-steps';

/**
 * Get all process step definitions, grouped by category
 */
export async function getProcessStepDefinitions() {
  await requireRole(['admin']);

  const definitions = await prisma.processStepDefinition.findMany({
    include: {
      station: {
        select: { id: true, name: true, stationType: true },
      },
      _count: {
        select: { dataCaptures: true },
      },
    },
    orderBy: [{ category: 'asc' }, { sequenceOrder: 'asc' }],
  });

  return definitions;
}

/**
 * Create a new process step definition
 */
export async function createProcessStepDefinition(data: {
  name: string;
  description?: string;
  category: string;
  stationId?: string;
  sequenceOrder?: number;
  isMandatory?: boolean;
  requiresSignoff?: boolean;
  triggersQc?: boolean;
  cycleTimeTarget?: number;
  dataFields?: DataFieldDefinition[];
}) {
  const user = await requireRole(['admin']);

  const definition = await prisma.processStepDefinition.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      stationId: data.stationId ?? null,
      sequenceOrder: data.sequenceOrder ?? 0,
      isMandatory: data.isMandatory ?? true,
      requiresSignoff: data.requiresSignoff ?? false,
      triggersQc: data.triggersQc ?? false,
      cycleTimeTarget: data.cycleTimeTarget ?? null,
      dataFields: (data.dataFields ?? []) as object[],
      active: true,
    },
  });

  // Determine siteId for event
  let siteId = 'unknown';
  if (data.stationId) {
    const station = await prisma.station.findUnique({
      where: { id: data.stationId },
      select: { siteId: true },
    });
    siteId = station?.siteId ?? 'unknown';
  } else {
    const site = await prisma.site.findFirst({ where: { active: true }, select: { id: true } });
    siteId = site?.id ?? 'unknown';
  }

  await logAuditTrail(user.id, 'create', 'ProcessStepDefinition', definition.id, null, {
    name: data.name,
    category: data.category,
    stationId: data.stationId,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    stationId: data.stationId,
    operatorId: user.id,
    payload: {
      action: 'process_step_created',
      definitionId: definition.id,
      name: data.name,
      category: data.category,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/process-steps');
  revalidatePath('/station');
  revalidatePath('/dashboard');

  return definition;
}

/**
 * Update a process step definition
 */
export async function updateProcessStepDefinition(
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    stationId?: string | null;
    sequenceOrder?: number;
    isMandatory?: boolean;
    requiresSignoff?: boolean;
    triggersQc?: boolean;
    cycleTimeTarget?: number | null;
    dataFields?: DataFieldDefinition[];
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.processStepDefinition.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Process step definition not found');
  }

  const definition = await prisma.processStepDefinition.update({
    where: { id },
    data: {
      ...data,
      dataFields: data.dataFields ? (data.dataFields as object[]) : undefined,
    },
  });

  // Determine siteId for event
  const stationId = data.stationId !== undefined ? data.stationId : existing.stationId;
  let siteId = 'unknown';
  if (stationId) {
    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { siteId: true },
    });
    siteId = station?.siteId ?? 'unknown';
  } else {
    const site = await prisma.site.findFirst({ where: { active: true }, select: { id: true } });
    siteId = site?.id ?? 'unknown';
  }

  await logAuditTrail(user.id, 'update', 'ProcessStepDefinition', id, {
    name: existing.name,
    category: existing.category,
    active: existing.active,
  }, {
    ...data,
    dataFields: undefined, // Don't log full field defs in audit
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    stationId: stationId,
    operatorId: user.id,
    payload: {
      action: 'process_step_updated',
      definitionId: id,
      name: definition.name,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/process-steps');
  revalidatePath('/station');
  revalidatePath('/dashboard');

  return definition;
}

/**
 * Get step definitions assigned to a specific station
 */
export async function getStepDefinitionsForStation(stationId: string) {
  const definitions = await prisma.processStepDefinition.findMany({
    where: {
      stationId,
      active: true,
    },
    orderBy: [{ sequenceOrder: 'asc' }],
  });

  return definitions;
}

/**
 * Get all stations for admin forms
 */
export async function getStationsForProcessSteps() {
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
