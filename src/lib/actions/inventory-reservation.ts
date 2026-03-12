'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

export interface ReservationResult {
  materialCode: string;
  qtyRequired: number;
  qtyReserved: number;
  qtyShort: number;
  reservations: Array<{
    lotNumber: string;
    lotId: string;
    qtyReserved: number;
  }>;
}

export interface ReserveInventoryResult {
  workOrderId: string;
  results: ReservationResult[];
  hasShortages: boolean;
  shortages: Array<{
    materialCode: string;
    qtyRequired: number;
    qtyAvailable: number;
    qtyShort: number;
  }>;
}

/**
 * Reserve inventory for a work order based on BOM requirements using FIFO.
 * Finds available MaterialLots for each BOM line item and reserves quantity
 * starting from the oldest lot (by receivedAt).
 *
 * If insufficient inventory exists for any BOM item, flags shortage
 * but still reserves whatever is available.
 */
export async function reserveInventoryForWorkOrder(
  workOrderId: string
): Promise<ReserveInventoryResult> {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      routing: {
        include: {
          bom: {
            where: { active: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  if (!workOrder.routing) {
    throw new Error('Work order has no routing assigned');
  }

  const bomItems = workOrder.routing.bom;
  if (bomItems.length === 0) {
    return {
      workOrderId,
      results: [],
      hasShortages: false,
      shortages: [],
    };
  }

  // Group BOM items by materialCode and sum total qty needed
  const materialNeeds: Record<string, number> = {};
  for (const item of bomItems) {
    const totalNeeded = item.qtyPerUnit * workOrder.qtyOrdered;
    materialNeeds[item.materialCode] =
      (materialNeeds[item.materialCode] || 0) + totalNeeded;
  }

  const results: ReservationResult[] = [];
  const shortages: ReserveInventoryResult['shortages'] = [];

  // Process each material code
  for (const [materialCode, qtyRequired] of Object.entries(materialNeeds)) {
    // Find available lots in FIFO order (oldest first by receivedAt)
    const availableLots = await prisma.materialLot.findMany({
      where: {
        materialCode,
        status: 'available',
        qtyRemaining: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });

    let remainingToReserve = qtyRequired;
    const lotReservations: ReservationResult['reservations'] = [];

    for (const lot of availableLots) {
      if (remainingToReserve <= 0) break;

      const availableQty = lot.qtyRemaining - lot.qtyReserved;
      if (availableQty <= 0) continue;

      const reserveQty = Math.min(availableQty, remainingToReserve);

      // Create reservation and update lot in a transaction
      await prisma.$transaction([
        prisma.inventoryReservation.create({
          data: {
            workOrderId,
            materialLotId: lot.id,
            materialCode,
            qtyReserved: reserveQty,
            status: 'active',
          },
        }),
        prisma.materialLot.update({
          where: { id: lot.id },
          data: {
            qtyReserved: { increment: reserveQty },
          },
        }),
      ]);

      lotReservations.push({
        lotNumber: lot.lotNumber,
        lotId: lot.id,
        qtyReserved: reserveQty,
      });

      remainingToReserve -= reserveQty;
    }

    const totalReserved = qtyRequired - remainingToReserve;
    const result: ReservationResult = {
      materialCode,
      qtyRequired,
      qtyReserved: totalReserved,
      qtyShort: Math.max(0, remainingToReserve),
      reservations: lotReservations,
    };

    results.push(result);

    if (remainingToReserve > 0) {
      shortages.push({
        materialCode,
        qtyRequired,
        qtyAvailable: totalReserved,
        qtyShort: remainingToReserve,
      });
    }
  }

  // Emit event
  await emitEvent({
    eventType: 'inventory_reserved',
    siteId: workOrder.siteId,
    workOrderId,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      reservationCount: results.reduce(
        (sum, r) => sum + r.reservations.length,
        0
      ),
      hasShortages: shortages.length > 0,
      shortages,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard/inventory');

  return {
    workOrderId,
    results,
    hasShortages: shortages.length > 0,
    shortages,
  };
}

/**
 * Release all inventory reservations for a work order.
 * Used when a WO is cancelled or reservations need to be re-calculated.
 */
export async function releaseReservation(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  // Get all active reservations for this work order
  const reservations = await prisma.inventoryReservation.findMany({
    where: {
      workOrderId,
      status: 'active',
    },
  });

  if (reservations.length === 0) {
    return { released: 0 };
  }

  // Release each reservation and decrement qtyReserved on the lot
  for (const reservation of reservations) {
    await prisma.$transaction([
      prisma.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'released' },
      }),
      prisma.materialLot.update({
        where: { id: reservation.materialLotId },
        data: {
          qtyReserved: {
            decrement: reservation.qtyReserved,
          },
        },
      }),
    ]);
  }

  // Emit event
  await emitEvent({
    eventType: 'inventory_reservation_released',
    siteId: workOrder.siteId,
    workOrderId,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      reservationsReleased: reservations.length,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard/inventory');

  return { released: reservations.length };
}

/**
 * Get reservation status for a work order
 */
export async function getWorkOrderReservations(workOrderId: string) {
  const reservations = await prisma.inventoryReservation.findMany({
    where: {
      workOrderId,
      status: 'active',
    },
    include: {
      materialLot: {
        select: {
          lotNumber: true,
          materialCode: true,
          description: true,
          qtyRemaining: true,
          qtyReserved: true,
          unitOfMeasure: true,
        },
      },
    },
    orderBy: { materialCode: 'asc' },
  });

  // Group by material code
  const grouped: Record<
    string,
    {
      materialCode: string;
      description: string | null;
      unitOfMeasure: string;
      totalReserved: number;
      lots: Array<{
        lotNumber: string;
        qtyReserved: number;
      }>;
    }
  > = {};

  for (const r of reservations) {
    if (!grouped[r.materialCode]) {
      grouped[r.materialCode] = {
        materialCode: r.materialCode,
        description: r.materialLot.description,
        unitOfMeasure: r.materialLot.unitOfMeasure,
        totalReserved: 0,
        lots: [],
      };
    }
    grouped[r.materialCode].totalReserved += r.qtyReserved;
    grouped[r.materialCode].lots.push({
      lotNumber: r.materialLot.lotNumber,
      qtyReserved: r.qtyReserved,
    });
  }

  return Object.values(grouped);
}
