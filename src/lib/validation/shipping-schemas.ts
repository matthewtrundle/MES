import { z } from 'zod';
import { uuid } from '@/lib/validation/schemas';

// ── Shipment Status ─────────────────────────────────────────────
export const shipmentStatusEnum = z.enum([
  'pending',
  'packed',
  'shipped',
  'delivered',
]);

export type ShipmentStatus = z.infer<typeof shipmentStatusEnum>;

// ── Shipment Line Schema ────────────────────────────────────────
export const shipmentLineSchema = z.object({
  unitId: uuid,
  serialNumber: z.string().min(1, { error: 'Serial number is required' }),
  boxNumber: z.number().int().positive({ error: 'Box number must be a positive integer' }).optional(),
});

export type ShipmentLineInput = z.infer<typeof shipmentLineSchema>;

// ── Create Shipment Schema ──────────────────────────────────────
export const createShipmentSchema = z.object({
  workOrderId: uuid,
  customerName: z.string().min(1, { error: 'Customer name is required' }).max(200),
  customerAddress: z.string().max(500).optional(),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(200).optional(),
  totalBoxes: z.number().int().positive({ error: 'Total boxes must be a positive integer' }).optional(),
  totalWeight: z.number().positive({ error: 'Total weight must be positive' }).optional(),
  weightUnit: z.string().max(10).default('lbs'),
  specialNotes: z.string().max(2000).optional(),
  lines: z.array(shipmentLineSchema).min(1, { error: 'At least one unit must be included in the shipment' }),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

// ── Ship Shipment Schema ────────────────────────────────────────
export const shipShipmentSchema = z.object({
  shipmentId: uuid,
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(200).optional(),
});

export type ShipShipmentInput = z.infer<typeof shipShipmentSchema>;

// ── Shipment Filter Schema ──────────────────────────────────────
export const shipmentFilterSchema = z.object({
  status: shipmentStatusEnum.optional(),
  workOrderId: uuid.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type ShipmentFilterInput = z.infer<typeof shipmentFilterSchema>;
