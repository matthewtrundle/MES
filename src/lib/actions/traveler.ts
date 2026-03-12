'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { ASSEMBLY_GROUP_ORDER, type AssemblyGroup } from '@/lib/types/process-steps';

export interface TravelerStepData {
  id: string;
  sequenceOrder: number;
  name: string;
  description: string | null;
  category: string;
  dataFields: unknown[];
  isMandatory: boolean;
  cycleTimeTarget: number | null;
  stationName: string;
  stationId: string;
  captures: {
    operatorId: string;
    capturedData: unknown;
    signedOff: boolean;
    signedOffAt: Date | null;
    createdAt: Date;
  }[];
}

export interface TravelerBomItem {
  id: string;
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  unitOfMeasure: string;
  stationName: string;
  assemblyGroup: string;
}

export interface TravelerOperation {
  id: string;
  sequence: number;
  stationName: string;
  stationId: string;
  estimatedMinutes: number | null;
  status: string;
}

export interface TravelerQualityCheck {
  id: string;
  name: string;
  checkType: string;
  parameters: unknown;
  stationNames: string[];
}

export interface TravelerData {
  workOrder: {
    id: string;
    orderNumber: string;
    productCode: string;
    productName: string | null;
    qtyOrdered: number;
    qtyCompleted: number;
    status: string;
    priority: number;
    releasedAt: Date | null;
    dueDate: Date | null;
    createdAt: Date;
    siteName: string;
    routingName: string | null;
  };
  operations: TravelerOperation[];
  bomItems: TravelerBomItem[];
  processSteps: TravelerStepData[];
  qualityChecks: TravelerQualityCheck[];
  units: {
    id: string;
    serialNumber: string;
    status: string;
  }[];
}

/**
 * Get all data needed for a production traveler document.
 */
export async function getTravelerData(workOrderId: string): Promise<TravelerData> {
  await requireRole(['operator', 'supervisor', 'admin']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      site: true,
      routing: {
        include: {
          bom: {
            where: { active: true },
            include: { station: true },
          },
        },
      },
      operations: {
        include: { station: true },
        orderBy: { sequence: 'asc' },
      },
      units: {
        orderBy: { serialNumber: 'asc' },
      },
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  const stationIds = workOrder.operations.map((op) => op.stationId);

  // Get process step definitions for these stations
  const processSteps = await prisma.processStepDefinition.findMany({
    where: {
      stationId: { in: stationIds },
      active: true,
    },
    include: {
      station: true,
      dataCaptures: true,
    },
    orderBy: { sequenceOrder: 'asc' },
  });

  // Get quality check definitions
  const qualityChecks = await prisma.qualityCheckDefinition.findMany({
    where: { active: true },
  });

  const relevantQualityChecks = qualityChecks.filter((qc) =>
    (qc.stationIds as string[]).some((sid) => stationIds.includes(sid))
  );

  const stationMap = new Map<string, string>();
  workOrder.operations.forEach((op) => {
    stationMap.set(op.stationId, op.station.name);
  });

  // Map categories to assembly groups for BOM display
  const stepCategories = new Map<string, string>();
  processSteps.forEach((ps) => {
    if (ps.stationId) stepCategories.set(ps.stationId, ps.category);
  });

  // Sort process steps by category order, then sequence
  const sortedSteps = [...processSteps].sort((a, b) => {
    const aGroupIdx = ASSEMBLY_GROUP_ORDER.indexOf(a.category as AssemblyGroup);
    const bGroupIdx = ASSEMBLY_GROUP_ORDER.indexOf(b.category as AssemblyGroup);
    if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;
    return a.sequenceOrder - b.sequenceOrder;
  });

  return {
    workOrder: {
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      productCode: workOrder.productCode,
      productName: workOrder.productName,
      qtyOrdered: workOrder.qtyOrdered,
      qtyCompleted: workOrder.qtyCompleted,
      status: workOrder.status,
      priority: workOrder.priority,
      releasedAt: workOrder.releasedAt,
      dueDate: workOrder.dueDate,
      createdAt: workOrder.createdAt,
      siteName: workOrder.site.name,
      routingName: workOrder.routing?.name ?? null,
    },
    operations: workOrder.operations.map((op) => ({
      id: op.id,
      sequence: op.sequence,
      stationName: op.station.name,
      stationId: op.stationId,
      estimatedMinutes: op.estimatedMinutes,
      status: op.status,
    })),
    bomItems: (workOrder.routing?.bom ?? []).map((item) => ({
      id: item.id,
      materialCode: item.materialCode,
      description: item.description,
      qtyPerUnit: item.qtyPerUnit,
      unitOfMeasure: item.unitOfMeasure,
      stationName: item.station.name,
      assemblyGroup: stepCategories.get(item.stationId) ?? 'final_assembly',
    })),
    processSteps: sortedSteps.map((ps) => ({
      id: ps.id,
      sequenceOrder: ps.sequenceOrder,
      name: ps.name,
      description: ps.description,
      category: ps.category,
      dataFields: ps.dataFields as unknown[],
      isMandatory: ps.isMandatory,
      cycleTimeTarget: ps.cycleTimeTarget,
      stationName: ps.station?.name ?? 'Unassigned',
      stationId: ps.stationId ?? '',
      captures: ps.dataCaptures.map((dc) => ({
        operatorId: dc.operatorId,
        capturedData: dc.capturedData,
        signedOff: dc.signedOff,
        signedOffAt: dc.signedOffAt,
        createdAt: dc.createdAt,
      })),
    })),
    qualityChecks: relevantQualityChecks.map((qc) => ({
      id: qc.id,
      name: qc.name,
      checkType: qc.checkType,
      parameters: qc.parameters,
      stationNames: (qc.stationIds as string[])
        .filter((sid) => stationIds.includes(sid))
        .map((sid) => stationMap.get(sid) ?? 'Unknown'),
    })),
    units: workOrder.units.map((u) => ({
      id: u.id,
      serialNumber: u.serialNumber,
      status: u.status,
    })),
  };
}
