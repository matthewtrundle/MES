import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Track server start time
const startTime = Date.now();

export async function GET() {
  const memoryUsage = process.memoryUsage();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Get last event timestamp (if any)
    const lastEvent = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Get counts for key entities
    const [workOrderCount, unitCount, eventCount] = await Promise.all([
      prisma.workOrder.count(),
      prisma.unit.count(),
      prisma.event.count(),
    ]);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
      database: {
        status: 'connected',
        lastEventAt: lastEvent?.createdAt ?? null,
        counts: {
          workOrders: workOrderCount,
          units: unitCount,
          events: eventCount,
        },
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        unit: 'MB',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: '1.0.0',
        database: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          unit: 'MB',
        },
      },
      { status: 503 }
    );
  }
}
