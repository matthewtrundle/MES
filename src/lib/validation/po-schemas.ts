import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────
const uuid = z.string().uuid();
const positiveNumber = z.number().positive('Must be a positive number');
const positiveInt = z.number().int().positive('Must be a positive integer');
const nonNegativeNumber = z.number().nonnegative('Must be zero or positive');

// ── PO Status ─────────────────────────────────────────────────────
export const poStatusEnum = z.enum([
  'draft',
  'submitted',
  'partially_received',
  'fully_received',
  'closed',
  'cancelled',
]);

export type POStatus = z.infer<typeof poStatusEnum>;

// ── Line Item Schema ──────────────────────────────────────────────
export const lineItemSchema = z.object({
  lineNumber: positiveInt,
  partNumber: z.string().min(1, 'Part number is required').max(50),
  partRevision: z.string().max(10).default('A'),
  supplierPartNumber: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  qtyOrdered: positiveInt,
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20).default('EA'),
  unitCost: nonNegativeNumber.optional(),
  countryOfOrigin: z.string().max(5).optional(),
  expectedLeadTimeDays: z.number().int().min(0).optional(),
  drawingUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;

// ── Create PO Schema ──────────────────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  supplierId: uuid,
  buyerName: z.string().min(1, 'Buyer name is required').max(200),
  orderDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional(),
  currency: z.string().min(1).max(10).default('USD'),
  paymentTerms: z.string().max(100).optional(),
  shippingMethod: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

// ── Add Line Item Schema ──────────────────────────────────────────
export const addLineItemSchema = lineItemSchema;

// ── Update PO Status Schema ───────────────────────────────────────
export const updatePoStatusSchema = z.object({
  id: uuid,
  newStatus: poStatusEnum,
});
