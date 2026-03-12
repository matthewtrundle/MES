'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import { isTimeInShift } from '@/lib/shifts';

/**
 * List all shifts, optionally filtered by site.
 */
export async function getShiftsForAdmin(siteId?: string) {
  await requireRole(['admin']);

  const shifts = await prisma.shift.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { name: true } },
    },
    orderBy: [{ siteId: 'asc' }, { startTime: 'asc' }],
  });

  return shifts;
}

/**
 * Create a new shift. Admin only.
 */
export async function createShift(data: {
  siteId: string;
  name: string;
  startTime: string;
  endTime: string;
}) {
  const user = await requireRole(['admin']);

  const shift = await prisma.shift.create({
    data: {
      siteId: data.siteId,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      active: true,
    },
  });

  await logAuditTrail(user.id, 'create', 'Shift', shift.id, null, {
    name: data.name,
    startTime: data.startTime,
    endTime: data.endTime,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId: data.siteId,
    operatorId: user.id,
    payload: {
      action: 'shift_created',
      shiftId: shift.id,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/shifts');
  return shift;
}

/**
 * Update an existing shift. Admin only.
 */
export async function updateShift(
  id: string,
  data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Shift not found');
  }

  const shift = await prisma.shift.update({
    where: { id },
    data,
  });

  await logAuditTrail(
    user.id,
    'update',
    'Shift',
    id,
    { name: existing.name, startTime: existing.startTime, endTime: existing.endTime, active: existing.active },
    data
  );

  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.siteId,
    operatorId: user.id,
    payload: {
      action: 'shift_updated',
      shiftId: id,
      changes: JSON.parse(JSON.stringify(data)),
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/shifts');
  return shift;
}

/**
 * Delete a shift. Hard delete if never referenced, otherwise soft delete.
 */
export async function deleteShift(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Shift not found');
  }

  // Shifts currently have no foreign key references from other tables,
  // so we can always hard delete. If future models reference shifts,
  // this should be updated to soft-delete when in use.
  await prisma.shift.delete({ where: { id } });

  await logAuditTrail(user.id, 'delete', 'Shift', id, {
    name: existing.name,
    startTime: existing.startTime,
    endTime: existing.endTime,
  }, null);

  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.siteId,
    operatorId: user.id,
    payload: {
      action: 'shift_deleted',
      shiftId: id,
      name: existing.name,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/shifts');
}

/**
 * Determine the current shift for a site based on the current time.
 */
export async function getCurrentShift(siteId?: string) {
  const where: { active: boolean; siteId?: string } = { active: true };
  if (siteId) {
    where.siteId = siteId;
  }

  const shifts = await prisma.shift.findMany({ where });
  const now = new Date();

  for (const shift of shifts) {
    if (isTimeInShift(now, shift.startTime, shift.endTime)) {
      return shift;
    }
  }

  return null;
}
