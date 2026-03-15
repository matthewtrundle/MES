import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { EventStream, EventTimeline } from '@/components/supervisor/EventStream';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 30;

interface SearchParams {
  type?: string;
  station?: string;
  unit?: string;
}

async function getEventsData(searchParams: SearchParams) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build where clause based on filters
  const where: Record<string, unknown> = {
    createdAt: { gte: today },
  };

  if (searchParams.type) {
    where.eventType = searchParams.type;
  }
  if (searchParams.station) {
    where.stationId = searchParams.station;
  }
  if (searchParams.unit) {
    where.unitId = searchParams.unit;
  }

  // Get events, stations for filter dropdown, and stats
  const [events, stations, eventStats, recentUnits] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.station.findMany({
      orderBy: { sequenceOrder: 'asc' },
    }),
    prisma.event.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: today } },
      _count: true,
    }),
    prisma.unit.findMany({
      where: {
        updatedAt: { gte: today },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, serialNumber: true },
    }),
  ]);

  // Get unit and station details for events
  const unitIds = events.filter((e) => e.unitId).map((e) => e.unitId as string);
  const stationIds = events.filter((e) => e.stationId).map((e) => e.stationId as string);
  const operatorIds = events.filter((e) => e.operatorId).map((e) => e.operatorId as string);

  const [eventUnits, eventStations, operators] = await Promise.all([
    unitIds.length > 0
      ? prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, serialNumber: true },
        })
      : [],
    stationIds.length > 0
      ? prisma.station.findMany({
          where: { id: { in: stationIds } },
          select: { id: true, name: true },
        })
      : [],
    operatorIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: operatorIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const unitMap = new Map(eventUnits.map((u) => [u.id, u.serialNumber]));
  const stationMap = new Map(eventStations.map((s) => [s.id, s.name]));
  const operatorMap = new Map(operators.map((o) => [o.id, o.name]));

  // Enrich events with related data
  const enrichedEvents = events.map((event) => ({
    ...event,
    payload: event.payload as Record<string, unknown>,
    unit: event.unitId ? { serialNumber: unitMap.get(event.unitId) ?? 'Unknown' } : null,
    station: event.stationId ? { name: stationMap.get(event.stationId) ?? 'Unknown' } : null,
    operator: event.operatorId ? { name: operatorMap.get(event.operatorId) ?? 'Unknown' } : null,
  }));

  // Get unique event types for filter
  const eventTypes = [...new Set(events.map((e) => e.eventType))].sort();

  // Build stats map
  const statsMap = new Map(eventStats.map((s) => [s.eventType, s._count]));

  return {
    events: enrichedEvents,
    stations,
    eventTypes,
    recentUnits,
    statsMap,
    totalEvents: events.length,
  };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getEventsData(params);

  // Calculate summary stats
  const operationEvents = (data.statsMap.get('operation_started') ?? 0) +
    (data.statsMap.get('operation_completed') ?? 0);
  const qualityEvents = data.statsMap.get('quality_check_recorded') ?? 0;
  const downtimeEvents = (data.statsMap.get('downtime_started') ?? 0) +
    (data.statsMap.get('downtime_ended') ?? 0);
  const ncrEvents = (data.statsMap.get('ncr_created') ?? 0) +
    (data.statsMap.get('ncr_dispositioned') ?? 0);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Event Stream" subtitle="Real-time production activity">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-medium text-green-600">Live</span>
        </div>
        <AutoRefresh intervalSeconds={5} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Event Stats Summary */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mb-6">
          <span>Total Events <span className="ml-1 font-semibold text-slate-900">{data.totalEvents}</span></span>
          <span>Operations <span className="ml-1 font-semibold text-blue-600">{operationEvents}</span></span>
          <span>Quality Checks <span className="ml-1 font-semibold text-purple-600">{qualityEvents}</span></span>
          <span>Downtime <span className="ml-1 font-semibold text-amber-600">{downtimeEvents}</span></span>
          <span>NCRs <span className="ml-1 font-semibold text-red-600">{ncrEvents}</span></span>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Event Type Filter */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Filter by Type</h3>
              <div className="space-y-2">
                <Link
                  href="/dashboard/events"
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !params.type
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Events
                </Link>
                {data.eventTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/dashboard/events?type=${type}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      params.type === type
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {type.replace(/_/g, ' ')}
                    <span className="ml-2 text-xs text-slate-400">
                      ({data.statsMap.get(type) ?? 0})
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Station Filter */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Filter by Station</h3>
              <div className="space-y-2">
                <Link
                  href={params.type ? `/dashboard/events?type=${params.type}` : '/dashboard/events'}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !params.station
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Stations
                </Link>
                {data.stations.map((station) => (
                  <Link
                    key={station.id}
                    href={`/dashboard/events?station=${station.id}${params.type ? `&type=${params.type}` : ''}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      params.station === station.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {station.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Units */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Recent Units</h3>
              <div className="space-y-2">
                {data.recentUnits.length === 0 ? (
                  <p className="text-sm text-slate-500">No units today</p>
                ) : (
                  data.recentUnits.map((unit) => (
                    <Link
                      key={unit.id}
                      href={`/dashboard/events?unit=${unit.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm font-mono transition-colors ${
                        params.unit === unit.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {unit.serialNumber}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Event Stream */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">
                  Event Feed
                  {params.type && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({params.type.replace(/_/g, ' ')})
                    </span>
                  )}
                </h3>
                <span className="text-sm text-slate-500">
                  {data.events.length} events
                </span>
              </div>
              <div className="p-4 max-h-[calc(100vh-350px)] overflow-y-auto">
                <EventStream events={data.events} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
