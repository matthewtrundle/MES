import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSecurityHeaders } from '@/lib/middleware/security';

// Skip Clerk entirely when publishable key is not configured (demo mode)
const clerkEnabled =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('REPLACE_ME');

/**
 * Apply security headers to a response.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

async function demoMiddleware(_request: NextRequest) {
  // In demo mode, allow all routes without auth
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

async function clerkAuthMiddleware(request: NextRequest) {
  // Dynamically import Clerk only when configured
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

  const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/health(.*)',
    '/api/ready(.*)',
    '/api/webhook(.*)',
    '/api/simulation(.*)',
    '/dashboard(.*)',
    '/operator(.*)',
    '/',
  ]);

  const middleware = clerkMiddleware(async (auth, req) => {
    if (isPublicRoute(req)) {
      const response = NextResponse.next();
      return applySecurityHeaders(response);
    }

    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    const response = NextResponse.next();
    return applySecurityHeaders(response);
  });

  return middleware(request, {} as any);
}

export default clerkEnabled ? clerkAuthMiddleware : demoMiddleware;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
