import { prisma } from '@/lib/db/prisma';
import { chat, isAIEnabled, ChatMessage } from './openrouter';
import { ANALYST_SYSTEM_PROMPT, CHAT_ASSISTANT_PROMPT } from './prompts';

// Types for AI insights
export interface AIInsightData {
  type: 'anomaly' | 'recommendation' | 'prediction';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  stationId?: string;
  confidence: number;
}

export interface AnalysisResult {
  insights: AIInsightData[];
  success: boolean;
  error?: string;
}

export interface ProductionContext {
  stations: {
    id: string;
    name: string;
    stationType: string;
    wipCount: number;
    isDowntime: boolean;
  }[];
  downtime: {
    stationId: string;
    stationName: string;
    reason: string;
    minutes: number;
    isActive: boolean;
  }[];
  quality: {
    totalChecks: number;
    passCount: number;
    failCount: number;
    passRate: number;
  };
  ncrs: {
    open: number;
    dispositioned: number;
    defectTypes: Record<string, number>;
  };
  production: {
    unitsCompletedToday: number;
    unitsInProgress: number;
    activeWorkOrders: number;
  };
  recentEvents: {
    eventType: string;
    stationName?: string;
    timestamp: Date;
  }[];
}

/**
 * Fetch current production context for AI analysis
 */
export async function getProductionContext(siteId: string): Promise<ProductionContext> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    stations,
    activeDowntime,
    completedDowntimeToday,
    qualityResults,
    openNCRs,
    activeWorkOrders,
    unitsCompletedToday,
    wipUnits,
    recentEvents,
  ] = await Promise.all([
    // Stations with WIP counts
    prisma.station.findMany({
      where: { siteId },
      orderBy: { sequenceOrder: 'asc' },
    }),
    // Active downtime
    prisma.downtimeInterval.findMany({
      where: {
        station: { siteId },
        endedAt: null,
      },
      include: { station: true, reason: true },
    }),
    // Completed downtime today
    prisma.downtimeInterval.findMany({
      where: {
        station: { siteId },
        startedAt: { gte: today },
        endedAt: { not: null },
      },
      include: { station: true, reason: true },
    }),
    // Quality results today
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: today } },
    }),
    // Open NCRs
    prisma.nonconformanceRecord.findMany({
      where: {
        station: { siteId },
        status: { in: ['open', 'dispositioned'] },
      },
    }),
    // Active work orders
    prisma.workOrder.count({
      where: { siteId, status: { in: ['released', 'in_progress'] } },
    }),
    // Units completed today
    prisma.unit.count({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
    }),
    // WIP units
    prisma.unit.findMany({
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
    }),
    // Recent events (last 50)
    prisma.event.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // Calculate WIP per station
  const wipMap = new Map<string, number>();
  wipUnits.forEach((unit) => {
    if (unit.currentStationId) {
      wipMap.set(unit.currentStationId, (wipMap.get(unit.currentStationId) || 0) + 1);
    }
  });

  // Get station names for downtime
  const stationNameMap = new Map(stations.map((s) => [s.id, s.name]));
  const activeDowntimeSet = new Set(activeDowntime.map((d) => d.stationId));

  // Process downtime data
  const downtimeData = [
    ...activeDowntime.map((d) => ({
      stationId: d.stationId,
      stationName: d.station.name,
      reason: d.reason?.description || 'Unspecified',
      minutes: Math.round((Date.now() - d.startedAt.getTime()) / 60000),
      isActive: true,
    })),
    ...completedDowntimeToday.map((d) => ({
      stationId: d.stationId,
      stationName: d.station.name,
      reason: d.reason?.description || 'Unspecified',
      minutes: Math.round((d.endedAt!.getTime() - d.startedAt.getTime()) / 60000),
      isActive: false,
    })),
  ];

  // Quality stats
  const passCount = qualityResults.filter((q) => q.result === 'pass').length;
  const failCount = qualityResults.filter((q) => q.result === 'fail').length;
  const totalChecks = qualityResults.length;

  // NCR stats
  const defectTypes: Record<string, number> = {};
  openNCRs.forEach((ncr) => {
    defectTypes[ncr.defectType] = (defectTypes[ncr.defectType] || 0) + 1;
  });

  return {
    stations: stations.map((s) => ({
      id: s.id,
      name: s.name,
      stationType: s.stationType,
      wipCount: wipMap.get(s.id) || 0,
      isDowntime: activeDowntimeSet.has(s.id),
    })),
    downtime: downtimeData,
    quality: {
      totalChecks,
      passCount,
      failCount,
      passRate: totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 100,
    },
    ncrs: {
      open: openNCRs.filter((n) => n.status === 'open').length,
      dispositioned: openNCRs.filter((n) => n.status === 'dispositioned').length,
      defectTypes,
    },
    production: {
      unitsCompletedToday,
      unitsInProgress: wipUnits.length,
      activeWorkOrders,
    },
    recentEvents: recentEvents.slice(0, 20).map((e) => ({
      eventType: e.eventType,
      stationName: e.stationId ? stationNameMap.get(e.stationId) : undefined,
      timestamp: e.createdAt,
    })),
  };
}

/**
 * Build analysis prompt from production context
 */
function buildAnalysisPrompt(context: ProductionContext): string {
  const { stations, downtime, quality, ncrs, production, recentEvents } = context;

  return `Analyze the following production data and identify anomalies, root causes, and recommendations:

## CURRENT PRODUCTION STATUS
- Active Work Orders: ${production.activeWorkOrders}
- Units Completed Today: ${production.unitsCompletedToday}
- Units In Progress: ${production.unitsInProgress}

## STATION STATUS
${stations
  .map(
    (s) =>
      `- ${s.name} (${s.stationType}): WIP=${s.wipCount}${s.isDowntime ? ' [DOWNTIME]' : ''}`
  )
  .join('\n')}

## DOWNTIME TODAY
${
  downtime.length > 0
    ? downtime
        .map(
          (d) =>
            `- ${d.stationName}: ${d.reason} (${d.minutes} min)${d.isActive ? ' [ACTIVE]' : ''}`
        )
        .join('\n')
    : '- No downtime recorded'
}
Total Downtime: ${downtime.reduce((sum, d) => sum + d.minutes, 0)} minutes

## QUALITY METRICS
- Total Checks: ${quality.totalChecks}
- Pass Rate: ${quality.passRate}%
- Pass: ${quality.passCount}, Fail: ${quality.failCount}

## NON-CONFORMANCE RECORDS
- Open NCRs: ${ncrs.open}
- Awaiting Disposition: ${ncrs.dispositioned}
- Defect Types: ${Object.entries(ncrs.defectTypes)
    .map(([type, count]) => `${type}(${count})`)
    .join(', ') || 'None'}

## RECENT EVENTS (Last 20)
${recentEvents
  .map(
    (e) =>
      `- ${e.eventType}${e.stationName ? ` at ${e.stationName}` : ''} (${e.timestamp.toISOString()})`
  )
  .join('\n')}

Based on this data, identify:
1. Any anomalies or concerning patterns
2. Potential root causes
3. Specific recommendations to improve production`;
}

/**
 * Parse AI response into structured insights
 */
function parseInsights(response: string): AIInsightData[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.insights)) {
      console.error('Invalid insights format');
      return [];
    }

    return parsed.insights.map((insight: Record<string, unknown>) => ({
      type: ['anomaly', 'recommendation', 'prediction'].includes(insight.type as string)
        ? insight.type
        : 'recommendation',
      severity: ['info', 'warning', 'critical'].includes(insight.severity as string)
        ? insight.severity
        : 'info',
      title: String(insight.title || 'Insight').slice(0, 100),
      description: String(insight.description || ''),
      stationId: typeof insight.stationId === 'string' ? insight.stationId : undefined,
      confidence: typeof insight.confidence === 'number'
        ? Math.max(0, Math.min(1, insight.confidence))
        : 0.8,
    })) as AIInsightData[];
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return [];
  }
}

/**
 * Analyze production data and generate insights
 */
export async function analyzeProduction(siteId: string): Promise<AnalysisResult> {
  if (!isAIEnabled()) {
    return {
      insights: [],
      success: false,
      error: 'AI features are not enabled. Set OPENROUTER_API_KEY in environment.',
    };
  }

  try {
    // Fetch production context
    const context = await getProductionContext(siteId);

    // Build station name to ID lookup for resolving AI responses
    const stationNameToId = new Map<string, string>();
    context.stations.forEach((s) => {
      stationNameToId.set(s.name.toLowerCase(), s.id);
      // Also map partial names (e.g., "Station A" -> id)
      const shortName = s.name.split(' - ')[0]?.toLowerCase();
      if (shortName) stationNameToId.set(shortName, s.id);
    });

    // Build analysis prompt
    const analysisPrompt = buildAnalysisPrompt(context);

    // Call AI
    const response = await chat([
      { role: 'system', content: ANALYST_SYSTEM_PROMPT },
      { role: 'user', content: analysisPrompt },
    ]);

    if (!response) {
      return {
        insights: [],
        success: false,
        error: 'No response from AI service',
      };
    }

    // Parse insights
    const insights = parseInsights(response);

    // Save insights to database
    for (const insight of insights) {
      // Validate/resolve stationId - AI might return name instead of UUID
      let resolvedStationId: string | undefined = undefined;
      if (insight.stationId) {
        // Check if it's a valid UUID that exists in our stations
        const validStation = context.stations.find((s) => s.id === insight.stationId);
        if (validStation) {
          resolvedStationId = insight.stationId;
        } else {
          // Try to match by station name (AI might return name instead of ID)
          resolvedStationId = stationNameToId.get(insight.stationId.toLowerCase());
        }
      }

      await prisma.aIInsight.create({
        data: {
          siteId,
          stationId: resolvedStationId,
          insightType: insight.type,
          severity: insight.severity,
          title: insight.title,
          description: insight.description,
          confidence: insight.confidence,
          payload: {},
        },
      });
    }

    return {
      insights,
      success: true,
    };
  } catch (error) {
    console.error('Production analysis failed:', error);
    return {
      insights: [],
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

/**
 * Answer a question about production with context
 */
export async function answerQuestion(
  siteId: string,
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  if (!isAIEnabled()) {
    return 'AI features are not enabled. Please configure the OPENROUTER_API_KEY environment variable.';
  }

  try {
    // Fetch current production context
    const context = await getProductionContext(siteId);

    // Build context summary
    const contextSummary = `Current Production Status:
- ${context.production.activeWorkOrders} active work orders
- ${context.production.unitsCompletedToday} units completed today
- ${context.production.unitsInProgress} units in progress
- Quality pass rate: ${context.quality.passRate}%
- Open NCRs: ${context.ncrs.open}
- Active downtime: ${context.downtime.filter((d) => d.isActive).length} stations

Station Status:
${context.stations.map((s) => `- ${s.name}: WIP=${s.wipCount}${s.isDowntime ? ' [DOWN]' : ''}`).join('\n')}

${context.downtime.filter((d) => d.isActive).length > 0 ? `Active Downtime:\n${context.downtime.filter((d) => d.isActive).map((d) => `- ${d.stationName}: ${d.reason} (${d.minutes} min)`).join('\n')}` : ''}`;

    // Build messages
    const messages: ChatMessage[] = [
      { role: 'system', content: CHAT_ASSISTANT_PROMPT },
      { role: 'system', content: `Here is the current production context:\n\n${contextSummary}` },
      ...conversationHistory,
      { role: 'user', content: question },
    ];

    const response = await chat(messages, { temperature: 0.7, maxTokens: 1000 });

    return response || 'I apologize, but I was unable to generate a response. Please try again.';
  } catch (error) {
    console.error('Question answering failed:', error);
    return 'I encountered an error while processing your question. Please try again.';
  }
}
