import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons, StatusIndicator, UnitStatusBadge } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';

export const dynamic = 'force-dynamic';

export const revalidate = 30;

async function getWIPData() {
  // Get all stations with their downtime
  const stations = await prisma.station.findMany({
    include: {
      downtimeIntervals: {
        where: { endedAt: null },
        include: {
          reason: true,
          operator: true,
        },
      },
    },
    orderBy: { sequenceOrder: 'asc' },
  });

  // Get all units at stations with their details
  const unitsAtStations = await prisma.unit.findMany({
    where: {
      status: { in: ['in_progress', 'rework'] },
      currentStationId: { not: null },
    },
    include: {
      workOrder: true,
      executions: {
        where: { completedAt: null },
        include: {
          operator: true,
          operation: true,
        },
      },
    },
  });

  // Group units by station
  const unitsByStation = new Map<string, typeof unitsAtStations>();
  unitsAtStations.forEach((unit) => {
    const stationId = unit.currentStationId!;
    const existing = unitsByStation.get(stationId) ?? [];
    existing.push(unit);
    unitsByStation.set(stationId, existing);
  });

  // Combine stations with their units
  const stationsWithData = stations.map((station) => ({
    ...station,
    units: unitsByStation.get(station.id) ?? [],
  }));

  return stationsWithData;
}

export default async function WIPPage() {
  const stations = await getWIPData();

  const totalWIP = stations.reduce((sum, station) => sum + station.units.length, 0);
  const activeStations = stations.filter(s => s.units.length > 0 && s.downtimeIntervals.length === 0).length;
  const downtimeStations = stations.filter(s => s.downtimeIntervals.length > 0).length;

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
                  <Icons.layers className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Work in Progress
                  </h1>
                  <p className="text-sm text-gray-500">Station-by-station view</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AutoRefresh intervalSeconds={15} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Icons.unit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalWIP}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total WIP</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Icons.running className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeStations}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Active Stations</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Icons.warning className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{downtimeStations}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">In Downtime</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Icons.station className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stations.length}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Stations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stations Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {stations.map((station) => (
            <div
              key={station.id}
              className={`rounded-lg border bg-white overflow-hidden ${
                station.downtimeIntervals.length > 0
                  ? 'border-amber-300'
                  : station.units.length > 0
                    ? 'border-green-300'
                    : 'border-gray-200'
              }`}
            >
              {/* Station Header */}
              <div
                className={`px-4 py-3 ${
                  station.downtimeIntervals.length > 0
                    ? 'bg-amber-50 border-b border-amber-200'
                    : station.units.length > 0
                      ? 'bg-green-50 border-b border-green-200'
                      : 'bg-gray-50 border-b border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 shadow-sm border">
                      {station.sequenceOrder}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{station.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{station.stationType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{station.units.length}</p>
                      <p className="text-xs text-gray-500">units</p>
                    </div>
                    <StatusIndicator
                      status={
                        station.downtimeIntervals.length > 0
                          ? 'downtime'
                          : station.units.length > 0
                            ? 'running'
                            : 'idle'
                      }
                      size="lg"
                      pulse={station.units.length > 0 && station.downtimeIntervals.length === 0}
                    />
                  </div>
                </div>

                {/* Downtime Alert */}
                {station.downtimeIntervals.length > 0 && (
                  <div className="mt-3 rounded bg-amber-100 p-2 text-sm">
                    {station.downtimeIntervals.map((dt) => {
                      const minutes = Math.round(
                        (Date.now() - new Date(dt.startedAt).getTime()) / 60000
                      );
                      return (
                        <div key={dt.id} className="flex items-center justify-between">
                          <span className="font-medium text-amber-800">
                            {dt.reason?.code ?? 'No reason'}: {dt.reason?.description ?? 'Awaiting selection'}
                          </span>
                          <span className="font-mono font-bold text-amber-700">{minutes}m</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Units List */}
              <div className="p-4">
                {station.units.length === 0 ? (
                  <p className="py-4 text-center text-gray-400 text-sm">
                    No units at this station
                  </p>
                ) : (
                  <div className="space-y-2">
                    {station.units.map((unit) => {
                      const activeExecution = unit.executions[0];
                      const elapsedMinutes = activeExecution
                        ? Math.round(
                            (Date.now() - new Date(activeExecution.startedAt).getTime()) / 60000
                          )
                        : 0;
                      const estimatedMinutes = activeExecution?.operation?.estimatedMinutes;
                      const isOverTime = estimatedMinutes && elapsedMinutes > estimatedMinutes;

                      return (
                        <div
                          key={unit.id}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500 live-indicator" />
                            <div>
                              <p className="font-mono font-semibold text-gray-900">
                                {unit.serialNumber}
                              </p>
                              <p className="text-xs text-gray-500">
                                {unit.workOrder.orderNumber} - {unit.workOrder.productCode}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {activeExecution && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  Step {activeExecution.operation.sequence}
                                </p>
                                <p className={`font-mono text-sm ${isOverTime ? 'text-amber-600 font-bold' : 'text-gray-600'}`}>
                                  {elapsedMinutes}m
                                  {estimatedMinutes && (
                                    <span className="text-gray-400"> / {estimatedMinutes}m</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {activeExecution.operator.name}
                                </p>
                              </div>
                            )}
                            <UnitStatusBadge status={unit.status as 'in_progress' | 'rework'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
