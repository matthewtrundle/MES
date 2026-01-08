'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

/**
 * Get all work orders for a site with optional status filter
 */
export async function getWorkOrders(siteId: string, status?: string) {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      siteId,
      ...(status && { status }),
    },
    include: {
      routing: true,
      units: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
        },
      },
      operations: {
        include: {
          station: true,
        },
        orderBy: {
          sequence: 'asc',
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return workOrders;
}

/**
 * Get a single work order by ID
 */
export async function getWorkOrder(workOrderId: string) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      site: true,
      routing: true,
      units: {
        include: {
          executions: {
            include: {
              station: true,
              operator: true,
            },
            orderBy: { startedAt: 'desc' },
          },
        },
      },
      operations: {
        include: {
          station: true,
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  return workOrder;
}

/**
 * Release a work order for production
 * Only admins and supervisors can release work orders
 */
export async function releaseWorkOrder(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { routing: true },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  if (workOrder.status !== 'pending') {
    throw new Error(`Cannot release work order in ${workOrder.status} status`);
  }

  // Update work order status
  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'released',
      releasedAt: new Date(),
    },
  });

  // Emit event
  await emitEvent({
    eventType: 'work_order_released',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      productCode: workOrder.productCode,
      qtyOrdered: workOrder.qtyOrdered,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('work_order_released', workOrderId),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');
  revalidatePath('/station');

  return updatedWorkOrder;
}

/**
 * Complete a work order
 * Only supervisors and admins can complete work orders
 */
export async function completeWorkOrder(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      units: true,
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  if (workOrder.status !== 'in_progress' && workOrder.status !== 'released') {
    throw new Error(`Cannot complete work order in ${workOrder.status} status`);
  }

  const completedUnits = workOrder.units.filter((u) => u.status === 'completed').length;

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      qtyCompleted: completedUnits,
    },
  });

  await emitEvent({
    eventType: 'work_order_completed',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      qtyOrdered: workOrder.qtyOrdered,
      qtyCompleted: completedUnits,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('work_order_completed', workOrderId),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');

  return updatedWorkOrder;
}

/**
 * Get work orders available at a specific station
 */
export async function getStationWorkOrders(stationId: string) {
  const station = await prisma.station.findUnique({
    where: { id: stationId },
  });

  if (!station) {
    throw new Error('Station not found');
  }

  // Get work orders that have operations at this station
  const workOrders = await prisma.workOrder.findMany({
    where: {
      siteId: station.siteId,
      status: { in: ['released', 'in_progress'] },
      operations: {
        some: {
          stationId: stationId,
          status: { in: ['pending', 'in_progress'] },
        },
      },
    },
    include: {
      units: {
        where: {
          status: { in: ['created', 'in_progress', 'rework'] },
        },
      },
      operations: {
        where: {
          stationId: stationId,
        },
        include: {
          station: true,
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { releasedAt: 'asc' }],
  });

  return workOrders;
}

/**
 * Create a new work order (for admin import)
 */
export async function createWorkOrder(data: {
  siteId: string;
  orderNumber: string;
  productCode: string;
  productName?: string;
  qtyOrdered: number;
  routingId?: string;
  priority?: number;
  dueDate?: Date;
}) {
  const user = await requireRole(['admin']);

  // Check for duplicate order number
  const existing = await prisma.workOrder.findUnique({
    where: { orderNumber: data.orderNumber },
  });

  if (existing) {
    throw new Error(`Work order ${data.orderNumber} already exists`);
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      siteId: data.siteId,
      orderNumber: data.orderNumber,
      productCode: data.productCode,
      productName: data.productName,
      qtyOrdered: data.qtyOrdered,
      routingId: data.routingId,
      priority: data.priority ?? 0,
      dueDate: data.dueDate,
      status: 'pending',
    },
  });

  // If routing is provided, create operations
  if (data.routingId) {
    const routing = await prisma.routing.findUnique({
      where: { id: data.routingId },
    });

    if (routing && routing.operations) {
      const ops = routing.operations as Array<{
        stationId: string;
        sequence: number;
        estimatedMinutes?: number;
      }>;

      await prisma.workOrderOperation.createMany({
        data: ops.map((op) => ({
          workOrderId: workOrder.id,
          stationId: op.stationId,
          sequence: op.sequence,
          estimatedMinutes: op.estimatedMinutes,
          status: 'pending',
        })),
      });
    }
  }

  await emitEvent({
    eventType: 'work_order_imported',
    siteId: data.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      productCode: workOrder.productCode,
      qtyOrdered: workOrder.qtyOrdered,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('work_order_imported', data.orderNumber),
  });

  revalidatePath('/admin/work-orders');

  return workOrder;
}
