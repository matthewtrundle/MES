import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import type { WebhookSubscription } from '@prisma/client';

const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 5000, 25000]; // 1s, 5s, 25s
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Dispatch a webhook event to all active subscriptions that match the event type.
 * Creates WebhookDelivery records and sends HTTP POST requests.
 */
export async function dispatchWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Find all active subscriptions that include this event type
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      active: true,
      events: { has: eventType },
    },
  });

  if (subscriptions.length === 0) return;

  // Create delivery records and dispatch in parallel
  const deliveryPromises = subscriptions.map(async (subscription) => {
    // Create the delivery record first
    const delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId: subscription.id,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0,
      },
    });

    // Fire and forget the actual delivery (don't block the caller)
    deliverWebhook(subscription, eventType, payload, delivery.id).catch(
      (error) => {
        console.error(
          `[webhook-dispatch] Failed to deliver webhook ${delivery.id}:`,
          error
        );
      }
    );

    return delivery;
  });

  await Promise.all(deliveryPromises);
}

/**
 * Deliver a single webhook to a subscription endpoint.
 * Retries up to MAX_ATTEMPTS with exponential backoff.
 */
export async function deliverWebhook(
  subscription: WebhookSubscription,
  eventType: string,
  payload: Record<string, unknown>,
  deliveryId: string
): Promise<void> {
  const webhookId = deliveryId;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const body = JSON.stringify({
    id: webhookId,
    event: eventType,
    timestamp,
    data: payload,
  });

  // Sign the payload with HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', subscription.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Id': webhookId,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': `sha256=${signature}`,
  };

  let lastStatusCode: number | null = null;
  let lastResponseBody: string | null = null;
  let delivered = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Wait for backoff delay on retries
    if (attempt > 0) {
      await sleep(BACKOFF_DELAYS[attempt - 1]);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      lastStatusCode = response.status;
      lastResponseBody = await response.text().catch(() => null);

      // Update attempt count
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          statusCode: lastStatusCode,
          responseBody: lastResponseBody?.substring(0, 2000) ?? null,
        },
      });

      if (response.ok) {
        // Success - mark as delivered
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
          },
        });
        delivered = true;
        break;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          statusCode: null,
          responseBody: `Error: ${errorMessage}`.substring(0, 2000),
        },
      });
    }
  }

  // If all attempts failed, mark as failed
  if (!delivered) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        statusCode: lastStatusCode,
        responseBody: lastResponseBody?.substring(0, 2000) ?? null,
      },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
