import { prisma } from '@/lib/db/prisma';
import { Icons, StatusIndicator, UnitStatusBadge } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

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
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Work in Progress" subtitle="Station-by-station view">
        <AutoRefresh intervalSeconds={15} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total WIP</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{totalWIP}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Active Stations</p>
            <p className="text-2xl font-semibold text-green-600 mt-1">{activeStations}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">In Downtime</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">{downtimeStations}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total Stations</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{stations.length}</p>
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
                    : 'border-slate-200'
              }`}
            >
              {/* Station Header */}
              <div
                className={`px-4 py-3 ${
                  station.downtimeIntervals.length > 0
                    ? 'bg-amber-50 border-b border-amber-200'
                    : station.units.length > 0
                      ? 'bg-green-50 border-b border-green-200'
                      : 'bg-slate-50 border-b border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm border">
                      {station.sequenceOrder}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">{station.name}</h3>
                      <p className="text-xs text-slate-500 capitalize">{station.stationType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-semibold text-slate-900">{station.units.length}</p>
                      <p className="text-xs text-slate-500">units</p>
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
                  <p className="py-4 text-center text-slate-400 text-sm">
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
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500 live-indicator" />
                            <div>
                              <p className="font-mono font-semibold text-slate-900">
                                {unit.serialNumber}
                              </p>
                              <p className="text-xs text-slate-500">
                                {unit.workOrder.orderNumber} - {unit.workOrder.productCode}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {activeExecution && (
                              <div className="text-right">
                                <p className="text-xs text-slate-500">
                                  Step {activeExecution.operation.sequence}
                                </p>
                                <p className={`font-mono text-sm ${isOverTime ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>
                                  {elapsedMinutes}m
                                  {estimatedMinutes && (
                                    <span className="text-slate-400"> / {estimatedMinutes}m</span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">
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
