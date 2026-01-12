/**
 * AI Insights API
 *
 * GET - Fetch insights with optional filtering
 * POST - Acknowledge/dismiss an insight
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build filters
    const where: Record<string, unknown> = {};

    if (severity) {
      where.severity = severity;
    }

    if (acknowledged !== null) {
      where.acknowledged = acknowledged === 'true';
    }

    const insights = await prisma.aIInsight.findMany({
      where,
      orderBy: [
        { severity: 'desc' }, // critical > warning > info
        { createdAt: 'desc' },
      ],
      take: limit,
      include: {
        station: {
          select: { id: true, name: true },
        },
      },
    });

    // Sort by severity (manual because Prisma doesn't support custom sort order)
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => {
      const orderDiff =
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 2);
      if (orderDiff !== 0) return orderDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Get counts by severity
    const counts = await prisma.aIInsight.groupBy({
      by: ['severity'],
      where: { acknowledged: false },
      _count: true,
    });

    const countMap = Object.fromEntries(
      counts.map((c) => [c.severity, c._count])
    );

    return NextResponse.json({
      insights,
      counts: {
        critical: countMap.critical || 0,
        warning: countMap.warning || 0,
        info: countMap.info || 0,
        total: insights.length,
      },
    });
  } catch (error) {
    console.error('Insights fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { insightId, action } = body;

    if (!insightId || !action) {
      return NextResponse.json(
        { error: 'Missing insightId or action' },
        { status: 400 }
      );
    }

    if (!['acknowledge', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use acknowledge or dismiss' },
        { status: 400 }
      );
    }

    if (action === 'acknowledge') {
      const insight = await prisma.aIInsight.update({
        where: { id: insightId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          // acknowledgedBy would be set from user session in real app
        },
      });

      return NextResponse.json({ success: true, insight });
    }

    if (action === 'dismiss') {
      // For dismiss, we just mark it as acknowledged with a different flag
      // In a real app, you might want a separate 'dismissed' field
      const insight = await prisma.aIInsight.update({
        where: { id: insightId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          payload: { dismissed: true },
        },
      });

      return NextResponse.json({ success: true, insight });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Insight action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
