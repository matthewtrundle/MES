import { z } from 'zod';

/**
 * Validate data against a Zod schema and throw a user-friendly error on failure.
 * Use this instead of `schema.parse()` in server actions to avoid leaking raw Zod JSON.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  // Zod 4 uses .issues, not .errors
  const messages = result.error.issues.map((e) => {
    const field = e.path.length > 0 ? e.path.join('.') : undefined;
    return field ? `${field}: ${e.message}` : e.message;
  });
  throw new Error(messages.join('; '));
}

// ── Shared primitives ─────────────────────────────────────────────
// Use regex instead of z.string().uuid() because Zod 4's .uuid() enforces
// RFC 9562 version+variant bits, which rejects internally-generated IDs like
// seed data UUIDs (e.g., "55555555-1111-1111-1111-111111111111").
export const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'Invalid UUID'
);

export const serialNumber = z
  .string()
  .min(1, 'Serial number is required')
  .max(50, 'Serial number too long')
  .regex(/^[A-Za-z0-9\-_]+$/, 'Serial number must be alphanumeric (hyphens and underscores allowed)');

export const positiveNumber = z.number().positive('Must be a positive number');
export const positiveInt = z.number().int().positive('Must be a positive integer');
export const nonNegativeNumber = z.number().nonnegative('Must be zero or positive');

// ── Materials ─────────────────────────────────────────────────────
export const consumeMaterialSchema = z.object({
  unitId: uuid,
  materialLotId: uuid,
  qtyConsumed: positiveNumber,
  stationId: uuid,
});

// ── Units ─────────────────────────────────────────────────────────
export const createUnitSchema = z.object({
  workOrderId: uuid,
  serialNumber: serialNumber.optional(),
});

export const startOperationSchema = z.object({
  unitId: uuid,
  stationId: uuid,
  operationId: uuid,
});

export const completeOperationSchema = z.object({
  executionId: uuid,
  result: z.enum(['pass', 'fail', 'rework']).default('pass'),
  notes: z.string().max(1000).optional(),
});

// ── Work Orders ───────────────────────────────────────────────────
export const createWorkOrderSchema = z.object({
  siteId: uuid,
  orderNumber: z
    .string()
    .min(1, 'Order number is required')
    .max(50, 'Order number too long'),
  productCode: z
    .string()
    .min(1, 'Product code is required')
    .max(50, 'Product code too long'),
  productName: z.string().max(200).optional(),
  qtyOrdered: positiveInt,
  routingId: uuid.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  dueDate: z.coerce.date().optional(),
  customerName: z.string().max(200).optional(),
  customerOrderRef: z.string().max(100).optional(),
  targetStartDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const cancelWorkOrderSchema = z.object({
  workOrderId: uuid,
  reason: z
    .string()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Cancellation reason too long'),
});

// ── Quality ───────────────────────────────────────────────────────
export const recordQualityCheckSchema = z.object({
  unitId: uuid,
  definitionId: uuid,
  result: z.enum(['pass', 'fail']),
  values: z.record(z.string(), z.unknown()),
});

export const createNCRSchema = z.object({
  unitId: uuid,
  stationId: uuid,
  defectType: z.string().min(1, 'Defect type is required').max(200),
  description: z.string().max(2000).optional(),
});

export const dispositionNCRSchema = z.object({
  ncrId: uuid,
  disposition: z.enum(['rework', 'scrap', 'use_as_is', 'defer']),
});

export const closeNCRSchema = z.object({
  ncrId: uuid,
  notes: z.string().max(2000).optional(),
});

// ── Downtime ──────────────────────────────────────────────────────
export const startDowntimeSchema = z.object({
  stationId: uuid,
  notes: z.string().max(1000).optional(),
});

export const selectDowntimeReasonSchema = z.object({
  downtimeId: uuid,
  reasonId: uuid,
});

export const endDowntimeSchema = z.object({
  downtimeId: uuid,
  notes: z.string().max(1000).optional(),
});

// ── EOL Testing ─────────────────────────────────────────────────
export const eolTestParameterSchema = z.object({
  parameterId: uuid,
  value: z.number(),
});

export const recordEolTestResultSchema = z.object({
  unitId: uuid,
  suiteId: uuid,
  results: z.array(eolTestParameterSchema).min(1, 'At least one test result is required'),
  notes: z.string().max(2000).optional(),
});

export const createEolTestSuiteSchema = z.object({
  routingId: uuid,
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  parameters: z.array(z.object({
    name: z.string().min(1, 'Parameter name is required').max(100),
    unit: z.string().min(1, 'Unit is required').max(20),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    targetValue: z.number().optional(),
    sequence: z.number().int().min(0).optional(),
  })).min(1, 'At least one test parameter is required'),
});

export const updateEolTestSuiteSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  active: z.boolean().optional(),
  parameters: z.array(z.object({
    id: uuid.optional(),
    name: z.string().min(1).max(100),
    unit: z.string().min(1).max(20),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    targetValue: z.number().optional(),
    sequence: z.number().int().min(0).optional(),
  })).optional(),
});

export const assignSerialNumberSchema = z.object({
  unitId: uuid,
});

// ── Admin ─────────────────────────────────────────────────────────
export const stationTypeEnum = z.enum([
  'winding',
  'assembly',
  'test',
  'inspection',
]);

export const createStationSchema = z.object({
  siteId: uuid,
  name: z.string().min(1).max(100),
  stationType: stationTypeEnum,
  sequenceOrder: positiveInt,
  config: z.record(z.string(), z.unknown()).optional(),
});

export const lossTypeEnum = z.enum([
  'equipment',
  'changeover',
  'material',
  'quality',
  'planned',
  'other',
]);

export const createDowntimeReasonSchema = z.object({
  siteId: uuid,
  code: z.string().min(1).max(20),
  description: z.string().min(1).max(200),
  lossType: lossTypeEnum,
  isPlanned: z.boolean(),
});
