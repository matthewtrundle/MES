import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health(.*)',
  '/api/webhook(.*)', // For ERP integration webhooks
]);

// Routes that require specific roles
const isOperatorRoute = createRouteMatcher([
  '/station(.*)',
  '/operator(.*)',
]);

const isSupervisorRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/supervisor(.*)',
  '/wip(.*)',
  '/throughput(.*)',
  '/downtime(.*)',
  '/traceability(.*)',
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Require authentication for all other routes
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get role from session claims (set via Clerk metadata)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const role = metadata?.role;

  // Check route-specific role requirements
  if (isAdminRoute(request)) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  if (isSupervisorRoute(request)) {
    if (!['supervisor', 'admin'].includes(role ?? '')) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Operator routes are accessible by all authenticated users
  // (operators, supervisors, and admins)

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
