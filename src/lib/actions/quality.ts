'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { recordQualityCheckSchema, createNCRSchema, dispositionNCRSchema, closeNCRSchema } from '@/lib/validation/schemas';

/**
 * Get quality check definitions for a station
 */
export async function getQualityChecksForStation(stationId: string) {
  const definitions = await prisma.qualityCheckDefinition.findMany({
    where: {
      stationIds: {
        has: stationId,
      },
      active: true,
    },
    orderBy: { name: 'asc' },
  });

  return definitions;
}

/**
 * Record a quality check result
 */
export async function recordQualityCheck(data: {
  unitId: string;
  definitionId: string;
  result: 'pass' | 'fail';
  values: Prisma.InputJsonValue;
}) {
  recordQualityCheckSchema.parse(data);
  const user = await requireUser();

  const unit = await prisma.unit.findUnique({
    where: { id: data.unitId },
    include: {
      workOrder: true,
    },
  });

  if (!unit) {
    throw new Error('Unit not found');
  }

  const definition = await prisma.qualityCheckDefinition.findUnique({
    where: { id: data.definitionId },
  });

  if (!definition) {
    throw new Error('Quality check definition not found');
  }

  const checkResult = await prisma.qualityCheckResult.create({
    data: {
      unitId: data.unitId,
      definitionId: data.definitionId,
      operatorId: user.id,
      result: data.result,
      valuesJson: data.values,
    },
  });

  await emitEvent({
    eventType: 'quality_check_recorded',
    siteId: unit.workOrder.siteId,
    workOrderId: unit.workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      serialNumber: unit.serialNumber,
      checkName: definition.name,
      checkType: definition.checkType,
      result: data.result,
      values: data.values,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('quality_check_recorded', `${data.unitId}:${data.definitionId}`),
  });

  // If check failed, automatically create NCR
  if (data.result === 'fail') {
    const stationId = unit.currentStationId;
    if (stationId) {
      await createNCR({
        unitId: unit.id,
        stationId,
        defectType: `Failed: ${definition.name}`,
        description: `Quality check "${definition.name}" failed. Values: ${JSON.stringify(data.values)}`,
      });
    }
  }

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return checkResult;
}

/**
 * Get quality check results for a unit
 */
export async function getUnitQualityResults(unitId: string) {
  const results = await prisma.qualityCheckResult.findMany({
    where: { unitId },
    include: {
      definition: true,
      operator: true,
    },
    orderBy: { timestamp: 'desc' },
  });

  return results;
}

/**
 * Create a Non-Conformance Record (NCR)
 */
export async function createNCR(data: {
  unitId: string;
  stationId: string;
  defectType: string;
  description?: string;
}) {
  createNCRSchema.parse(data);
  const user = await requireUser();

  const unit = await prisma.unit.findUnique({
    where: { id: data.unitId },
    include: {
      workOrder: true,
    },
  });

  if (!unit) {
    throw new Error('Unit not found');
  }

  const station = await prisma.station.findUnique({
    where: { id: data.stationId },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  const ncr = await prisma.nonconformanceRecord.create({
    data: {
      unitId: data.unitId,
      stationId: data.stationId,
      defectType: data.defectType,
      description: data.description,
      status: 'open',
    },
  });

  // Update unit status to indicate issue
  await prisma.unit.update({
    where: { id: data.unitId },
    data: { status: 'rework' },
  });

  await emitEvent({
    eventType: 'ncr_created',
    siteId: unit.workOrder.siteId,
    stationId: data.stationId,
    workOrderId: unit.workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      serialNumber: unit.serialNumber,
      stationName: station.name,
      defectType: data.defectType,
      description: data.description,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('ncr_created', `${data.unitId}:${data.stationId}:${data.defectType}`),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/supervisor/ncr');

  return ncr;
}

/**
 * Disposition an NCR
 * Only supervisors and admins can disposition NCRs
 */
export async function dispositionNCR(
  ncrId: string,
  disposition: 'rework' | 'scrap' | 'use_as_is' | 'defer'
) {
  dispositionNCRSchema.parse({ ncrId, disposition });
  const user = await requireRole(['supervisor', 'admin']);

  const ncr = await prisma.nonconformanceRecord.findUnique({
    where: { id: ncrId },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
      station: true,
    },
  });

  if (!ncr) {
    throw new Error('NCR not found');
  }

  if (ncr.status !== 'open') {
    throw new Error('NCR has already been dispositioned');
  }

  const updatedNCR = await prisma.nonconformanceRecord.update({
    where: { id: ncrId },
    data: {
      disposition,
      status: 'dispositioned',
    },
  });

  // Update unit status based on disposition
  let unitStatus = 'rework';
  if (disposition === 'scrap') {
    unitStatus = 'scrapped';
    // Update work order scrap count
    await prisma.workOrder.update({
      where: { id: ncr.unit.workOrderId },
      data: {
        qtyScrap: { increment: 1 },
      },
    });
  } else if (disposition === 'use_as_is') {
    unitStatus = 'in_progress';
  }

  await prisma.unit.update({
    where: { id: ncr.unitId },
    data: { status: unitStatus },
  });

  await emitEvent({
    eventType: 'ncr_dispositioned',
    siteId: ncr.unit.workOrder.siteId,
    stationId: ncr.stationId,
    workOrderId: ncr.unit.workOrderId,
    unitId: ncr.unitId,
    operatorId: user.id,
    payload: {
      serialNumber: ncr.unit.serialNumber,
      defectType: ncr.defectType,
      disposition,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('ncr_dispositioned', ncrId),
  });

  // If scrap, emit scrap event
  if (disposition === 'scrap') {
    await emitEvent({
      eventType: 'scrap_recorded',
      siteId: ncr.unit.workOrder.siteId,
      stationId: ncr.stationId,
      workOrderId: ncr.unit.workOrderId,
      unitId: ncr.unitId,
      operatorId: user.id,
      payload: {
        serialNumber: ncr.unit.serialNumber,
        reason: ncr.defectType,
        ncrId: ncr.id,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('scrap_recorded', `${ncr.unitId}:${ncrId}`),
    });
  }

  // If rework, emit rework created event
  if (disposition === 'rework') {
    await emitEvent({
      eventType: 'rework_created',
      siteId: ncr.unit.workOrder.siteId,
      stationId: ncr.stationId,
      workOrderId: ncr.unit.workOrderId,
      unitId: ncr.unitId,
      operatorId: user.id,
      payload: {
        serialNumber: ncr.unit.serialNumber,
        reason: ncr.defectType,
        ncrId: ncr.id,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('rework_created', `${ncr.unitId}:${ncrId}`),
    });
  }

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/supervisor/ncr');

  return updatedNCR;
}

/**
 * Close an NCR (after rework is complete)
 */
export async function closeNCR(ncrId: string, notes?: string) {
  closeNCRSchema.parse({ ncrId, notes });
  const user = await requireRole(['supervisor', 'admin']);

  const ncr = await prisma.nonconformanceRecord.findUnique({
    where: { id: ncrId },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
    },
  });

  if (!ncr) {
    throw new Error('NCR not found');
  }

  if (ncr.status !== 'dispositioned') {
    throw new Error('NCR must be dispositioned before closing');
  }

  const updatedNCR = await prisma.nonconformanceRecord.update({
    where: { id: ncrId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      description: ncr.description
        ? `${ncr.description}\n\nClosure notes: ${notes ?? 'N/A'}`
        : notes,
    },
  });

  // Update unit status back to in_progress if it was rework
  if (ncr.disposition === 'rework') {
    await prisma.unit.update({
      where: { id: ncr.unitId },
      data: { status: 'in_progress' },
    });

    await emitEvent({
      eventType: 'rework_completed',
      siteId: ncr.unit.workOrder.siteId,
      workOrderId: ncr.unit.workOrderId,
      unitId: ncr.unitId,
      operatorId: user.id,
      payload: {
        serialNumber: ncr.unit.serialNumber,
        ncrId: ncr.id,
        notes,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('rework_completed', `${ncr.unitId}:${ncrId}`),
    });
  }

  await emitEvent({
    eventType: 'ncr_closed',
    siteId: ncr.unit.workOrder.siteId,
    workOrderId: ncr.unit.workOrderId,
    unitId: ncr.unitId,
    operatorId: user.id,
    payload: {
      serialNumber: ncr.unit.serialNumber,
      defectType: ncr.defectType,
      disposition: ncr.disposition,
      notes,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('ncr_closed', ncrId),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/supervisor/ncr');

  return updatedNCR;
}

/**
 * Get open NCRs
 */
export async function getOpenNCRs(siteId?: string) {
  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: {
      status: { in: ['open', 'dispositioned'] },
      ...(siteId && {
        unit: {
          workOrder: {
            siteId,
          },
        },
      }),
    },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
      station: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return ncrs;
}
