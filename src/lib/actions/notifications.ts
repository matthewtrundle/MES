'use server';

import { requireUser, requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import {
  createNotificationSchema,
  getNotificationsSchema,
  type CreateNotificationInput,
  type GetNotificationsOptions,
} from '@/lib/validation/notification-schemas';

// ── Create Notification ─────────────────────────────────────────
export async function createNotification(data: CreateNotificationInput) {
  await requireUser();
  const validated = createNotificationSchema.parse(data);

  const notification = await prisma.notification.create({
    data: {
      userId: validated.userId,
      title: validated.title,
      message: validated.message,
      type: validated.type,
      category: validated.category,
      entityType: validated.entityType ?? null,
      entityId: validated.entityId ?? null,
    },
  });

  return notification;
}

// ── Get Notifications for Current User ──────────────────────────
export async function getNotifications(options?: Partial<GetNotificationsOptions>) {
  const user = await requireUser();
  const validated = getNotificationsSchema.parse(options ?? {});

  const where: Record<string, unknown> = {
    userId: user.id,
  };

  if (validated.unreadOnly) {
    where.read = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: validated.limit,
      skip: validated.offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total };
}

// ── Get Unread Count ────────────────────────────────────────────
export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();

  return prisma.notification.count({
    where: {
      userId: user.id,
      read: false,
    },
  });
}

// ── Mark as Read ────────────────────────────────────────────────
export async function markAsRead(notificationId: string) {
  const user = await requireUser();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.userId !== user.id) {
    throw new Error('Unauthorized: Cannot modify another user\'s notification');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  revalidatePath('/dashboard/notifications');
  return updated;
}

// ── Mark All as Read ────────────────────────────────────────────
export async function markAllAsRead() {
  const user = await requireUser();

  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  revalidatePath('/dashboard/notifications');
  return { updated: result.count };
}

// ── Delete Notification ─────────────────────────────────────────
export async function deleteNotification(notificationId: string) {
  const user = await requireUser();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.userId !== user.id) {
    throw new Error('Unauthorized: Cannot delete another user\'s notification');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  revalidatePath('/dashboard/notifications');
}

// ── Create Bulk Notifications ───────────────────────────────────
export async function createBulkNotifications(
  userIds: string[],
  data: Omit<CreateNotificationInput, 'userId'>
) {
  await requireRole(['admin', 'supervisor']);
  const notifications = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: data.title,
      message: data.message,
      type: data.type ?? 'info',
      category: data.category ?? 'system',
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    })),
  });

  return { created: notifications.count };
}
