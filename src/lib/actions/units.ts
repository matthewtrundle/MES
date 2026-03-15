'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { validate, createUnitSchema, startOperationSchema, completeOperationSchema } from '@/lib/validation/schemas';

/**
 * Generate serial number based on site config
 */
async function generateSerialNumber(siteId: string): Promise<string> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  const config = (site?.config as { serialPrefix?: string; serialLength?: number }) ?? {};
  const prefix = config.serialPrefix ?? 'SN';
  const length = config.serialLength ?? 8;

  // Get count of units for this site
  const count = await prisma.unit.count({
    where: {
      workOrder: {
        siteId,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(length, '0');
  return `${prefix}-${sequence}`;
}

/**
 * Create a new unit for a work order
 */
export async function createUnit(workOrderId: string, serialNumber?: string) {
  validate(createUnitSchema, { workOrderId, serialNumber });
  const user = await requireUser();

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { site: true },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  if (workOrder.status !== 'released' && workOrder.status !== 'in_progress') {
    throw new Error('Work order must be released to create units');
  }

  // Check if we've reached the ordered quantity
  const existingUnits = await prisma.unit.count({
    where: { workOrderId },
  });

  if (existingUnits >= workOrder.qtyOrdered) {
    throw new Error('All units for this work order have been created');
  }

  // Generate serial if not provided
  const serial = serialNumber ?? (await generateSerialNumber(workOrder.siteId));

  // Check for duplicate serial
  const existingSerial = await prisma.unit.findUnique({
    where: { serialNumber: serial },
  });

  if (existingSerial) {
    throw new Error(`Serial number ${serial} already exists`);
  }

  const unit = await prisma.unit.create({
    data: {
      workOrderId,
      serialNumber: serial,
      status: 'created',
    },
  });

  // Update work order to in_progress if it was released
  if (workOrder.status === 'released') {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: 'in_progress' },
    });
  }

  await emitEvent({
    eventType: 'unit_created',
    siteId: workOrder.siteId,
    workOrderId: workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      serialNumber: serial,
      orderNumber: workOrder.orderNumber,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('unit_created', `${workOrderId}:${serial}`),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/production');

  return unit;
}

/**
 * Start an operation on a unit at a station
 */
export async function startOperation(
  unitId: string,
  stationId: string,
  operationId: string
) {
  validate(startOperationSchema, { unitId, stationId, operationId });
  const user = await requireUser();

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      workOrder: true,
    },
  });

  if (!unit) {
    throw new Error('Unit not found');
  }

  const operation = await prisma.workOrderOperation.findUnique({
    where: { id: operationId },
    include: { station: true },
  });

  if (!operation) {
    throw new Error('Operation not found');
  }

  if (operation.stationId !== stationId) {
    throw new Error('Operation is not for this station');
  }

  // Check if there's already an in-progress execution for this unit at this station
  const existingExecution = await prisma.unitOperationExecution.findFirst({
    where: {
      unitId,
      operationId,
      completedAt: null,
    },
  });

  if (existingExecution) {
    throw new Error('This operation is already in progress');
  }

  const execution = await prisma.unitOperationExecution.create({
    data: {
      unitId,
      operationId,
      stationId,
      operatorId: user.id,
      startedAt: new Date(),
    },
  });

  // Update unit status and current station
  await prisma.unit.update({
    where: { id: unitId },
    data: {
      status: 'in_progress',
      currentStationId: stationId,
    },
  });

  // Update operation status
  await prisma.workOrderOperation.update({
    where: { id: operationId },
    data: { status: 'in_progress' },
  });

  await emitEvent({
    eventType: 'operation_started',
    siteId: unit.workOrder.siteId,
    stationId,
    workOrderId: unit.workOrderId,
    unitId,
    operatorId: user.id,
    payload: {
      serialNumber: unit.serialNumber,
      stationName: operation.station.name,
      sequence: operation.sequence,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('operation_started', `${unitId}:${operationId}`),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/production');

  return execution;
}

/**
 * Complete an operation on a unit
 */
export async function completeOperation(
  executionId: string,
  result: 'pass' | 'fail' | 'rework' = 'pass',
  notes?: string
) {
  validate(completeOperationSchema, { executionId, result, notes });
  const user = await requireUser();

  const execution = await prisma.unitOperationExecution.findUnique({
    where: { id: executionId },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
      operation: {
        include: {
          station: true,
        },
      },
      station: true,
    },
  });

  if (!execution) {
    throw new Error('Execution not found');
  }

  if (execution.completedAt) {
    throw new Error('Operation already completed');
  }

  // Calculate cycle time
  const completedAt = new Date();
  const cycleTimeMinutes = (completedAt.getTime() - execution.startedAt.getTime()) / 60000;

  // Update execution
  await prisma.unitOperationExecution.update({
    where: { id: executionId },
    data: {
      completedAt,
      cycleTimeMinutes: Math.round(cycleTimeMinutes * 100) / 100,
      result,
      notes,
    },
  });

  // Get the next operation in sequence
  const nextOperation = await prisma.workOrderOperation.findFirst({
    where: {
      workOrderId: execution.unit.workOrderId,
      sequence: { gt: execution.operation.sequence },
    },
    orderBy: { sequence: 'asc' },
  });

  // Determine unit status based on result and whether there's a next operation
  let unitStatus = 'in_progress';
  if (result === 'fail') {
    unitStatus = 'rework';
  } else if (result === 'pass' && !nextOperation) {
    // This was the last operation
    unitStatus = 'completed';

    // Update work order completed count
    await prisma.workOrder.update({
      where: { id: execution.unit.workOrderId },
      data: {
        qtyCompleted: { increment: 1 },
      },
    });
  }

  // Update unit
  await prisma.unit.update({
    where: { id: execution.unitId },
    data: {
      status: unitStatus,
      currentStationId: result === 'pass' && nextOperation ? null : execution.stationId,
    },
  });

  // Update operation status if all units are done
  const pendingExecutions = await prisma.unitOperationExecution.count({
    where: {
      operationId: execution.operationId,
      completedAt: null,
    },
  });

  if (pendingExecutions === 0) {
    await prisma.workOrderOperation.update({
      where: { id: execution.operationId },
      data: { status: 'completed' },
    });
  }

  const eventType = result === 'pass' ? 'operation_completed' : 'operation_failed';
  await emitEvent({
    eventType,
    siteId: execution.unit.workOrder.siteId,
    stationId: execution.stationId,
    workOrderId: execution.unit.workOrderId,
    unitId: execution.unitId,
    operatorId: user.id,
    payload: {
      serialNumber: execution.unit.serialNumber,
      stationName: execution.station.name,
      sequence: execution.operation.sequence,
      result,
      notes,
      durationMinutes: Math.round(
        (new Date().getTime() - execution.startedAt.getTime()) / 60000
      ),
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey(eventType, executionId),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/production');

  return { unitStatus, nextOperation };
}

/**
 * Get unit details with full history
 */
export async function getUnitWithHistory(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      workOrder: {
        include: { site: true },
      },
      executions: {
        include: {
          station: true,
          operator: true,
          operation: true,
        },
        orderBy: { startedAt: 'asc' },
      },
      materialConsumptions: {
        include: {
          materialLot: true,
          station: true,
          operator: true,
        },
        orderBy: { timestamp: 'asc' },
      },
      qualityResults: {
        include: {
          definition: true,
          operator: true,
        },
        orderBy: { timestamp: 'asc' },
      },
      ncrs: {
        include: {
          station: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return unit;
}

/**
 * Search for a unit by serial number
 */
export async function searchUnitBySerial(serialNumber: string) {
  const unit = await prisma.unit.findUnique({
    where: { serialNumber },
    include: {
      workOrder: {
        include: { site: true },
      },
    },
  });

  return unit;
}

/**
 * Get units at a station (in progress or ready)
 */
export async function getUnitsAtStation(stationId: string, workOrderId?: string) {
  const station = await prisma.station.findUnique({
    where: { id: stationId },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  // Find the operation for this station in the work order
  const operations = await prisma.workOrderOperation.findMany({
    where: {
      stationId,
      ...(workOrderId && { workOrderId }),
      status: { in: ['pending', 'in_progress'] },
    },
    include: {
      workOrder: true,
    },
  });

  const operationIds = operations.map((o) => o.id);
  const workOrderIds = operations.map((o) => o.workOrderId);

  // Get units that:
  // 1. Are currently at this station (in progress)
  // 2. Or are ready for this station (completed previous operation)
  const units = await prisma.unit.findMany({
    where: {
      workOrderId: { in: workOrderIds },
      status: { in: ['created', 'in_progress', 'rework'] },
      OR: [
        { currentStationId: stationId },
        {
          // Units ready for this station (just created or completed previous station)
          executions: {
            none: {
              operationId: { in: operationIds },
            },
          },
        },
      ],
    },
    include: {
      workOrder: true,
      executions: {
        where: {
          stationId,
          completedAt: null,
        },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return { units, operations };
}
