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

/**
 * Record a CTQ measurement and auto-evaluate pass/fail against USL/LSL
 */
export async function recordCTQMeasurement(data: {
  ctqDefinitionId: string;
  materialLotId?: string;
  sampleNumber: number;
  measuredValue: number;
  notes?: string;
}) {
  const user = await requireRole(['operator', 'supervisor', 'admin']);

  // Look up the CTQ definition to evaluate pass/fail
  const ctqDef = await prisma.cTQDefinition.findUnique({
    where: { id: data.ctqDefinitionId },
  });

  if (!ctqDef) {
    throw new Error('CTQ definition not found');
  }

  if (!ctqDef.active) {
    throw new Error('CTQ definition is inactive');
  }

  // Auto-evaluate: pass if measuredValue is between LSL and USL (inclusive)
  const result = data.measuredValue >= ctqDef.lsl && data.measuredValue <= ctqDef.usl
    ? 'pass'
    : 'fail';

  const measurement = await prisma.cTQMeasurement.create({
    data: {
      ctqDefinitionId: data.ctqDefinitionId,
      materialLotId: data.materialLotId || null,
      sampleNumber: data.sampleNumber,
      measuredValue: data.measuredValue,
      result,
      inspectorId: user.id,
      notes: data.notes || null,
    },
  });

  const siteId = await getDefaultSiteId();
  await logAuditTrail(user.id, 'create', 'CTQMeasurement', measurement.id, null, {
    ctqDefinitionId: data.ctqDefinitionId,
    partNumber: ctqDef.partNumber,
    dimensionName: ctqDef.dimensionName,
    measuredValue: data.measuredValue,
    result,
    materialLotId: data.materialLotId,
  });

  await emitEvent({
    eventType: 'ctq_measurement_recorded',
    siteId,
    operatorId: user.id,
    payload: {
      measurementId: measurement.id,
      ctqDefinitionId: data.ctqDefinitionId,
      partNumber: ctqDef.partNumber,
      dimensionName: ctqDef.dimensionName,
      nominal: ctqDef.nominal,
      usl: ctqDef.usl,
      lsl: ctqDef.lsl,
      measuredValue: data.measuredValue,
      result,
      safetyCritical: ctqDef.safetyCritical,
      materialLotId: data.materialLotId,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/ctq');
  return { ...measurement, result };
}

/**
 * Get all CTQ measurements for a material lot
 */
export async function getMeasurementsForLot(materialLotId: string) {
  await requireRole(['operator', 'supervisor', 'admin']);

  const measurements = await prisma.cTQMeasurement.findMany({
    where: { materialLotId },
    include: {
      ctqDefinition: true,
      inspector: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ ctqDefinition: { dimensionName: 'asc' } }, { sampleNumber: 'asc' }],
  });

  return measurements;
}

/**
 * Evaluate lot conformance: check if all required CTQ measurements pass
 */
export async function evaluateLotConformance(materialLotId: string) {
  await requireRole(['operator', 'supervisor', 'admin']);

  // Get the lot to find its material code
  const lot = await prisma.materialLot.findUnique({
    where: { id: materialLotId },
  });

  if (!lot) {
    throw new Error('Material lot not found');
  }

  // Get all measurements for this lot
  const measurements = await prisma.cTQMeasurement.findMany({
    where: { materialLotId },
    include: {
      ctqDefinition: true,
    },
  });

  // Get all CTQ definitions that might apply (based on measurements recorded)
  const ctqDefIds = [...new Set(measurements.map((m) => m.ctqDefinitionId))];
  const ctqDefs = await prisma.cTQDefinition.findMany({
    where: { id: { in: ctqDefIds }, active: true },
  });

  // Check conformance
  const results = ctqDefs.map((def) => {
    const defMeasurements = measurements.filter((m) => m.ctqDefinitionId === def.id);
    const passCount = defMeasurements.filter((m) => m.result === 'pass').length;
    const failCount = defMeasurements.filter((m) => m.result === 'fail').length;
    const totalCount = defMeasurements.length;

    return {
      ctqDefinitionId: def.id,
      dimensionName: def.dimensionName,
      partNumber: def.partNumber,
      revision: def.revision,
      nominal: def.nominal,
      usl: def.usl,
      lsl: def.lsl,
      unitOfMeasure: def.unitOfMeasure,
      safetyCritical: def.safetyCritical,
      sampleSizeRule: def.sampleSizeRule,
      sampleSize: def.sampleSize,
      totalMeasurements: totalCount,
      passCount,
      failCount,
      conforming: failCount === 0 && totalCount > 0,
    };
  });

  const overallConforming = results.every((r) => r.conforming);
  const hasSafetyCriticalFailure = results.some((r) => r.safetyCritical && !r.conforming);

  return {
    materialLotId,
    lotNumber: lot.lotNumber,
    materialCode: lot.materialCode,
    overallConforming,
    hasSafetyCriticalFailure,
    dimensions: results,
  };
}
