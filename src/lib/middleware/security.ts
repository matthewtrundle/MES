/**
 * Security utilities for the MES application.
 * Provides rate limiting and security headers.
 */

interface RateLimiterEntry {
  count: number;
  resetAt: number;
}

/**
 * Creates an in-memory rate limiter keyed by IP address.
 * Periodically cleans up expired entries to prevent memory leaks.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
}) {
  const { windowMs, maxRequests } = options;
  const store = new Map<string, RateLimiterEntry>();

  // Periodically clean up expired entries (every 60 seconds)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow garbage collection if the module is unloaded
  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }

  /**
   * Check if a request from the given IP should be allowed.
   * Returns true if the request is within limits, false if rate-limited.
   */
  return function isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= maxRequests;
  };
}

/**
 * Returns security headers to apply to all responses.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
