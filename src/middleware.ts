import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Skip Clerk entirely when publishable key is not configured (demo mode)
const clerkEnabled =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('REPLACE_ME');

async function demoMiddleware(_request: NextRequest) {
  // In demo mode, allow all routes without auth
  return NextResponse.next();
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
      return NextResponse.next();
    }

    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
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
