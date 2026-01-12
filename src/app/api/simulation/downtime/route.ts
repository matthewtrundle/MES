import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST() {
  try {
    // Get random station, reason, and operator
    const [stations, downtimeReasons, operators, site] = await Promise.all([
      prisma.station.findMany(),
      prisma.downtimeReason.findMany(),
      prisma.user.findMany({ where: { role: 'operator' } }),
      prisma.site.findFirst(),
    ]);

    if (!site || stations.length === 0 || downtimeReasons.length === 0 || operators.length === 0) {
      return NextResponse.json(
        { error: 'Missing required data (site, stations, downtime reasons, or operators)' },
        { status: 400 }
      );
    }

    // Pick random elements
    const station = stations[Math.floor(Math.random() * stations.length)];
    const reason = downtimeReasons[Math.floor(Math.random() * downtimeReasons.length)];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    // Check if station already has active downtime
    const existingDowntime = await prisma.downtimeInterval.findFirst({
      where: { stationId: station.id, endedAt: null },
    });

    if (existingDowntime) {
      return NextResponse.json({
        success: false,
        message: `${station.name} already has active downtime`,
        station: station.name,
      });
    }

    // Create downtime
    const downtime = await prisma.downtimeInterval.create({
      data: {
        stationId: station.id,
        operatorId: operator.id,
        reasonId: reason.id,
        startedAt: new Date(),
      },
    });

    // Create event
    await prisma.event.create({
      data: {
        eventType: 'downtime_started',
        siteId: site.id,
        stationId: station.id,
        operatorId: operator.id,
        payload: { reason: reason.description },
        source: 'ui',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Downtime started at ${station.name}`,
      station: station.name,
      reason: reason.description,
      downtimeId: downtime.id,
    });
  } catch (error) {
    console.error('Failed to trigger downtime:', error);
    return NextResponse.json(
      { error: 'Failed to trigger downtime' },
      { status: 500 }
    );
  }
}

// Clear a specific downtime or all active downtimes
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const downtimeId = searchParams.get('id');
    const site = await prisma.site.findFirst();

    if (downtimeId) {
      // Clear specific downtime
      const downtime = await prisma.downtimeInterval.update({
        where: { id: downtimeId },
        data: { endedAt: new Date() },
        include: { station: true, reason: true },
      });

      if (site) {
        await prisma.event.create({
          data: {
            eventType: 'downtime_ended',
            siteId: site.id,
            stationId: downtime.stationId,
            payload: { reason: downtime.reason?.description },
            source: 'ui',
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Downtime cleared at ${downtime.station.name}`,
      });
    } else {
      // Clear all active downtimes
      const activeDowntimes = await prisma.downtimeInterval.findMany({
        where: { endedAt: null },
        include: { station: true, reason: true },
      });

      for (const dt of activeDowntimes) {
        await prisma.downtimeInterval.update({
          where: { id: dt.id },
          data: { endedAt: new Date() },
        });

        if (site) {
          await prisma.event.create({
            data: {
              eventType: 'downtime_ended',
              siteId: site.id,
              stationId: dt.stationId,
              payload: { reason: dt.reason?.description },
              source: 'ui',
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cleared ${activeDowntimes.length} active downtime(s)`,
        count: activeDowntimes.length,
      });
    }
  } catch (error) {
    console.error('Failed to clear downtime:', error);
    return NextResponse.json(
      { error: 'Failed to clear downtime' },
      { status: 500 }
    );
  }
}
