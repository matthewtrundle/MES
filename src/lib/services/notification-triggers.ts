import { prisma } from '@/lib/db/prisma';
import { createBulkNotifications, createNotification } from '@/lib/actions/notifications';
import type { CreateNotificationInput } from '@/lib/validation/notification-schemas';

/**
 * Get all user IDs with the specified roles
 */
async function getUserIdsByRole(roles: string[]): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles as ('admin' | 'supervisor' | 'operator')[] },
      active: true,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Notify supervisors and admins when an NCR is created
 */
export async function notifyNCRCreated(
  ncrId: string,
  defectType: string,
  unitSerial: string,
  stationName: string
): Promise<void> {
  const userIds = await getUserIdsByRole(['supervisor', 'admin']);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'NCR Created',
    message: `NCR created for unit ${unitSerial} at ${stationName}. Defect: ${defectType}`,
    type: 'warning',
    category: 'quality',
    entityType: 'ncr',
    entityId: ncrId,
  });
}

/**
 * Notify admins when a shipment is ready
 */
export async function notifyShipmentReady(
  workOrderId: string,
  orderNumber: string
): Promise<void> {
  const userIds = await getUserIdsByRole(['supervisor', 'admin']);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Shipment Ready',
    message: `Work order ${orderNumber} is complete and ready for shipment.`,
    type: 'success',
    category: 'shipping',
    entityType: 'work_order',
    entityId: workOrderId,
  });
}

/**
 * Notify admins when inventory falls below reorder point
 */
export async function notifyInventoryLow(
  materialCode: string,
  currentQty: number,
  reorderPoint: number,
  materialLotId?: string
): Promise<void> {
  const userIds = await getUserIdsByRole(['admin']);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Low Inventory Alert',
    message: `Material ${materialCode} is below reorder point. Current: ${currentQty}, Reorder at: ${reorderPoint}`,
    type: 'error',
    category: 'inventory',
    entityType: materialLotId ? 'material_lot' : undefined,
    entityId: materialLotId,
  });
}

/**
 * Notify supervisors when a quality check fails
 */
export async function notifyQualityCheckFailed(
  unitId: string,
  checkName: string,
  unitSerial: string,
  stationName: string
): Promise<void> {
  const userIds = await getUserIdsByRole(['supervisor', 'admin']);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Quality Check Failed',
    message: `Quality check "${checkName}" failed for unit ${unitSerial} at ${stationName}.`,
    type: 'error',
    category: 'quality',
    entityType: 'unit',
    entityId: unitId,
  });
}

/**
 * Notify admins and supervisors when a work order is completed
 */
export async function notifyWorkOrderCompleted(
  workOrderId: string,
  orderNumber: string
): Promise<void> {
  const userIds = await getUserIdsByRole(['supervisor', 'admin']);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Work Order Completed',
    message: `Work order ${orderNumber} has been completed.`,
    type: 'success',
    category: 'production',
    entityType: 'work_order',
    entityId: workOrderId,
  });
}
