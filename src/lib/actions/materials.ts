'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireUser } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { consumeMaterialSchema } from '@/lib/validation/schemas';

/**
 * Get material lots available for consumption
 */
export async function getAvailableMaterialLots(materialCode?: string) {
  const lots = await prisma.materialLot.findMany({
    where: {
      qtyRemaining: { gt: 0 },
      ...(materialCode && { materialCode }),
      // Exclude expired lots
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [{ receivedAt: 'asc' }], // FIFO
  });

  return lots;
}

/**
 * Get material lots expiring within a given number of days
 */
export async function getExpiringLots(withinDays: number = 7) {
  const now = new Date();
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const lots = await prisma.materialLot.findMany({
    where: {
      qtyRemaining: { gt: 0 },
      expiresAt: {
        not: null,
        gt: now,
        lte: threshold,
      },
    },
    orderBy: [{ expiresAt: 'asc' }],
  });

  return lots;
}

/**
 * Search for a material lot by lot number
 */
export async function searchMaterialLot(lotNumber: string) {
  const lot = await prisma.materialLot.findUnique({
    where: { lotNumber },
    include: {
      consumptions: {
        include: {
          unit: true,
          station: true,
          operator: true,
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      },
    },
  });

  return lot;
}

/**
 * Record material consumption for a unit
 */
export async function consumeMaterial(data: {
  unitId: string;
  materialLotId: string;
  qtyConsumed: number;
  stationId: string;
}) {
  consumeMaterialSchema.parse(data);
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

  const lot = await prisma.materialLot.findUnique({
    where: { id: data.materialLotId },
  });

  if (!lot) {
    throw new Error('Material lot not found');
  }

  if (lot.expiresAt && lot.expiresAt < new Date()) {
    throw new Error(`Material lot ${lot.lotNumber} has expired (${lot.expiresAt.toISOString()})`);
  }

  if (lot.qtyRemaining < data.qtyConsumed) {
    throw new Error(`Insufficient quantity. Available: ${lot.qtyRemaining}`);
  }

  const station = await prisma.station.findUnique({
    where: { id: data.stationId },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  // Create consumption record and update lot quantity in a transaction
  const [consumption] = await prisma.$transaction([
    prisma.unitMaterialConsumption.create({
      data: {
        unitId: data.unitId,
        materialLotId: data.materialLotId,
        qtyConsumed: data.qtyConsumed,
        stationId: data.stationId,
        operatorId: user.id,
      },
    }),
    prisma.materialLot.update({
      where: { id: data.materialLotId },
      data: {
        qtyRemaining: { decrement: data.qtyConsumed },
      },
    }),
  ]);

  await emitEvent({
    eventType: 'material_lot_consumed',
    siteId: unit.workOrder.siteId,
    stationId: data.stationId,
    workOrderId: unit.workOrderId,
    unitId: unit.id,
    operatorId: user.id,
    payload: {
      serialNumber: unit.serialNumber,
      lotNumber: lot.lotNumber,
      materialCode: lot.materialCode,
      qtyConsumed: data.qtyConsumed,
      qtyRemaining: lot.qtyRemaining - data.qtyConsumed,
      stationName: station.name,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('material_lot_consumed', `${data.unitId}:${data.materialLotId}:${data.stationId}`),
  });

  revalidatePath('/station');

  return consumption;
}

/**
 * Get material consumptions for a unit (genealogy)
 */
export async function getUnitMaterials(unitId: string) {
  const consumptions = await prisma.unitMaterialConsumption.findMany({
    where: { unitId },
    include: {
      materialLot: true,
      station: true,
      operator: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  return consumptions;
}

/**
 * Get units that consumed a specific material lot (traceability)
 */
export async function getUnitsFromLot(materialLotId: string) {
  const consumptions = await prisma.unitMaterialConsumption.findMany({
    where: { materialLotId },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
      station: true,
      operator: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  return consumptions;
}

/**
 * Get lot details with full usage history
 */
export async function getMaterialLotWithHistory(lotId: string) {
  const lot = await prisma.materialLot.findUnique({
    where: { id: lotId },
    include: {
      consumptions: {
        include: {
          unit: {
            include: {
              workOrder: true,
            },
          },
          station: true,
          operator: true,
        },
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  return lot;
}
