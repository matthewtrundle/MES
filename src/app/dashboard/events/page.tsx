import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { EventStream, EventTimeline } from '@/components/supervisor/EventStream';

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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Icons.chevronLeft className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Icons.clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Event Stream</h1>
                  <p className="text-sm text-gray-500">Real-time production activity</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-green-600">Live</span>
              </div>
              <AutoRefresh intervalSeconds={5} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Event Stats Summary */}
        <div className="mb-6 grid grid-cols-5 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Total Events</p>
            <p className="text-3xl font-bold text-gray-900">{data.totalEvents}</p>
            <p className="text-xs text-gray-400">Today</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">Operations</p>
            <p className="text-3xl font-bold text-blue-600">{operationEvents}</p>
            <p className="text-xs text-blue-400">Started & Completed</p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm text-purple-700">Quality Checks</p>
            <p className="text-3xl font-bold text-purple-600">{qualityEvents}</p>
            <p className="text-xs text-purple-400">Recorded</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Downtime</p>
            <p className="text-3xl font-bold text-amber-600">{downtimeEvents}</p>
            <p className="text-xs text-amber-400">Started & Ended</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">NCRs</p>
            <p className="text-3xl font-bold text-red-600">{ncrEvents}</p>
            <p className="text-xs text-red-400">Created & Dispositioned</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Event Type Filter */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Filter by Type</h3>
              <div className="space-y-2">
                <Link
                  href="/dashboard/events"
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !params.type
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
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
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {type.replace(/_/g, ' ')}
                    <span className="ml-2 text-xs text-gray-400">
                      ({data.statsMap.get(type) ?? 0})
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Station Filter */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Filter by Station</h3>
              <div className="space-y-2">
                <Link
                  href={params.type ? `/dashboard/events?type=${params.type}` : '/dashboard/events'}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !params.station
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
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
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {station.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Units */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Recent Units</h3>
              <div className="space-y-2">
                {data.recentUnits.length === 0 ? (
                  <p className="text-sm text-gray-500">No units today</p>
                ) : (
                  data.recentUnits.map((unit) => (
                    <Link
                      key={unit.id}
                      href={`/dashboard/events?unit=${unit.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm font-mono transition-colors ${
                        params.unit === unit.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
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
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Event Feed
                  {params.type && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({params.type.replace(/_/g, ' ')})
                    </span>
                  )}
                </h3>
                <span className="text-sm text-gray-500">
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
