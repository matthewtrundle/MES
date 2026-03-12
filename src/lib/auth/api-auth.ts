import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, HttpError, unauthorized, forbidden } from '@/lib/auth/rbac';
import type { UserWithSites } from '@/lib/auth/rbac';
import type { ApiKey } from '@prisma/client';

/**
 * Hash a raw API key using SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Result of API authentication — either a user session or an API key
 */
export interface ApiAuthResult {
  user?: UserWithSites;
  apiKey?: ApiKey;
}

/**
 * Authenticate an API request.
 *
 * 1. If an `Authorization: Bearer mes_...` header is present, validate the API key.
 * 2. Otherwise, fall back to Clerk session auth.
 *
 * Returns the authenticated identity or throws an HttpError.
 */
export async function authenticateApiRequest(
  request: Request
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('authorization');

  // Check for Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();

    if (token.startsWith('mes_')) {
      return authenticateWithApiKey(token);
    }
  }

  // Fall back to Clerk session auth
  const user = await getCurrentUser();
  if (!user) {
    throw unauthorized('Unauthorized: No valid authentication provided');
  }
  if (!user.active) {
    throw forbidden('Forbidden: User account is deactivated');
  }

  return { user };
}

/**
 * Require authentication and optionally check permissions.
 *
 * For API key auth, checks the key's permission list.
 * For session auth, any authenticated user passes (RBAC checked elsewhere).
 */
export async function requireApiAuth(
  request: Request,
  requiredPermissions?: string[]
): Promise<ApiAuthResult> {
  const result = await authenticateApiRequest(request);

  // If authenticated via API key, check permissions
  if (result.apiKey && requiredPermissions?.length) {
    const hasAll = requiredPermissions.every((perm) =>
      result.apiKey!.permissions.includes(perm)
    );
    if (!hasAll) {
      throw forbidden(
        `Forbidden: API key missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }
  }

  return result;
}

/**
 * Validate an API key token against the database
 */
async function authenticateWithApiKey(rawKey: string): Promise<ApiAuthResult> {
  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey) {
    throw unauthorized('Unauthorized: Invalid API key');
  }

  if (!apiKey.active) {
    throw unauthorized('Unauthorized: API key has been revoked');
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw unauthorized('Unauthorized: API key has expired');
  }

  // Update lastUsedAt (fire-and-forget, don't block the response)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Silently ignore update failures — non-critical
    });

  return { apiKey };
}

/**
 * Helper to build a standard error response from an HttpError
 */
export function apiErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled API error:', error);
  return Response.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  );
}
