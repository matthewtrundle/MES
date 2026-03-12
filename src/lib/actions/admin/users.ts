'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';

/**
 * Assign a user to a specific station (or unassign by passing null).
 * Admin only. Logs to audit trail and emits config_changed event.
 */
export async function assignUserToStation(userId: string, stationId: string | null) {
  const admin = await requireRole(['admin']);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { sites: { select: { id: true } } },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If assigning to a station, verify it exists
  if (stationId) {
    const station = await prisma.station.findUnique({
      where: { id: stationId },
    });
    if (!station) {
      throw new Error('Station not found');
    }
    if (!station.active) {
      throw new Error('Cannot assign user to an inactive station');
    }
  }

  const previousStationId = user.assignedStationId;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { assignedStationId: stationId },
  });

  await logAuditTrail(
    admin.id,
    'update',
    'User',
    userId,
    { assignedStationId: previousStationId },
    { assignedStationId: stationId }
  );

  // Emit config_changed event
  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: admin.id,
      payload: {
        action: 'user_station_assignment',
        userId,
        userName: user.name,
        previousStationId,
        newStationId: stationId,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/users');
  revalidatePath('/station');

  return updatedUser;
}
