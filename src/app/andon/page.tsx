import { prisma } from '@/lib/db/prisma';
import { StationBlock } from '@/components/andon/StationBlock';
import { AlertBanner } from '@/components/andon/AlertBanner';
import { LiveTicker } from '@/components/andon/LiveTicker';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { Icons } from '@/components/icons';

export const dynamic = 'force-dynamic';

async function getAndonData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    stations,
    activeDowntime,
    openNCRs,
    completedToday,
    recentEvents,
    wipCounts,
    activeUnits,
  ] = await Promise.all([
    // All stations
    prisma.station.findMany({
      orderBy: { sequenceOrder: 'asc' },
    }),

    // Active downtime
    prisma.downtimeInterval.findMany({
      where: { endedAt: null },
      include: { station: true, reason: true },
    }),

    // Open NCRs
    prisma.nonconformanceRecord.count({
      where: { status: { in: ['open', 'dispositioned'] } },
    }),

    // Completed today
    prisma.unit.count({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
    }),

    // Recent events for ticker (no relations - just raw events)
    prisma.event.findMany({
      where: {
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // WIP counts per station
    prisma.unit.groupBy({
      by: ['currentStationId'],
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      _count: true,
    }),

    // Active units at stations
    prisma.unit.findMany({
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      include: {
        executions: {
          where: { completedAt: null },
          include: { operation: true },
          take: 1,
        },
      },
    }),
  ]);

  // Build WIP map
  const wipMap = new Map(
    wipCounts.map((w) => [w.currentStationId, w._count])
  );

  // Build active unit map
  const unitAtStation = new Map<string, { serial: string; cycleTime?: number; estimatedTime?: number }>();
  activeUnits.forEach((unit) => {
    if (unit.currentStationId && unit.executions[0]) {
      const exec = unit.executions[0];
      const cycleTime = Math.round((Date.now() - new Date(exec.startedAt).getTime()) / 60000);
      unitAtStation.set(unit.currentStationId, {
        serial: unit.serialNumber,
        cycleTime,
        estimatedTime: exec.operation.estimatedMinutes ?? undefined,
      });
    }
  });

  // Downtime station IDs
  const downtimeStationIds = new Set(activeDowntime.map((d) => d.stationId));

  // Build station name map for events
  const stationNameMap = new Map(stations.map((s) => [s.id, s.name]));

  // Fetch units for recent events that have unitIds
  const eventUnitIds = recentEvents.filter((e) => e.unitId).map((e) => e.unitId as string);
  const eventUnits = eventUnitIds.length > 0
    ? await prisma.unit.findMany({
        where: { id: { in: eventUnitIds } },
        select: { id: true, serialNumber: true },
      })
    : [];
  const unitSerialMap = new Map(eventUnits.map((u) => [u.id, u.serialNumber]));

  // Enrich events with station and unit info
  const enrichedEvents = recentEvents.map((event) => ({
    ...event,
    station: event.stationId ? { name: stationNameMap.get(event.stationId) ?? 'Unknown' } : null,
    unit: event.unitId ? { serialNumber: unitSerialMap.get(event.unitId) ?? 'Unknown' } : null,
  }));

  // Build station data
  const stationsWithData = stations.map((station) => {
    const wipCount = wipMap.get(station.id) ?? 0;
    const isDowntime = downtimeStationIds.has(station.id);
    const unitInfo = unitAtStation.get(station.id);

    return {
      id: station.id,
      name: station.name,
      stationType: station.stationType,
      sequenceOrder: station.sequenceOrder,
      wipCount,
      status: isDowntime ? 'downtime' : wipCount > 0 ? 'running' : 'idle' as 'running' | 'idle' | 'downtime',
      currentUnit: unitInfo?.serial,
      cycleTime: unitInfo?.cycleTime,
      estimatedTime: unitInfo?.estimatedTime,
    };
  });

  // Calculate summary metrics
  const totalWIP = stationsWithData.reduce((sum, s) => sum + s.wipCount, 0);
  const target = 10; // Daily target

  return {
    stations: stationsWithData,
    activeDowntime,
    openNCRs,
    completedToday,
    target,
    totalWIP,
    recentEvents: enrichedEvents,
  };
}

export default async function AndonPage() {
  const data = await getAndonData();

  // Determine overall status
  const hasDowntime = data.activeDowntime.length > 0;
  const hasNCRs = data.openNCRs > 0;
  const progressPercent = Math.round((data.completedToday / data.target) * 100);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col cursor-none select-none overflow-hidden">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Icons.station className="h-10 w-10 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ANDON BOARD</h1>
            <p className="text-sm text-gray-400">Motor Assembly Plant</p>
          </div>
        </div>

        {/* Production Progress */}
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Today&apos;s Output</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-green-400">{data.completedToday}</span>
              <span className="text-2xl text-gray-500">/ {data.target}</span>
            </div>
          </div>

          <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-3">
          <AutoRefresh intervalSeconds={10} showIndicator={false} />
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <span className="text-sm font-bold text-green-400 uppercase tracking-wider">Live</span>
          </div>
        </div>
      </header>

      {/* Station Blocks - Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="flex gap-6 flex-wrap justify-center">
          {data.stations.map((station) => (
            <StationBlock
              key={station.id}
              name={station.name}
              sequenceOrder={station.sequenceOrder}
              wipCount={station.wipCount}
              status={station.status}
              currentUnit={station.currentUnit}
              cycleTime={station.cycleTime}
              estimatedTime={station.estimatedTime}
            />
          ))}
        </div>
      </main>

      {/* Live Ticker */}
      <LiveTicker events={data.recentEvents} />

      {/* Alert Banner - Fixed at bottom */}
      <AlertBanner
        activeDowntime={data.activeDowntime}
        openNCRs={data.openNCRs}
      />
    </div>
  );
}
