import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, HttpError, unauthorized } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';

const trackAuthSchema = z.object({
  action: z.enum(['login', 'logout']),
});

/**
 * POST /api/auth/track
 * Track user login and logout events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = trackAuthSchema.parse(body);

    const user = await getCurrentUser();
    if (!user) {
      throw unauthorized('Unauthorized: Not logged in');
    }

    // Get a siteId for the event - use user's first site or fall back to default
    const siteId =
      user.sites?.[0]?.id ??
      (await prisma.site.findFirst({ select: { id: true } }))?.id;

    if (!siteId) {
      return NextResponse.json(
        { error: 'No site configured' },
        { status: 500 }
      );
    }

    const eventType = action === 'login' ? 'user_login' : 'user_logout';

    await emitEvent({
      eventType,
      siteId,
      operatorId: user.id,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        action,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });

    return NextResponse.json({ success: true, event: eventType });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Failed to track auth event:', error);
    return NextResponse.json(
      { error: 'Failed to track auth event' },
      { status: 500 }
    );
  }
}
