'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole, requireUser } from '@/lib/auth/rbac';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import {
  validate,
  recordEolTestResultSchema,
  createEolTestSuiteSchema,
  updateEolTestSuiteSchema,
  assignSerialNumberSchema,
} from '@/lib/validation/schemas';

// =============================================================================
// EOL Test Suite Admin Operations
// =============================================================================

/**
 * Get all EOL test suites (admin)
 */
export async function getEolTestSuites() {
  await requireRole(['admin']);

  return prisma.eolTestSuite.findMany({
    include: {
      routing: {
        select: { id: true, name: true, productCode: true },
      },
      parameters: {
        where: { active: true },
        orderBy: { sequence: 'asc' },
      },
      _count: {
        select: { results: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create a new EOL test suite with parameters
 */
export async function createEolTestSuite(data: {
  routingId: string;
  name: string;
  description?: string;
  parameters: {
    name: string;
    unit: string;
    minValue?: number;
    maxValue?: number;
    targetValue?: number;
    sequence?: number;
  }[];
}) {
  validate(createEolTestSuiteSchema, data);
  const user = await requireRole(['admin']);

  const routing = await prisma.routing.findUnique({
    where: { id: data.routingId },
  });

  if (!routing) {
    throw new Error('Routing not found');
  }

  const suite = await prisma.eolTestSuite.create({
    data: {
      routingId: data.routingId,
      name: data.name,
      description: data.description,
      parameters: {
        create: data.parameters.map((p, index) => ({
          name: p.name,
          unit: p.unit,
          minValue: p.minValue,
          maxValue: p.maxValue,
          targetValue: p.targetValue,
          sequence: p.sequence ?? index,
        })),
      },
    },
    include: {
      parameters: true,
    },
  });

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'unknown';

  await logAuditTrail(user.id, 'create', 'EolTestSuite', suite.id, null, {
    name: data.name,
    routingId: data.routingId,
    parameterCount: data.parameters.length,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'eol_test_suite_created',
      suiteId: suite.id,
      name: data.name,
      routingId: data.routingId,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/eol-tests');
  revalidatePath('/dashboard');
  return suite;
}

/**
 * Update an EOL test suite
 */
export async function updateEolTestSuite(data: {
  id: string;
  name?: string;
  description?: string;
  active?: boolean;
  parameters?: {
    id?: string;
    name: string;
    unit: string;
    minValue?: number;
    maxValue?: number;
    targetValue?: number;
    sequence?: number;
  }[];
}) {
  validate(updateEolTestSuiteSchema, data);
  const user = await requireRole(['admin']);

  const existing = await prisma.eolTestSuite.findUnique({
    where: { id: data.id },
    include: { parameters: true },
  });

  if (!existing) {
    throw new Error('EOL test suite not found');
  }

  // Update suite fields
  const suite = await prisma.eolTestSuite.update({
    where: { id: data.id },
    data: {
      name: data.name,
      description: data.description,
      active: data.active,
    },
  });

  // If parameters are provided, replace them
  if (data.parameters) {
    // Deactivate all existing parameters
    await prisma.eolTestParameter.updateMany({
      where: { suiteId: data.id },
      data: { active: false },
    });

    // Create/update parameters
    for (const param of data.parameters) {
      if (param.id) {
        await prisma.eolTestParameter.update({
          where: { id: param.id },
          data: {
            name: param.name,
            unit: param.unit,
            minValue: param.minValue,
            maxValue: param.maxValue,
            targetValue: param.targetValue,
            sequence: param.sequence ?? 0,
            active: true,
          },
        });
      } else {
        await prisma.eolTestParameter.create({
          data: {
            suiteId: data.id,
            name: param.name,
            unit: param.unit,
            minValue: param.minValue,
            maxValue: param.maxValue,
            targetValue: param.targetValue,
            sequence: param.sequence ?? 0,
            active: true,
          },
        });
      }
    }
  }

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'unknown';

  await logAuditTrail(user.id, 'update', 'EolTestSuite', data.id, {
    name: existing.name,
    active: existing.active,
  }, {
    name: data.name,
    active: data.active,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'eol_test_suite_updated',
      suiteId: data.id,
      name: suite.name,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/eol-tests');
  revalidatePath('/dashboard');
  return suite;
}

/**
 * Delete an EOL test suite (soft delete if results exist)
 */
export async function deleteEolTestSuite(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.eolTestSuite.findUnique({
    where: { id },
    include: {
      _count: { select: { results: true } },
    },
  });

  if (!existing) {
    throw new Error('EOL test suite not found');
  }

  if (existing._count.results > 0) {
    // Soft delete - deactivate
    await prisma.eolTestSuite.update({
      where: { id },
      data: { active: false },
    });
  } else {
    // Hard delete (cascade will remove parameters)
    await prisma.eolTestSuite.delete({
      where: { id },
    });
  }

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'unknown';

  await logAuditTrail(user.id, 'delete', 'EolTestSuite', id, { name: existing.name }, null);

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: existing._count.results > 0 ? 'eol_test_suite_deactivated' : 'eol_test_suite_deleted',
      suiteId: id,
      name: existing.name,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/eol-tests');
  revalidatePath('/dashboard');
}

// =============================================================================
// EOL Test Execution (Operator)
// =============================================================================

/**
 * Get EOL test definitions for a routing
 */
export async function getEolDefinitionsForRouting(routingId: string) {
  return prisma.eolTestSuite.findMany({
    where: {
      routingId,
      active: true,
    },
    include: {
      parameters: {
        where: { active: true },
        orderBy: { sequence: 'asc' },
      },
    },
  });
}

/**
 * Record EOL test results for a unit
 * Computes composite pass/fail across all parameters
 */
export async function recordEolTestResult(data: {
  unitId: string;
  suiteId: string;
  results: { parameterId: string; value: number }[];
  notes?: string;
}) {
  validate(recordEolTestResultSchema, data);
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

  const suite = await prisma.eolTestSuite.findUnique({
    where: { id: data.suiteId },
    include: {
      parameters: {
        where: { active: true },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!suite) {
    throw new Error('EOL test suite not found');
  }

  if (!suite.active) {
    throw new Error('EOL test suite is not active');
  }

  // Build parameter results and compute composite
  const parameterResults: {
    parameterId: string;
    name: string;
    value: number;
    unit: string;
    min: number | null;
    max: number | null;
    target: number | null;
    pass: boolean;
  }[] = [];

  for (const param of suite.parameters) {
    const resultEntry = data.results.find((r) => r.parameterId === param.id);
    if (!resultEntry) {
      throw new Error(`Missing result for parameter: ${param.name}`);
    }

    const value = resultEntry.value;
    let pass = true;

    if (param.minValue !== null && value < param.minValue) {
      pass = false;
    }
    if (param.maxValue !== null && value > param.maxValue) {
      pass = false;
    }

    parameterResults.push({
      parameterId: param.id,
      name: param.name,
      value,
      unit: param.unit,
      min: param.minValue,
      max: param.maxValue,
      target: param.targetValue,
      pass,
    });
  }

  const compositeResult = parameterResults.every((r) => r.pass) ? 'pass' : 'fail';

  const eolResult = await prisma.eolTestResult.create({
    data: {
      unitId: data.unitId,
      suiteId: data.suiteId,
      operatorId: user.id,
      compositeResult,
      parameterResults: parameterResults as object[],
      notes: data.notes,
    },
  });

  // Emit the general recorded event
  await emitEvent({
    eventType: 'eol_test_recorded',
    siteId: unit.workOrder.siteId,
    workOrderId: unit.workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      serialNumber: unit.serialNumber,
      suiteName: suite.name,
      suiteId: suite.id,
      compositeResult,
      parameterResults,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('eol_test_recorded', `${data.unitId}:${data.suiteId}`),
  });

  // Emit pass or fail event
  if (compositeResult === 'pass') {
    await emitEvent({
      eventType: 'eol_test_passed',
      siteId: unit.workOrder.siteId,
      workOrderId: unit.workOrderId,
      unitId: unit.id,
      operatorId: user.id,
      payload: {
        serialNumber: unit.serialNumber,
        suiteName: suite.name,
        suiteId: suite.id,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('eol_test_passed', `${data.unitId}:${data.suiteId}`),
    });
  } else {
    await emitEvent({
      eventType: 'eol_test_failed',
      siteId: unit.workOrder.siteId,
      workOrderId: unit.workOrderId,
      unitId: unit.id,
      operatorId: user.id,
      payload: {
        serialNumber: unit.serialNumber,
        suiteName: suite.name,
        suiteId: suite.id,
        failedParameters: parameterResults.filter((r) => !r.pass).map((r) => r.name),
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('eol_test_failed', `${data.unitId}:${data.suiteId}`),
    });
  }

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return { ...eolResult, compositeResult, parameterResults };
}

/**
 * Get EOL test results for a unit
 */
export async function getEolResultsForUnit(unitId: string) {
  return prisma.eolTestResult.findMany({
    where: { unitId },
    include: {
      suite: {
        select: { id: true, name: true },
      },
    },
    orderBy: { testedAt: 'desc' },
  });
}

/**
 * Check if a unit has passed ALL required EOL tests
 */
export async function hasPassedAllEolTests(unitId: string): Promise<{
  passed: boolean;
  required: { suiteId: string; suiteName: string }[];
  completed: { suiteId: string; suiteName: string; result: string }[];
  missing: { suiteId: string; suiteName: string }[];
}> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      workOrder: {
        include: {
          routing: {
            include: {
              eolTestSuites: {
                where: { active: true },
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!unit) {
    throw new Error('Unit not found');
  }

  const requiredSuites = unit.workOrder.routing?.eolTestSuites ?? [];

  // Get latest passing result for each suite
  const results = await prisma.eolTestResult.findMany({
    where: {
      unitId,
      suiteId: { in: requiredSuites.map((s) => s.id) },
    },
    orderBy: { testedAt: 'desc' },
  });

  // For each suite, check if the LATEST result is a pass
  const completed: { suiteId: string; suiteName: string; result: string }[] = [];
  const missing: { suiteId: string; suiteName: string }[] = [];

  for (const suite of requiredSuites) {
    const latestResult = results.find((r) => r.suiteId === suite.id);
    if (latestResult && latestResult.compositeResult === 'pass') {
      completed.push({ suiteId: suite.id, suiteName: suite.name, result: 'pass' });
    } else if (latestResult) {
      completed.push({ suiteId: suite.id, suiteName: suite.name, result: 'fail' });
      missing.push({ suiteId: suite.id, suiteName: suite.name });
    } else {
      missing.push({ suiteId: suite.id, suiteName: suite.name });
    }
  }

  return {
    passed: missing.length === 0 && requiredSuites.length > 0,
    required: requiredSuites.map((s) => ({ suiteId: s.id, suiteName: s.name })),
    completed,
    missing,
  };
}

// =============================================================================
// P1.2: Serial Number Gate - Assign serial AFTER EOL pass
// =============================================================================

/**
 * Generate a serial number from a format template
 * Supports: {YYYY}, {MM}, {DD}, {SEQ:N} (zero-padded sequence with N digits)
 */
async function generateSerialFromFormat(format: string, routingId: string): Promise<string> {
  const now = new Date();
  let serial = format;

  serial = serial.replace('{YYYY}', now.getFullYear().toString());
  serial = serial.replace('{MM}', (now.getMonth() + 1).toString().padStart(2, '0'));
  serial = serial.replace('{DD}', now.getDate().toString().padStart(2, '0'));

  // Handle {SEQ:N} - find the next sequence number
  const seqMatch = serial.match(/\{SEQ:(\d+)\}/);
  if (seqMatch) {
    const digits = parseInt(seqMatch[1], 10);
    // Extract the prefix (everything before {SEQ:N}) to scope the sequence
    const prefix = serial.substring(0, serial.indexOf(seqMatch[0]));

    // Count existing units with this prefix pattern to determine next sequence
    const existingCount = await prisma.unit.count({
      where: {
        serialNumber: { startsWith: prefix },
        serialAssigned: true,
      },
    });

    const nextSeq = (existingCount + 1).toString().padStart(digits, '0');
    serial = serial.replace(seqMatch[0], nextSeq);
  }

  return serial;
}

/**
 * Assign a serial number to a unit after EOL tests pass
 * Verifies all EOL tests have passed before assignment
 */
export async function assignSerialNumber(unitId: string) {
  validate(assignSerialNumberSchema, { unitId });
  const user = await requireUser();

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      workOrder: {
        include: {
          routing: true,
        },
      },
    },
  });

  if (!unit) {
    throw new Error('Unit not found');
  }

  if (unit.serialAssigned) {
    throw new Error('Serial number has already been assigned to this unit');
  }

  // Verify all EOL tests passed
  const eolStatus = await hasPassedAllEolTests(unitId);
  if (!eolStatus.passed) {
    const missingNames = eolStatus.missing.map((m) => m.suiteName).join(', ');
    throw new Error(`Cannot assign serial number. EOL tests not passed: ${missingNames}`);
  }

  // Generate serial number from routing format or fallback
  const routing = unit.workOrder.routing;
  let newSerial: string;

  if (routing?.serialFormat) {
    newSerial = await generateSerialFromFormat(routing.serialFormat, routing.id);
  } else {
    // Fallback: use product code + timestamp-based serial
    const productCode = unit.workOrder.productCode;
    const now = new Date();
    const seq = await prisma.unit.count({
      where: { serialAssigned: true },
    });
    newSerial = `${productCode}-${now.getFullYear()}-${(seq + 1).toString().padStart(5, '0')}`;
  }

  // Verify uniqueness
  const existingUnit = await prisma.unit.findUnique({
    where: { serialNumber: newSerial },
  });
  if (existingUnit) {
    throw new Error(`Serial number ${newSerial} is already in use`);
  }

  // Update unit with new serial number
  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      serialNumber: newSerial,
      serialAssigned: true,
    },
  });

  await emitEvent({
    eventType: 'unit_serial_assigned',
    siteId: unit.workOrder.siteId,
    workOrderId: unit.workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      previousSerial: unit.serialNumber,
      newSerial,
      routingId: routing?.id,
      serialFormat: routing?.serialFormat,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('unit_serial_assigned', unitId),
  });

  revalidatePath('/station');
  revalidatePath('/dashboard');

  return updatedUnit;
}

// =============================================================================
// Admin helpers
// =============================================================================

/**
 * Get all routings for EOL suite configuration
 */
export async function getRoutingsForEol() {
  return prisma.routing.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      productCode: true,
      serialFormat: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Update routing serial format
 */
export async function updateRoutingSerialFormat(routingId: string, serialFormat: string | null) {
  const user = await requireRole(['admin']);

  const existing = await prisma.routing.findUnique({
    where: { id: routingId },
  });

  if (!existing) {
    throw new Error('Routing not found');
  }

  const updated = await prisma.routing.update({
    where: { id: routingId },
    data: { serialFormat },
  });

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'unknown';

  await logAuditTrail(user.id, 'update', 'Routing', routingId, {
    serialFormat: existing.serialFormat,
  }, {
    serialFormat,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'routing_serial_format_updated',
      routingId,
      serialFormat,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/eol-tests');
  revalidatePath('/dashboard');
  return updated;
}
