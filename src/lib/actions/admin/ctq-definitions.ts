'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';

async function getDefaultSiteId(): Promise<string> {
  const site = await prisma.site.findFirst({ where: { active: true }, select: { id: true } });
  return site?.id ?? 'unknown';
}

export async function getCTQDefinitions(partNumber?: string, revision?: string) {
  await requireRole(['admin']);

  const where: Record<string, unknown> = {};
  if (partNumber) where.partNumber = partNumber;
  if (revision) where.revision = revision;

  const definitions = await prisma.cTQDefinition.findMany({
    where,
    include: {
      _count: {
        select: { measurements: true },
      },
    },
    orderBy: [{ partNumber: 'asc' }, { revision: 'asc' }, { dimensionName: 'asc' }],
  });

  return definitions;
}

export async function getCTQsForPart(partNumber: string, revision: string) {
  const definitions = await prisma.cTQDefinition.findMany({
    where: {
      partNumber,
      revision,
      active: true,
    },
    orderBy: { dimensionName: 'asc' },
  });

  return definitions;
}

export async function createCTQDefinition(data: {
  partNumber: string;
  revision: string;
  dimensionName: string;
  nominal: number;
  usl: number;
  lsl: number;
  unitOfMeasure: string;
  measurementTool?: string;
  methodNote?: string;
  sampleSizeRule: string;
  sampleSize?: number;
  safetyCritical: boolean;
}) {
  const user = await requireRole(['admin']);

  // Validate USL > LSL
  if (data.usl <= data.lsl) {
    throw new Error('Upper specification limit (USL) must be greater than lower specification limit (LSL)');
  }

  // Validate nominal is between LSL and USL
  if (data.nominal < data.lsl || data.nominal > data.usl) {
    throw new Error('Nominal value must be between LSL and USL');
  }

  // Validate sample size for fixed_count rule
  if (data.sampleSizeRule === 'fixed_count' && (!data.sampleSize || data.sampleSize < 1)) {
    throw new Error('Sample size is required for fixed count rule and must be at least 1');
  }

  const definition = await prisma.cTQDefinition.create({
    data: {
      partNumber: data.partNumber,
      revision: data.revision,
      dimensionName: data.dimensionName,
      nominal: data.nominal,
      usl: data.usl,
      lsl: data.lsl,
      unitOfMeasure: data.unitOfMeasure,
      measurementTool: data.measurementTool || null,
      methodNote: data.methodNote || null,
      sampleSizeRule: data.sampleSizeRule,
      sampleSize: data.sampleSizeRule === 'fixed_count' ? data.sampleSize : null,
      safetyCritical: data.safetyCritical,
      active: true,
    },
  });

  const siteId = await getDefaultSiteId();
  await logAuditTrail(user.id, 'create', 'CTQDefinition', definition.id, null, {
    partNumber: data.partNumber,
    revision: data.revision,
    dimensionName: data.dimensionName,
    nominal: data.nominal,
    usl: data.usl,
    lsl: data.lsl,
  });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'ctq_definition_created',
      definitionId: definition.id,
      partNumber: data.partNumber,
      dimensionName: data.dimensionName,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/ctq');
  return definition;
}

export async function updateCTQDefinition(
  id: string,
  data: {
    dimensionName?: string;
    nominal?: number;
    usl?: number;
    lsl?: number;
    unitOfMeasure?: string;
    measurementTool?: string | null;
    methodNote?: string | null;
    sampleSizeRule?: string;
    sampleSize?: number | null;
    safetyCritical?: boolean;
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.cTQDefinition.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('CTQ definition not found');
  }

  // Use provided or existing values for validation
  const usl = data.usl ?? existing.usl;
  const lsl = data.lsl ?? existing.lsl;
  const nominal = data.nominal ?? existing.nominal;

  if (usl <= lsl) {
    throw new Error('Upper specification limit (USL) must be greater than lower specification limit (LSL)');
  }

  if (nominal < lsl || nominal > usl) {
    throw new Error('Nominal value must be between LSL and USL');
  }

  const sampleSizeRule = data.sampleSizeRule ?? existing.sampleSizeRule;
  if (sampleSizeRule === 'fixed_count') {
    const sampleSize = data.sampleSize ?? existing.sampleSize;
    if (!sampleSize || sampleSize < 1) {
      throw new Error('Sample size is required for fixed count rule and must be at least 1');
    }
  }

  const updateData: Record<string, unknown> = { ...data };
  // Clear sampleSize if rule is not fixed_count
  if (data.sampleSizeRule && data.sampleSizeRule !== 'fixed_count') {
    updateData.sampleSize = null;
  }

  const definition = await prisma.cTQDefinition.update({
    where: { id },
    data: updateData,
  });

  const siteId = await getDefaultSiteId();
  await logAuditTrail(user.id, 'update', 'CTQDefinition', id, {
    dimensionName: existing.dimensionName,
    nominal: existing.nominal,
    usl: existing.usl,
    lsl: existing.lsl,
    active: existing.active,
  }, {
    ...data,
  });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'ctq_definition_updated',
      definitionId: id,
      partNumber: definition.partNumber,
      dimensionName: definition.dimensionName,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/ctq');
  return definition;
}

export async function copyCTQsToNewRevision(
  partNumber: string,
  fromRevision: string,
  toRevision: string
) {
  const user = await requireRole(['admin']);

  // Get all active CTQs for the source revision
  const sourceCTQs = await prisma.cTQDefinition.findMany({
    where: { partNumber, revision: fromRevision, active: true },
  });

  if (sourceCTQs.length === 0) {
    throw new Error(`No active CTQ definitions found for part ${partNumber} revision ${fromRevision}`);
  }

  // Check if target revision already has CTQs
  const existingTarget = await prisma.cTQDefinition.findMany({
    where: { partNumber, revision: toRevision },
  });

  if (existingTarget.length > 0) {
    throw new Error(`CTQ definitions already exist for part ${partNumber} revision ${toRevision}. Delete them first or update individually.`);
  }

  // Copy all CTQs
  const created = await prisma.$transaction(
    sourceCTQs.map((ctq) =>
      prisma.cTQDefinition.create({
        data: {
          partNumber: ctq.partNumber,
          revision: toRevision,
          dimensionName: ctq.dimensionName,
          nominal: ctq.nominal,
          usl: ctq.usl,
          lsl: ctq.lsl,
          unitOfMeasure: ctq.unitOfMeasure,
          measurementTool: ctq.measurementTool,
          methodNote: ctq.methodNote,
          sampleSizeRule: ctq.sampleSizeRule,
          sampleSize: ctq.sampleSize,
          safetyCritical: ctq.safetyCritical,
          source: ctq.source,
          active: true,
        },
      })
    )
  );

  const siteId = await getDefaultSiteId();
  await logAuditTrail(user.id, 'create', 'CTQDefinition', `bulk-copy-${partNumber}-${toRevision}`, null, {
    partNumber,
    fromRevision,
    toRevision,
    count: created.length,
  });
  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'ctq_definitions_copied',
      partNumber,
      fromRevision,
      toRevision,
      count: created.length,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/ctq');
  return created;
}

export async function getDistinctPartNumbers() {
  const results = await prisma.cTQDefinition.findMany({
    select: { partNumber: true, revision: true },
    distinct: ['partNumber', 'revision'],
    orderBy: [{ partNumber: 'asc' }, { revision: 'asc' }],
  });

  return results;
}
