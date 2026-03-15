'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { logAuditTrail } from '@/lib/db/audit';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { revalidatePath } from 'next/cache';
import {
  createUserSchema,
  updateUserSchema,
  userFiltersSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFiltersInput,
} from '@/lib/validation/user-schemas';
import { validate } from '@/lib/validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Get all users with optional filters. Admin only.
 */
export async function getUsers(filters?: UserFiltersInput) {
  await requireRole(['admin']);

  const parsed = filters ? validate(userFiltersSchema, filters) : {};

  const where: Prisma.UserWhereInput = {};

  if (parsed.role) {
    where.role = parsed.role as Prisma.EnumRoleFilter;
  }

  if (parsed.active !== undefined) {
    where.active = parsed.active;
  }

  if (parsed.search) {
    const search = parsed.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      sites: { select: { id: true, name: true } },
      assignedStation: { select: { id: true, name: true, stationType: true } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return users;
}

/**
 * Get a single user with full details. Admin only.
 */
export async function getUser(userId: string) {
  await requireRole(['admin']);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sites: { select: { id: true, name: true } },
      assignedStation: { select: { id: true, name: true, stationType: true } },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Create a new user. Admin only.
 * Generates a placeholder clerkId; user gets a real one on first Clerk login.
 */
export async function createUser(data: CreateUserInput) {
  const admin = await requireRole(['admin']);

  const validated = validate(createUserSchema, data);

  // Check for duplicate email
  const existing = await prisma.user.findUnique({
    where: { email: validated.email },
  });
  if (existing) {
    throw new Error('A user with this email already exists');
  }

  // Generate a placeholder clerkId
  const placeholderClerkId = `placeholder_${uuidv4()}`;

  const user = await prisma.user.create({
    data: {
      clerkId: placeholderClerkId,
      email: validated.email,
      name: validated.name,
      role: validated.role as never, // Cast for forward-compat with expanded enum
      assignedStationId: validated.assignedStationId ?? null,
      ...(validated.siteIds && validated.siteIds.length > 0
        ? {
            sites: {
              connect: validated.siteIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    include: {
      sites: { select: { id: true, name: true } },
      assignedStation: { select: { id: true, name: true } },
    },
  });

  await logAuditTrail(admin.id, 'create', 'User', user.id, null, {
    email: user.email,
    name: user.name,
    role: user.role,
    assignedStationId: user.assignedStationId,
  });

  // Emit config_changed event
  const siteId = user.sites[0]?.id ?? admin.sites?.[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: admin.id,
      payload: {
        action: 'user_created',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  return user;
}

/**
 * Update an existing user. Admin only.
 */
export async function updateUser(userId: string, data: UpdateUserInput) {
  const admin = await requireRole(['admin']);

  const validated = validate(updateUserSchema, data);

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { sites: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error('User not found');
  }

  // Prevent deactivating the last admin
  if (validated.active === false && existing.role === 'admin') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin', active: true },
    });
    if (adminCount <= 1) {
      throw new Error('Cannot deactivate the last active administrator');
    }
  }

  // Prevent changing the role of the last admin away from admin
  if (validated.role && validated.role !== 'admin' && existing.role === 'admin') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin', active: true },
    });
    if (adminCount <= 1) {
      throw new Error('Cannot change the role of the last active administrator');
    }
  }

  // If assigning to a station, verify it exists and is active
  if (validated.assignedStationId) {
    const station = await prisma.station.findUnique({
      where: { id: validated.assignedStationId },
    });
    if (!station) {
      throw new Error('Station not found');
    }
    if (!station.active) {
      throw new Error('Cannot assign user to an inactive station');
    }
  }

  const before = {
    name: existing.name,
    role: existing.role,
    assignedStationId: existing.assignedStationId,
    active: existing.active,
  };

  const updateData: Prisma.UserUpdateInput = {};
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.role !== undefined) updateData.role = validated.role as never;
  if (validated.assignedStationId !== undefined) {
    updateData.assignedStation = validated.assignedStationId
      ? { connect: { id: validated.assignedStationId } }
      : { disconnect: true };
  }
  if (validated.active !== undefined) updateData.active = validated.active;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: {
      sites: { select: { id: true, name: true } },
      assignedStation: { select: { id: true, name: true } },
    },
  });

  const after = {
    name: updatedUser.name,
    role: updatedUser.role,
    assignedStationId: updatedUser.assignedStationId,
    active: updatedUser.active,
  };

  await logAuditTrail(admin.id, 'update', 'User', userId, before, after);

  const siteId = updatedUser.sites[0]?.id ?? existing.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: admin.id,
      payload: {
        action: 'user_updated',
        userId,
        userName: updatedUser.name,
        before,
        after,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/users');
  revalidatePath('/station');
  revalidatePath('/dashboard');
  return updatedUser;
}

/**
 * Deactivate a user. Admin only.
 */
export async function deactivateUser(userId: string) {
  const admin = await requireRole(['admin']);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (!user.active) throw new Error('User is already deactivated');

  // Prevent deactivating the last admin
  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin', active: true },
    });
    if (adminCount <= 1) {
      throw new Error('Cannot deactivate the last active administrator');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { active: false },
  });

  await logAuditTrail(
    admin.id,
    'update',
    'User',
    userId,
    { active: true },
    { active: false }
  );

  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  return updatedUser;
}

/**
 * Reactivate a user. Admin only.
 */
export async function reactivateUser(userId: string) {
  const admin = await requireRole(['admin']);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.active) throw new Error('User is already active');

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { active: true },
  });

  await logAuditTrail(
    admin.id,
    'update',
    'User',
    userId,
    { active: false },
    { active: true }
  );

  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  return updatedUser;
}

/**
 * Assign a user to a station. Admin only.
 */
export async function assignUserToStationAction(userId: string, stationId: string | null) {
  // Delegate to the existing action logic but inline for consistency
  const admin = await requireRole(['admin']);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { sites: { select: { id: true } } },
  });

  if (!user) throw new Error('User not found');

  if (stationId) {
    const station = await prisma.station.findUnique({ where: { id: stationId } });
    if (!station) throw new Error('Station not found');
    if (!station.active) throw new Error('Cannot assign user to an inactive station');
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
  revalidatePath('/dashboard');
  return updatedUser;
}

/**
 * Assign a user to one or more sites. Admin only.
 */
export async function assignUserToSites(userId: string, siteIds: string[]) {
  const admin = await requireRole(['admin']);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { sites: { select: { id: true } } },
  });
  if (!user) throw new Error('User not found');

  // Verify all site IDs exist
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true },
  });
  if (sites.length !== siteIds.length) {
    throw new Error('One or more site IDs are invalid');
  }

  const previousSiteIds = user.sites.map((s) => s.id);

  // Replace all site connections
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      sites: {
        set: siteIds.map((id) => ({ id })),
      },
    },
    include: { sites: { select: { id: true, name: true } } },
  });

  await logAuditTrail(
    admin.id,
    'update',
    'User',
    userId,
    { siteIds: previousSiteIds },
    { siteIds }
  );

  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  return updatedUser;
}

/**
 * Get all stations for dropdown selection. Admin only.
 */
export async function getStationsForUserAssignment() {
  await requireRole(['admin']);

  return prisma.station.findMany({
    where: { active: true },
    select: { id: true, name: true, stationType: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get all sites for dropdown selection. Admin only.
 */
export async function getSitesForUserAssignment() {
  await requireRole(['admin']);

  return prisma.site.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
