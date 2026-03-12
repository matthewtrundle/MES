import { z } from 'zod';

export const notificationTypeEnum = z.enum(['info', 'warning', 'error', 'success']);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export const notificationCategoryEnum = z.enum([
  'system',
  'quality',
  'production',
  'shipping',
  'inventory',
]);
export type NotificationCategory = z.infer<typeof notificationCategoryEnum>;

export const createNotificationSchema = z.object({
  userId: z.string().uuid({ error: 'Valid user ID is required' }),
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
  type: notificationTypeEnum.default('info'),
  category: notificationCategoryEnum.default('system'),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const getNotificationsSchema = z.object({
  unreadOnly: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type GetNotificationsOptions = z.infer<typeof getNotificationsSchema>;
