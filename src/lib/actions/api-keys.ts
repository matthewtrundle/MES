'use server';

import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { hashApiKey } from '@/lib/auth/api-auth';
import { revalidatePath } from 'next/cache';
import { createApiKeySchema, type CreateApiKeyInput } from '@/lib/validation/api-key-schemas';
import { validate } from '@/lib/validation/schemas';

// ── Create API Key ──────────────────────────────────────────────────
export async function createApiKey(data: CreateApiKeyInput) {
  const user = await requireRole(['admin']);
  const validated = validate(createApiKeySchema, data);

  // Generate the raw key: mes_ + 32 hex chars (16 random bytes)
  const rawKey = `mes_${randomBytes(16).toString('hex')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12); // "mes_" + first 8 hex chars

  const apiKey = await prisma.apiKey.create({
    data: {
      name: validated.name,
      keyHash,
      keyPrefix,
      permissions: validated.permissions,
      expiresAt: validated.expiresAt ?? null,
      createdById: user.id,
    },
  });

  await logAuditTrail(user.id, 'create', 'ApiKey', apiKey.id, null, {
    name: validated.name,
    permissions: validated.permissions,
    expiresAt: validated.expiresAt?.toISOString() ?? null,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'api_key_created',
        apiKeyId: apiKey.id,
        name: validated.name,
        permissions: validated.permissions,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/api-keys');
  revalidatePath('/dashboard');

  // Return the raw key ONCE — it cannot be retrieved again
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    rawKey,
  };
}

// ── List API Keys ───────────────────────────────────────────────────
export async function listApiKeys() {
  await requireRole(['admin']);

  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      expiresAt: true,
      lastUsedAt: true,
      active: true,
      createdAt: true,
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return apiKeys;
}

// ── Revoke API Key ──────────────────────────────────────────────────
export async function revokeApiKey(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.apiKey.findUnique({
    where: { id },
    select: { id: true, name: true, active: true },
  });

  if (!existing) {
    throw new Error('API key not found');
  }

  if (!existing.active) {
    throw new Error('API key is already revoked');
  }

  await prisma.apiKey.update({
    where: { id },
    data: { active: false },
  });

  await logAuditTrail(user.id, 'update', 'ApiKey', id, {
    active: true,
  }, {
    active: false,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'api_key_revoked',
        apiKeyId: id,
        name: existing.name,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/api-keys');
  revalidatePath('/dashboard');
}

// ── Rotate API Key ──────────────────────────────────────────────────
export async function rotateApiKey(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.apiKey.findUnique({
    where: { id },
    select: { id: true, name: true, permissions: true, expiresAt: true, active: true },
  });

  if (!existing) {
    throw new Error('API key not found');
  }

  // Revoke the old key
  if (existing.active) {
    await prisma.apiKey.update({
      where: { id },
      data: { active: false },
    });
  }

  // Create a new key with the same name and permissions
  const result = await createApiKey({
    name: existing.name,
    permissions: existing.permissions as CreateApiKeyInput['permissions'],
    expiresAt: existing.expiresAt ?? undefined,
  });

  await logAuditTrail(user.id, 'update', 'ApiKey', id, {
    action: 'rotated',
    oldKeyId: id,
  }, {
    action: 'rotated',
    newKeyId: result.id,
  });

  revalidatePath('/admin/api-keys');
  revalidatePath('/dashboard');

  return result;
}
