import { z } from 'zod';

// ── Available API Permissions ───────────────────────────────────────
export const API_PERMISSIONS = [
  'work_orders:read',
  'work_orders:write',
  'units:read',
  'inventory:read',
  'quality:read',
  'shipments:read',
  'purchase_orders:read',
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

// ── Create API Key Schema ───────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, { error: 'API key name is required' })
    .max(100, { error: 'Name must be 100 characters or fewer' }),
  permissions: z
    .array(z.enum(API_PERMISSIONS))
    .min(1, { error: 'At least one permission is required' }),
  expiresAt: z.coerce.date().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ── Revoke API Key Schema ───────────────────────────────────────────
export const revokeApiKeySchema = z.object({
  id: z.string().uuid({ error: 'Invalid API key ID' }),
});

// ── Rotate API Key Schema ───────────────────────────────────────────
export const rotateApiKeySchema = z.object({
  id: z.string().uuid({ error: 'Invalid API key ID' }),
});
