import { z } from 'zod';

export const webhookEventTypes = [
  'work_order_released',
  'work_order_completed',
  'work_order_shipped',
  'unit_created',
  'operation_completed',
  'quality_check_recorded',
  'ncr_created',
  'ncr_dispositioned',
  'ncr_closed',
  'eol_test_passed',
  'eol_test_failed',
  'shipment_created',
  'shipment_shipped',
  'material_lot_received',
  'inventory_transaction_recorded',
  'iqc_inspection_completed',
  'iqc_disposition_recorded',
] as const;

export type WebhookEventType = (typeof webhookEventTypes)[number];

export const createWebhookSubscriptionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  url: z.string().url({ error: 'Valid URL is required' }),
  secret: z.string().min(16, 'Secret must be at least 16 characters').max(256).optional(),
  events: z
    .array(z.enum(webhookEventTypes))
    .min(1, 'At least one event type is required'),
  active: z.boolean().optional().default(true),
});

export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;

export const updateWebhookSubscriptionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  url: z.string().url({ error: 'Valid URL is required' }).optional(),
  secret: z.string().min(16, 'Secret must be at least 16 characters').max(256).optional(),
  events: z
    .array(z.enum(webhookEventTypes))
    .min(1, 'At least one event type is required')
    .optional(),
  active: z.boolean().optional(),
});

export type UpdateWebhookSubscriptionInput = z.infer<typeof updateWebhookSubscriptionSchema>;
