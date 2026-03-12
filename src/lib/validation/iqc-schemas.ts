import { z } from 'zod';
import { uuid } from '@/lib/validation/schemas';

// ── IQC Measurement Recording ───────────────────────────────────────
export const recordMeasurementSchema = z.object({
  inspectionId: uuid,
  ctqDefinitionId: uuid,
  sampleNumber: z.number().int().positive('Sample number must be positive'),
  measuredValue: z.number({ error: 'Measured value is required' }),
  notes: z.string().max(1000).optional(),
});

// ── IQC Disposition ─────────────────────────────────────────────────
export const dispositionConformingSchema = z.object({
  inspectionId: uuid,
  notes: z.string().max(2000).optional(),
});

export const dispositionNonconformingSchema = z.object({
  inspectionId: uuid,
  type: z.enum(['rework', 'uai', 'scrap']),
  defectType: z.string().min(1, 'Defect type is required').max(200),
  description: z.string().max(2000).optional(),
  dispositionRationale: z.string().min(1, 'Disposition rationale is required').max(2000),
  correctiveAction: z.string().max(2000).optional(),
  responsibleParty: z.string().max(200).optional(),
  actionDueDate: z.coerce.date().optional(),
});

// ── IQC UAI Approval ────────────────────────────────────────────────
export const approveUAISchema = z.object({
  inspectionId: uuid,
  approverNotes: z.string().max(2000).optional(),
});

// ── Start Inspection ────────────────────────────────────────────────
export const startInspectionSchema = z.object({
  inspectionId: uuid,
});

// ── Completed Inspections Filter ────────────────────────────────────
export const completedInspectionsFilterSchema = z.object({
  partNumber: z.string().optional(),
  result: z.enum(['conforming', 'nonconforming_rework', 'nonconforming_uai', 'nonconforming_scrap']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).optional();
