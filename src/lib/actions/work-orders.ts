'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import { createWorkOrderSchema, cancelWorkOrderSchema } from '@/lib/validation/schemas';
import { reserveInventoryForWorkOrder, releaseReservation } from './inventory-reservation';

/**
 * P1.6: Valid work order status transitions
 * draft -> pending -> released -> kitting -> in_progress -> in_testing -> completed -> shipped
 * cancelled can be reached from any state
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['released', 'cancelled'],
  released: ['kitting', 'in_progress', 'cancelled'],
  kitting: ['in_progress', 'cancelled'],
  in_progress: ['in_testing', 'completed', 'cancelled'],
  in_testing: ['completed', 'in_progress', 'cancelled'],
  completed: ['shipped', 'cancelled'],
  shipped: ['cancelled'],
  cancelled: [],
};

function validateStatusTransition(currentStatus: string, newStatus: string) {
  const validNext = VALID_TRANSITIONS[currentStatus];
  if (!validNext || !validNext.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: cannot go from "${currentStatus}" to "${newStatus}"`
    );
  }
}

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
    include: { routing: true, kit: true },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'released');

  // Warn if kit is not issued (return warning info but don't block release)
  const kitWarning = workOrder.kit
    ? workOrder.kit.status !== 'issued'
      ? `Kit exists but is in "${workOrder.kit.status}" status (not issued)`
      : null
    : 'No kit has been created for this work order';

  // Update work order status
  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'released',
      releasedAt: new Date(),
    },
  });

  // P1.5: Auto-reserve inventory per BOM requirements
  let reservationResult = null;
  let inventoryWarning: string | null = null;
  try {
    if (workOrder.routingId) {
      reservationResult = await reserveInventoryForWorkOrder(workOrderId);
      if (reservationResult.hasShortages) {
        inventoryWarning = `Inventory shortages detected for: ${reservationResult.shortages
          .map(
            (s) => `${s.materialCode} (short ${s.qtyShort})`
          )
          .join(', ')}`;
      }
    }
  } catch (err) {
    inventoryWarning =
      err instanceof Error
        ? `Failed to reserve inventory: ${err.message}`
        : 'Failed to reserve inventory';
  }

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
      kitWarning,
      inventoryWarning,
    },
    source: 'ui',
    idempotencyKey: generateIdempotencyKey('work_order_released', workOrderId),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');
  revalidatePath('/station');

  return { ...updatedWorkOrder, kitWarning, inventoryWarning, reservationResult };
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

  validateStatusTransition(workOrder.status, 'completed');

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
      status: { in: ['released', 'kitting', 'in_progress', 'in_testing'] },
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
 * Cancel a work order
 * Only admins and supervisors can cancel work orders
 * Only pending or released work orders can be cancelled
 */
export async function cancelWorkOrder(workOrderId: string, reason: string) {
  const validated = cancelWorkOrderSchema.parse({ workOrderId, reason });
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: validated.workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'cancelled');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: validated.workOrderId },
    data: {
      status: 'cancelled',
    },
  });

  // P1.5: Release any inventory reservations when cancelling
  try {
    await releaseReservation(validated.workOrderId);
  } catch {
    // Non-blocking - log but don't fail the cancellation
    console.error('Failed to release reservations on cancel');
  }

  await logAuditTrail(
    user.id,
    'update',
    'WorkOrder',
    validated.workOrderId,
    { status: workOrder.status },
    { status: 'cancelled', cancellationReason: validated.reason }
  );

  await emitEvent({
    eventType: 'work_order_cancelled',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      productCode: workOrder.productCode,
      previousStatus: workOrder.status,
      reason: validated.reason,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');
  revalidatePath('/station');

  return updatedWorkOrder;
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
  // P1.7: Customer fields
  customerName?: string;
  customerOrderRef?: string;
  targetStartDate?: Date;
  notes?: string;
}) {
  createWorkOrderSchema.parse(data);
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
      status: 'draft',
      draftedAt: new Date(),
      // P1.7: Customer fields
      customerName: data.customerName,
      customerOrderRef: data.customerOrderRef,
      targetStartDate: data.targetStartDate,
      notes: data.notes,
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

/**
 * P1.6: Submit a draft work order (draft -> pending)
 */
export async function submitWorkOrder(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'pending');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: 'pending' },
  });

  await emitEvent({
    eventType: 'work_order_status_changed',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      previousStatus: 'draft',
      newStatus: 'pending',
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');

  return updatedWorkOrder;
}

/**
 * P1.6: Start kitting for a work order (released -> kitting)
 */
export async function startKitting(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'kitting');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'kitting',
      kittingStartedAt: new Date(),
    },
  });

  await emitEvent({
    eventType: 'work_order_kitting_started',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      previousStatus: workOrder.status,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');

  return updatedWorkOrder;
}

/**
 * P1.6: Move work order to in_progress
 */
export async function startProduction(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'in_progress');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: 'in_progress' },
  });

  await emitEvent({
    eventType: 'work_order_status_changed',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      previousStatus: workOrder.status,
      newStatus: 'in_progress',
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');
  revalidatePath('/station');

  return updatedWorkOrder;
}

/**
 * P1.6: Move work order to in_testing
 */
export async function startTesting(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'in_testing');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'in_testing',
      testingStartedAt: new Date(),
    },
  });

  await emitEvent({
    eventType: 'work_order_testing_started',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      previousStatus: workOrder.status,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');

  return updatedWorkOrder;
}

/**
 * P1.6: Ship a completed work order
 */
export async function shipWorkOrder(workOrderId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  validateStatusTransition(workOrder.status, 'shipped');

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'shipped',
      shippedAt: new Date(),
    },
  });

  await emitEvent({
    eventType: 'work_order_shipped',
    siteId: workOrder.siteId,
    workOrderId: workOrder.id,
    operatorId: user.id,
    payload: {
      orderNumber: workOrder.orderNumber,
      qtyOrdered: workOrder.qtyOrdered,
      qtyCompleted: workOrder.qtyCompleted,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/work-orders');
  revalidatePath('/dashboard');

  return updatedWorkOrder;
}

/**
 * P1.7: Update customer fields on a work order
 */
export async function updateWorkOrderCustomerInfo(
  workOrderId: string,
  data: {
    customerName?: string | null;
    customerOrderRef?: string | null;
    targetStartDate?: Date | null;
    notes?: string | null;
  }
) {
  const user = await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      customerName: data.customerName,
      customerOrderRef: data.customerOrderRef,
      targetStartDate: data.targetStartDate,
      notes: data.notes,
    },
  });

  await logAuditTrail(
    user.id,
    'update',
    'WorkOrder',
    workOrderId,
    {
      customerName: workOrder.customerName,
      customerOrderRef: workOrder.customerOrderRef,
      targetStartDate: workOrder.targetStartDate,
      notes: workOrder.notes,
    },
    {
      customerName: data.customerName,
      customerOrderRef: data.customerOrderRef,
      targetStartDate: data.targetStartDate,
      notes: data.notes,
    }
  );

  revalidatePath('/admin/work-orders');

  return updatedWorkOrder;
}
