import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from './security';

// Default rate limiter: 100 requests per 60 seconds
const defaultRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
});

/**
 * Wraps an API route handler with rate limiting.
 * Returns 429 Too Many Requests if the client exceeds the limit.
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: { maxRequests?: number; windowMs?: number }
) {
  // Use a custom rate limiter if options are provided, otherwise use the default
  const rateLimiter = options
    ? createRateLimiter({
        windowMs: options.windowMs ?? 60_000,
        maxRequests: options.maxRequests ?? 100,
      })
    : defaultRateLimiter;

  return async function rateLimitedHandler(req: NextRequest): Promise<NextResponse> {
    const ip = getClientIp(req);

    if (!rateLimiter(ip)) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }

    return handler(req);
  };
}

/**
 * Extract the client IP from the request.
 * Checks common proxy headers before falling back to a default.
 */
function getClientIp(req: NextRequest): string {
  // Check x-forwarded-for (set by reverse proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check x-real-ip (set by nginx)
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return '127.0.0.1';
}
