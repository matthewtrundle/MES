/**
 * AI Analysis API
 *
 * POST - Trigger production analysis and generate insights
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { analyzeProduction, isAIEnabled } from '@/lib/ai';
import { requireRoleApi, HttpError } from '@/lib/auth/rbac';

export async function POST() {
  try {
    await requireRoleApi(['admin', 'supervisor']);

    // Check if AI is enabled
    if (!isAIEnabled()) {
      return NextResponse.json(
        {
          error: 'AI features are not enabled',
          hint: 'Set OPENROUTER_API_KEY environment variable',
        },
        { status: 503 }
      );
    }

    // Get the site
    const site = await prisma.site.findFirst();
    if (!site) {
      return NextResponse.json({ error: 'No site found' }, { status: 400 });
    }

    // Run analysis
    const result = await analyzeProduction(site.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Analysis failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      insightsGenerated: result.insights.length,
      insights: result.insights,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('AI analysis API error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
