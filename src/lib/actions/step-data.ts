'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireUser } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { validateCapturedData, normalizeDataFields } from '@/lib/types/process-steps';

/**
 * Capture step data for a given execution and step definition.
 * Validates captured data against field definitions (min/max for numbers, required fields).
 * Returns the created/updated capture record and auto-evaluated result.
 */
export async function captureStepData(
  executionId: string,
  stepDefinitionId: string,
  capturedData: Record<string, unknown>
) {
  const user = await requireUser();

  // Fetch the step definition to get field definitions
  const stepDefinition = await prisma.processStepDefinition.findUnique({
    where: { id: stepDefinitionId },
  });

  if (!stepDefinition) {
    throw new Error('Process step definition not found');
  }

  const dataFields = normalizeDataFields(stepDefinition.dataFields);

  // Validate captured data against field definitions
  const validation = validateCapturedData(dataFields, capturedData);

  if (!validation.valid) {
    const errorMessages = Object.values(validation.errors).join('; ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }

  // Verify the execution exists and is in progress
  const execution = await prisma.unitOperationExecution.findUnique({
    where: { id: executionId },
    include: {
      unit: {
        include: { workOrder: true },
      },
      station: true,
    },
  });

  if (!execution) {
    throw new Error('Execution not found');
  }

  if (execution.completedAt) {
    throw new Error('Cannot capture data for a completed operation');
  }

  // Upsert the step data capture (unique on executionId + stepDefinitionId)
  const capture = await prisma.stepDataCapture.upsert({
    where: {
      executionId_stepDefinitionId: {
        executionId,
        stepDefinitionId,
      },
    },
    create: {
      executionId,
      stepDefinitionId,
      capturedData: capturedData as object,
      operatorId: user.id,
    },
    update: {
      capturedData: capturedData as object,
      operatorId: user.id,
    },
  });

  await emitEvent({
    eventType: 'step_data_captured',
    siteId: execution.unit.workOrder.siteId,
    stationId: execution.stationId,
    workOrderId: execution.unit.workOrderId,
    unitId: execution.unitId,
    operatorId: user.id,
    payload: {
      serialNumber: execution.unit.serialNumber,
      stepName: stepDefinition.name,
      stepCategory: stepDefinition.category,
      autoResult: validation.autoResult,
      fieldCount: dataFields.length,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey(
      'step_data_captured',
      `${executionId}:${stepDefinitionId}`
    ),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return {
    capture,
    autoResult: validation.autoResult,
  };
}

/**
 * Get all captured step data for an execution
 */
export async function getStepDataForExecution(executionId: string) {
  const captures = await prisma.stepDataCapture.findMany({
    where: { executionId },
    include: {
      stepDefinition: true,
      operator: {
        select: { id: true, name: true },
      },
    },
    orderBy: {
      stepDefinition: { sequenceOrder: 'asc' },
    },
  });

  return captures;
}

/**
 * Sign off on a step for a given execution
 */
export async function signOffStep(executionId: string, stepDefinitionId: string) {
  const user = await requireUser();

  const capture = await prisma.stepDataCapture.findUnique({
    where: {
      executionId_stepDefinitionId: {
        executionId,
        stepDefinitionId,
      },
    },
    include: {
      stepDefinition: true,
      execution: {
        include: {
          unit: { include: { workOrder: true } },
          station: true,
        },
      },
    },
  });

  if (!capture) {
    throw new Error('No data captured for this step yet. Capture data before signing off.');
  }

  if (capture.signedOff) {
    throw new Error('This step has already been signed off');
  }

  const updated = await prisma.stepDataCapture.update({
    where: { id: capture.id },
    data: {
      signedOff: true,
      signedOffAt: new Date(),
    },
  });

  await emitEvent({
    eventType: 'step_data_signed_off',
    siteId: capture.execution.unit.workOrder.siteId,
    stationId: capture.execution.stationId,
    workOrderId: capture.execution.unit.workOrderId,
    unitId: capture.execution.unitId,
    operatorId: user.id,
    payload: {
      serialNumber: capture.execution.unit.serialNumber,
      stepName: capture.stepDefinition.name,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey(
      'step_data_signed_off',
      `${executionId}:${stepDefinitionId}`
    ),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return updated;
}
