'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { uuid, positiveNumber } from '@/lib/validation/schemas';

const pickKitLineSchema = z.object({
  kitLineId: uuid,
  materialLotId: uuid,
  qtyPicked: positiveNumber,
});

/**
 * Create a kit for a work order, auto-generating lines from BOM
 */
export async function createKitForWorkOrder(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      routing: true,
      kit: true,
    },
  });

  if (!workOrder) throw new Error('Work order not found');
  if (workOrder.kit) throw new Error('Kit already exists for this work order');
  if (!workOrder.routingId) throw new Error('Work order has no routing assigned');

  // Get BOM items for this routing
  const bomItems = await prisma.billOfMaterial.findMany({
    where: {
      routingId: workOrder.routingId,
      active: true,
    },
    orderBy: [
      { station: { sequenceOrder: 'asc' } },
      { materialCode: 'asc' },
    ],
  });

  if (bomItems.length === 0) {
    throw new Error('No BOM items defined for this routing. Add materials to the BOM first.');
  }

  const site = await prisma.site.findFirst();

  // Create kit with lines in a transaction
  const kit = await prisma.$transaction(async (tx) => {
    const newKit = await tx.kit.create({
      data: {
        workOrderId,
        createdById: user.id,
        status: 'pending',
        lines: {
          create: bomItems.map((item) => ({
            materialCode: item.materialCode,
            description: item.description,
            qtyRequired: item.qtyPerUnit * workOrder.qtyOrdered,
          })),
        },
      },
      include: { lines: true },
    });

    return newKit;
  });

  if (site) {
    await emitEvent({
      eventType: 'config_changed',
      siteId: site.id,
      workOrderId,
      operatorId: user.id,
      payload: {
        action: 'kit_created',
        kitId: kit.id,
        orderNumber: workOrder.orderNumber,
        lineCount: kit.lines.length,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/kitting');
  return kit;
}

/**
 * Pick a kit line — assign a material lot and record qty picked
 */
export async function pickKitLine(data: z.infer<typeof pickKitLineSchema>) {
  const validated = pickKitLineSchema.parse(data);
  const user = await requireRole(['admin', 'supervisor']);

  const kitLine = await prisma.kitLine.findUnique({
    where: { id: validated.kitLineId },
    include: {
      kit: {
        include: { workOrder: true },
      },
    },
  });

  if (!kitLine) throw new Error('Kit line not found');
  if (kitLine.kit.status === 'issued') throw new Error('Kit already issued');

  const lot = await prisma.materialLot.findUnique({
    where: { id: validated.materialLotId },
  });

  if (!lot) throw new Error('Material lot not found');
  if (lot.materialCode !== kitLine.materialCode) {
    throw new Error(`Lot material code (${lot.materialCode}) does not match kit line (${kitLine.materialCode})`);
  }
  if (lot.status !== 'available') {
    throw new Error(`Material lot is not available (status: ${lot.status})`);
  }
  if (lot.expiresAt && lot.expiresAt < new Date()) {
    throw new Error('Material lot has expired');
  }
  if (lot.qtyRemaining < validated.qtyPicked) {
    throw new Error(`Insufficient quantity. Available: ${lot.qtyRemaining}`);
  }

  const remainingNeeded = kitLine.qtyRequired - kitLine.qtyPicked;
  if (validated.qtyPicked > remainingNeeded) {
    throw new Error(`Only ${remainingNeeded} more needed for this line`);
  }

  // Update kit line and reserve material in a transaction
  await prisma.$transaction([
    prisma.kitLine.update({
      where: { id: validated.kitLineId },
      data: {
        materialLotId: validated.materialLotId,
        qtyPicked: { increment: validated.qtyPicked },
        pickedById: user.id,
        pickedAt: new Date(),
      },
    }),
    prisma.materialLot.update({
      where: { id: validated.materialLotId },
      data: {
        qtyRemaining: { decrement: validated.qtyPicked },
      },
    }),
  ]);

  // Update kit status to in_progress if still pending
  const kit = kitLine.kit;
  if (kit.status === 'pending') {
    await prisma.kit.update({
      where: { id: kit.id },
      data: { status: 'in_progress' },
    });
  }

  // Check if all lines are fully picked
  const allLines = await prisma.kitLine.findMany({
    where: { kitId: kit.id },
  });
  const allPicked = allLines.every((l) => l.qtyPicked >= l.qtyRequired);
  if (allPicked) {
    await prisma.kit.update({
      where: { id: kit.id },
      data: { status: 'complete' },
    });
  }

  revalidatePath('/admin/kitting');
  return { success: true };
}

/**
 * Issue a kit — mark it as issued for production
 */
export async function issueKit(kitId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const kit = await prisma.kit.findUnique({
    where: { id: kitId },
    include: {
      lines: true,
      workOrder: true,
    },
  });

  if (!kit) throw new Error('Kit not found');
  if (kit.status === 'issued') throw new Error('Kit already issued');

  // Verify all lines are fully picked
  const shortages = kit.lines.filter((l) => l.qtyPicked < l.qtyRequired);
  if (shortages.length > 0) {
    throw new Error(
      `Cannot issue kit — ${shortages.length} line(s) not fully picked`
    );
  }

  const site = await prisma.site.findFirst();

  await prisma.kit.update({
    where: { id: kitId },
    data: {
      status: 'issued',
      issuedAt: new Date(),
      issuedById: user.id,
    },
  });

  if (site) {
    await emitEvent({
      eventType: 'config_changed',
      siteId: site.id,
      workOrderId: kit.workOrderId,
      operatorId: user.id,
      payload: {
        action: 'kit_issued',
        kitId: kit.id,
        orderNumber: kit.workOrder.orderNumber,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/kitting');
  return { success: true };
}

/**
 * Get kit for a work order
 */
export async function getKitForWorkOrder(workOrderId: string) {
  const kit = await prisma.kit.findUnique({
    where: { workOrderId },
    include: {
      lines: {
        include: {
          materialLot: {
            select: { lotNumber: true, qtyRemaining: true, expiresAt: true },
          },
          pickedBy: {
            select: { name: true },
          },
        },
        orderBy: { materialCode: 'asc' },
      },
      createdBy: { select: { name: true } },
      issuedBy: { select: { name: true } },
    },
  });

  return kit;
}

/**
 * Get kit shortages for a kit
 */
export async function getKitShortages(kitId: string) {
  const lines = await prisma.kitLine.findMany({
    where: {
      kitId,
      // Lines where picked < required
    },
    orderBy: { materialCode: 'asc' },
  });

  return lines
    .filter((l) => l.qtyPicked < l.qtyRequired)
    .map((l) => ({
      ...l,
      qtyShort: l.qtyRequired - l.qtyPicked,
    }));
}

/**
 * Get all work orders with their kit status
 */
export async function getWorkOrdersWithKitStatus() {
  await requireRole(['admin', 'supervisor']);

  const workOrders = await prisma.workOrder.findMany({
    where: {
      status: { in: ['pending', 'released', 'in_progress'] },
    },
    include: {
      routing: { select: { name: true } },
      kit: {
        select: {
          id: true,
          status: true,
          issuedAt: true,
          _count: {
            select: { lines: true },
          },
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return workOrders;
}
