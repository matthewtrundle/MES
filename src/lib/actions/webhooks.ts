'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import {
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  type CreateWebhookSubscriptionInput,
  type UpdateWebhookSubscriptionInput,
} from '@/lib/validation/webhook-schemas';

// ── Create Webhook Subscription ─────────────────────────────────
export async function createWebhookSubscription(data: CreateWebhookSubscriptionInput) {
  const user = await requireRole(['admin']);
  const validated = createWebhookSubscriptionSchema.parse(data);

  // Generate a random secret if not provided
  const secret = validated.secret ?? crypto.randomBytes(32).toString('hex');

  const subscription = await prisma.webhookSubscription.create({
    data: {
      name: validated.name,
      url: validated.url,
      secret,
      events: validated.events,
      active: validated.active,
    },
  });

  await logAuditTrail(user.id, 'create', 'WebhookSubscription', subscription.id, null, {
    name: validated.name,
    url: validated.url,
    events: validated.events,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'webhook_subscription_created',
        subscriptionId: subscription.id,
        name: validated.name,
        events: validated.events,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/webhooks');
  return subscription;
}

// ── List Webhook Subscriptions ──────────────────────────────────
export async function listWebhookSubscriptions() {
  await requireRole(['admin']);

  const subscriptions = await prisma.webhookSubscription.findMany({
    include: {
      _count: {
        select: { deliveries: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return subscriptions;
}

// ── Update Webhook Subscription ─────────────────────────────────
export async function updateWebhookSubscription(
  id: string,
  data: UpdateWebhookSubscriptionInput
) {
  const user = await requireRole(['admin']);
  const validated = updateWebhookSubscriptionSchema.parse(data);

  const existing = await prisma.webhookSubscription.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Webhook subscription not found');
  }

  const updateData: Record<string, unknown> = {};
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.url !== undefined) updateData.url = validated.url;
  if (validated.secret !== undefined) updateData.secret = validated.secret;
  if (validated.events !== undefined) updateData.events = validated.events;
  if (validated.active !== undefined) updateData.active = validated.active;

  const subscription = await prisma.webhookSubscription.update({
    where: { id },
    data: updateData,
  });

  await logAuditTrail(user.id, 'update', 'WebhookSubscription', id, {
    name: existing.name,
    url: existing.url,
    events: existing.events,
    active: existing.active,
  }, {
    ...updateData,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'webhook_subscription_updated',
        subscriptionId: id,
        changes: Object.keys(updateData),
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/webhooks');
  return subscription;
}

// ── Delete Webhook Subscription ─────────────────────────────────
export async function deleteWebhookSubscription(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.webhookSubscription.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Webhook subscription not found');
  }

  await prisma.webhookSubscription.delete({
    where: { id },
  });

  await logAuditTrail(user.id, 'delete', 'WebhookSubscription', id, {
    name: existing.name,
    url: existing.url,
    events: existing.events,
  }, null);

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'webhook_subscription_deleted',
        subscriptionId: id,
        name: existing.name,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/webhooks');
}

// ── Get Webhook Deliveries ──────────────────────────────────────
export async function getWebhookDeliveries(
  subscriptionId: string,
  options?: { limit?: number; offset?: number }
) {
  await requireRole(['admin']);

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.webhookDelivery.count({ where: { subscriptionId } }),
  ]);

  return { deliveries, total };
}

// ── Retry Webhook Delivery ──────────────────────────────────────
export async function retryWebhookDelivery(deliveryId: string) {
  const user = await requireRole(['admin']);

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });

  if (!delivery) {
    throw new Error('Webhook delivery not found');
  }

  if (delivery.status === 'delivered') {
    throw new Error('Cannot retry a successfully delivered webhook');
  }

  // Import dispatch function dynamically to avoid circular deps
  const { deliverWebhook } = await import('@/lib/services/webhook-dispatch');

  await deliverWebhook(
    delivery.subscription,
    delivery.eventType,
    delivery.payload as Record<string, unknown>,
    delivery.id
  );

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'webhook_delivery_retried',
        deliveryId,
        subscriptionId: delivery.subscriptionId,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/webhooks');
}
