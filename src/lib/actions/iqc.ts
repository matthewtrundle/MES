'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { revalidatePath } from 'next/cache';
import {
  recordMeasurementSchema,
  dispositionConformingSchema,
  dispositionNonconformingSchema,
  approveUAISchema,
  startInspectionSchema,
} from '@/lib/validation/iqc-schemas';

// =============================================================================
// QUERY ACTIONS
// =============================================================================

/**
 * Get pending and in_progress inspections for the IQC queue
 */
export async function getInspectionQueue() {
  await requireRole(['admin', 'supervisor']);

  const inspections = await prisma.incomingInspection.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
    },
    include: {
      materialLot: {
        include: {
          supplierRef: true,
        },
      },
      inspector: true,
      results: {
        include: {
          ctqDefinition: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' }, // in_progress first
      { createdAt: 'asc' }, // oldest first
    ],
  });

  return inspections;
}

/**
 * Get CTQ definitions for an inspection's material lot (by partNumber/materialCode)
 */
export async function getCTQsForInspection(inspectionId: string) {
  await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: { materialLot: true },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  const ctqs = await prisma.cTQDefinition.findMany({
    where: {
      partNumber: inspection.materialLot.materialCode,
      active: true,
      sampleSizeRule: { not: 'skip' },
    },
    orderBy: [{ dimensionName: 'asc' }],
  });

  return ctqs;
}

/**
 * Get all results for an inspection, grouped by CTQ
 */
export async function getInspectionResults(inspectionId: string) {
  await requireRole(['admin', 'supervisor']);

  const results = await prisma.iQCResult.findMany({
    where: { inspectionId },
    include: {
      ctqDefinition: true,
      inspector: true,
    },
    orderBy: [
      { ctqDefinitionId: 'asc' },
      { sampleNumber: 'asc' },
    ],
  });

  // Group results by CTQ definition
  const grouped: Record<string, {
    ctqDefinition: typeof results[0]['ctqDefinition'];
    measurements: typeof results;
  }> = {};

  for (const result of results) {
    if (!grouped[result.ctqDefinitionId]) {
      grouped[result.ctqDefinitionId] = {
        ctqDefinition: result.ctqDefinition,
        measurements: [],
      };
    }
    grouped[result.ctqDefinitionId].measurements.push(result);
  }

  return grouped;
}

/**
 * Get completed inspections with optional filters
 */
export async function getCompletedInspections(filters?: {
  partNumber?: string;
  result?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  await requireRole(['admin', 'supervisor']);

  const where: Record<string, unknown> = {
    status: { in: ['completed', 'rejected'] },
  };

  if (filters?.result) {
    where.overallResult = filters.result;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.completedAt = {};
    if (filters?.dateFrom) {
      (where.completedAt as Record<string, Date>).gte = filters.dateFrom;
    }
    if (filters?.dateTo) {
      (where.completedAt as Record<string, Date>).lte = filters.dateTo;
    }
  }

  const inspections = await prisma.incomingInspection.findMany({
    where,
    include: {
      materialLot: {
        include: {
          supplierRef: true,
        },
      },
      inspector: true,
      approvedBy: true,
      results: {
        include: {
          ctqDefinition: true,
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: 100,
  });

  // If filtering by partNumber, do it in application code since it's on materialLot
  if (filters?.partNumber) {
    return inspections.filter(
      (insp) => insp.materialLot.materialCode === filters.partNumber
    );
  }

  return inspections;
}

/**
 * Get a single inspection with full details
 */
export async function getInspectionById(inspectionId: string) {
  await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: {
      materialLot: {
        include: {
          supplierRef: true,
        },
      },
      inspector: true,
      approvedBy: true,
      results: {
        include: {
          ctqDefinition: true,
          inspector: true,
        },
        orderBy: [
          { ctqDefinitionId: 'asc' },
          { sampleNumber: 'asc' },
        ],
      },
    },
  });

  return inspection;
}

// =============================================================================
// MUTATION ACTIONS
// =============================================================================

/**
 * Start an inspection - set status to in_progress and assign inspector
 */
export async function startInspection(inspectionId: string) {
  startInspectionSchema.parse({ inspectionId });
  const user = await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: { materialLot: true },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (inspection.status !== 'pending') {
    throw new Error(`Cannot start inspection with status: ${inspection.status}`);
  }

  const updated = await prisma.incomingInspection.update({
    where: { id: inspectionId },
    data: {
      status: 'in_progress',
      inspectorId: user.id,
      startedAt: new Date(),
    },
    include: {
      materialLot: true,
    },
  });

  // Get siteId from any available source
  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'default';

  await emitEvent({
    eventType: 'iqc_inspection_started',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      materialLotId: inspection.materialLotId,
      lotNumber: inspection.materialLot.lotNumber,
      materialCode: inspection.materialLot.materialCode,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('iqc_inspection_started', inspectionId),
  });

  revalidatePath('/admin/iqc');
  return updated;
}

/**
 * Record a single measurement for a CTQ dimension and sample
 * Auto-evaluates pass/fail against USL/LSL
 */
export async function recordMeasurement(data: {
  inspectionId: string;
  ctqDefinitionId: string;
  sampleNumber: number;
  measuredValue: number;
  notes?: string;
}) {
  recordMeasurementSchema.parse(data);
  const user = await requireRole(['admin', 'supervisor']);

  // Verify inspection exists and is in_progress
  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: data.inspectionId },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (inspection.status !== 'in_progress') {
    throw new Error('Inspection must be in progress to record measurements');
  }

  // Get the CTQ definition to evaluate pass/fail
  const ctq = await prisma.cTQDefinition.findUnique({
    where: { id: data.ctqDefinitionId },
  });

  if (!ctq) {
    throw new Error('CTQ definition not found');
  }

  // Auto-evaluate: pass if measuredValue is within [LSL, USL]
  const result = data.measuredValue >= ctq.lsl && data.measuredValue <= ctq.usl
    ? 'pass'
    : 'fail';

  // Upsert to allow re-measurement
  const existing = await prisma.iQCResult.findFirst({
    where: {
      inspectionId: data.inspectionId,
      ctqDefinitionId: data.ctqDefinitionId,
      sampleNumber: data.sampleNumber,
    },
  });

  let measurement;
  if (existing) {
    measurement = await prisma.iQCResult.update({
      where: { id: existing.id },
      data: {
        measuredValue: data.measuredValue,
        result,
        inspectorId: user.id,
        notes: data.notes ?? null,
        measuredAt: new Date(),
      },
    });
  } else {
    measurement = await prisma.iQCResult.create({
      data: {
        inspectionId: data.inspectionId,
        ctqDefinitionId: data.ctqDefinitionId,
        sampleNumber: data.sampleNumber,
        measuredValue: data.measuredValue,
        result,
        inspectorId: user.id,
        notes: data.notes ?? null,
      },
    });
  }

  revalidatePath('/admin/iqc');
  return { ...measurement, ctq };
}

/**
 * Disposition as conforming - lot becomes available
 */
export async function dispositionConforming(inspectionId: string, notes?: string) {
  dispositionConformingSchema.parse({ inspectionId, notes });
  const user = await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: { materialLot: true },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (inspection.status !== 'in_progress') {
    throw new Error('Inspection must be in progress to disposition');
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.incomingInspection.update({
      where: { id: inspectionId },
      data: {
        status: 'completed',
        overallResult: 'conforming',
        dispositionNotes: notes ?? null,
        completedAt: now,
      },
    }),
    prisma.materialLot.update({
      where: { id: inspection.materialLotId },
      data: {
        status: 'available',
      },
    }),
  ]);

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'default';

  await emitEvent({
    eventType: 'iqc_inspection_completed',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      materialLotId: inspection.materialLotId,
      lotNumber: inspection.materialLot.lotNumber,
      materialCode: inspection.materialLot.materialCode,
      overallResult: 'conforming',
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('iqc_inspection_completed', inspectionId),
  });

  await emitEvent({
    eventType: 'iqc_disposition_recorded',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      disposition: 'conforming',
      lotStatus: 'available',
      notes,
    },
    source: 'ui',
  });

  revalidatePath('/admin/iqc');
  return { success: true };
}

/**
 * Disposition as nonconforming - creates NCR, updates inspection
 */
export async function dispositionNonconforming(
  inspectionId: string,
  type: 'rework' | 'uai' | 'scrap',
  data: {
    defectType: string;
    description?: string;
    dispositionRationale: string;
    correctiveAction?: string;
    responsibleParty?: string;
    actionDueDate?: Date;
  }
) {
  dispositionNonconformingSchema.parse({
    inspectionId,
    type,
    ...data,
  });
  const user = await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: {
      materialLot: true,
      results: { include: { ctqDefinition: true } },
    },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (inspection.status !== 'in_progress') {
    throw new Error('Inspection must be in progress to disposition');
  }

  // Generate NCR number: NCR-YYYY-NNNN
  const ncrNumber = await generateNcrNumber();

  // Map IQC type to overallResult
  const overallResultMap = {
    rework: 'nonconforming_rework',
    uai: 'nonconforming_uai',
    scrap: 'nonconforming_scrap',
  } as const;

  // Collect failed dimensions
  const failedDimensions = inspection.results
    .filter((r) => r.result === 'fail')
    .map((r) => ({
      dimensionName: r.ctqDefinition.dimensionName,
      nominal: r.ctqDefinition.nominal,
      usl: r.ctqDefinition.usl,
      lsl: r.ctqDefinition.lsl,
      measuredValue: r.measuredValue,
      sampleNumber: r.sampleNumber,
    }));

  const now = new Date();
  const inspectionStatus = type === 'uai' ? 'in_progress' : 'completed';

  await prisma.$transaction([
    prisma.incomingInspection.update({
      where: { id: inspectionId },
      data: {
        status: inspectionStatus,
        overallResult: overallResultMap[type],
        dispositionNotes: data.dispositionRationale,
        completedAt: type === 'uai' ? null : now,
      },
    }),
    prisma.materialLot.update({
      where: { id: inspection.materialLotId },
      data: {
        status: 'quarantine',
      },
    }),
    prisma.nonconformanceRecord.create({
      data: {
        ncrNumber,
        materialLotId: inspection.materialLotId,
        partNumber: inspection.materialLot.materialCode,
        defectType: data.defectType,
        description: data.description ?? null,
        failedDimensions: failedDimensions,
        disposition: type === 'rework' ? 'rework' : type === 'scrap' ? 'scrap' : 'use_as_is',
        dispositionRationale: data.dispositionRationale,
        correctiveAction: data.correctiveAction ?? null,
        responsibleParty: data.responsibleParty ?? null,
        actionDueDate: data.actionDueDate ?? null,
        affectedQty: inspection.materialLot.qtyRemaining,
        status: 'open',
        source: 'iqc',
        supplierNotified: false,
      },
    }),
  ]);

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'default';

  await emitEvent({
    eventType: 'iqc_disposition_recorded',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      disposition: overallResultMap[type],
      ncrNumber,
      materialLotId: inspection.materialLotId,
      lotNumber: inspection.materialLot.lotNumber,
      materialCode: inspection.materialLot.materialCode,
      failedDimensions,
      defectType: data.defectType,
    },
    source: 'ui',
  });

  if (type !== 'uai') {
    await emitEvent({
      eventType: 'iqc_inspection_completed',
      siteId,
      operatorId: user.id,
      payload: {
        inspectionId,
        materialLotId: inspection.materialLotId,
        overallResult: overallResultMap[type],
        ncrNumber,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('iqc_inspection_completed', inspectionId),
    });
  }

  revalidatePath('/admin/iqc');
  return { success: true, ncrNumber };
}

/**
 * Approve Use-As-Is disposition - engineer sign-off, releases lot to available
 */
export async function approveUAI(inspectionId: string, approverNotes?: string) {
  approveUAISchema.parse({ inspectionId, approverNotes });
  const user = await requireRole(['admin', 'supervisor']);

  const inspection = await prisma.incomingInspection.findUnique({
    where: { id: inspectionId },
    include: { materialLot: true },
  });

  if (!inspection) {
    throw new Error('Inspection not found');
  }

  if (inspection.overallResult !== 'nonconforming_uai') {
    throw new Error('Inspection is not awaiting UAI approval');
  }

  if (inspection.status !== 'in_progress') {
    throw new Error('Inspection must be in progress for UAI approval');
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.incomingInspection.update({
      where: { id: inspectionId },
      data: {
        status: 'completed',
        approvedById: user.id,
        completedAt: now,
        dispositionNotes: approverNotes
          ? `${inspection.dispositionNotes ?? ''}\n\nUAI Approval: ${approverNotes}`.trim()
          : inspection.dispositionNotes,
      },
    }),
    prisma.materialLot.update({
      where: { id: inspection.materialLotId },
      data: {
        status: 'available',
      },
    }),
  ]);

  const site = await prisma.site.findFirst({ where: { active: true } });
  const siteId = site?.id ?? 'default';

  await emitEvent({
    eventType: 'iqc_uai_approved',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      materialLotId: inspection.materialLotId,
      lotNumber: inspection.materialLot.lotNumber,
      approvedBy: user.name,
      approverNotes,
    },
    source: 'ui',
  });

  await emitEvent({
    eventType: 'iqc_inspection_completed',
    siteId,
    operatorId: user.id,
    payload: {
      inspectionId,
      materialLotId: inspection.materialLotId,
      overallResult: 'nonconforming_uai',
      uaiApproved: true,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('iqc_inspection_completed', inspectionId),
  });

  revalidatePath('/admin/iqc');
  return { success: true };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate next NCR number in format NCR-YYYY-NNNN
 */
async function generateNcrNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NCR-${year}-`;

  const maxNcr = await prisma.nonconformanceRecord.findFirst({
    where: {
      ncrNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { ncrNumber: true },
  });

  let nextSeq = 1;
  if (maxNcr?.ncrNumber) {
    const seqStr = maxNcr.ncrNumber.replace(prefix, '');
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Determine the required sample count for a CTQ based on its rule
 * NOTE: Not exported because 'use server' files can only export async functions.
 * If needed in client components, copy this logic locally.
 */
function getSampleCount(ctq: {
  sampleSizeRule: string;
  sampleSize?: number | null;
}, lotQty?: number): number {
  switch (ctq.sampleSizeRule) {
    case 'all':
      return lotQty ?? 1;
    case 'fixed_count':
      return ctq.sampleSize ?? 1;
    case 'aql':
      // Simplified AQL: use sampleSize if set, otherwise default based on lot size
      return ctq.sampleSize ?? Math.max(1, Math.min(8, Math.ceil((lotQty ?? 10) * 0.1)));
    case 'skip':
      return 0;
    default:
      return 1;
  }
}
