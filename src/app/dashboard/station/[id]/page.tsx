import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons, UnitStatusBadge, StatusIndicator } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';

interface StationPageProps {
  params: Promise<{ id: string }>;
}

async function getStationData(stationId: string) {
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { site: true },
  });

  if (!station) return null;

  // Get active downtime
  const activeDowntime = await prisma.downtimeInterval.findFirst({
    where: { stationId, endedAt: null },
    include: { reason: true, operator: true },
  });

  // Get units at this station
  const unitsAtStation = await prisma.unit.findMany({
    where: { currentStationId: stationId },
    include: {
      workOrder: true,
      executions: {
        where: { stationId, completedAt: null },
        include: { operation: true, operator: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Get recent completed operations at this station
  const recentOperations = await prisma.unitOperationExecution.findMany({
    where: { stationId },
    include: {
      unit: true,
      operation: true,
      operator: true,
    },
    orderBy: { completedAt: 'desc' },
    take: 10,
  });

  // Get downtime history for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDowntime = await prisma.downtimeInterval.findMany({
    where: {
      stationId,
      startedAt: { gte: today },
    },
    include: { reason: true },
    orderBy: { startedAt: 'desc' },
  });

  // Calculate stats
  const totalDowntimeMinutes = todayDowntime.reduce((sum, dt) => {
    const end = dt.endedAt ?? new Date();
    return sum + Math.round((end.getTime() - dt.startedAt.getTime()) / 60000);
  }, 0);

  const completedToday = recentOperations.filter(
    (op) => op.completedAt && op.completedAt >= today
  ).length;

  const passRate = recentOperations.length > 0
    ? Math.round(
        (recentOperations.filter((op) => op.result === 'pass').length /
          recentOperations.length) *
          100
      )
    : 100;

  // Get recent events
  const recentEvents = await prisma.event.findMany({
    where: { stationId },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  return {
    station,
    activeDowntime,
    unitsAtStation,
    recentOperations,
    todayDowntime,
    totalDowntimeMinutes,
    completedToday,
    passRate,
    recentEvents,
  };
}

export default async function StationDetailPage({ params }: StationPageProps) {
  const { id } = await params;
  const data = await getStationData(id);

  if (!data) {
    notFound();
  }

  const { station, activeDowntime, unitsAtStation, recentOperations, todayDowntime, totalDowntimeMinutes, completedToday, passRate, recentEvents } = data;

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
                <span>Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    activeDowntime
                      ? 'bg-amber-100'
                      : unitsAtStation.length > 0
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                  }`}
                >
                  <Icons.station className="h-6 w-6 text-gray-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900">
                      {station.name}
                    </h1>
                    <StatusIndicator
                      status={
                        activeDowntime
                          ? 'downtime'
                          : unitsAtStation.length > 0
                            ? 'running'
                            : 'idle'
                      }
                      size="md"
                      pulse={unitsAtStation.length > 0 && !activeDowntime}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    Station {station.sequenceOrder} - {station.stationType}
                  </p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={10} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Active Downtime Alert */}
        {activeDowntime && (
          <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <Icons.warning className="h-6 w-6 text-amber-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  Station Currently Down
                </h3>
                <p className="text-amber-700">
                  {activeDowntime.reason?.description ?? 'Reason not specified'} -
                  Started{' '}
                  {Math.round(
                    (Date.now() - new Date(activeDowntime.startedAt).getTime()) /
                      60000
                  )}{' '}
                  minutes ago
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icons.unit className="h-4 w-4" />
              <span>Current WIP</span>
            </div>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {unitsAtStation.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icons.pass className="h-4 w-4" />
              <span>Completed Today</span>
            </div>
            <p className="mt-1 text-3xl font-bold text-gray-900">{completedToday}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icons.gauge className="h-4 w-4" />
              <span>Pass Rate</span>
            </div>
            <p
              className={`mt-1 text-3xl font-bold ${
                passRate < 90 ? 'text-amber-600' : 'text-green-600'
              }`}
            >
              {passRate}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icons.clock className="h-4 w-4" />
              <span>Downtime Today</span>
            </div>
            <p
              className={`mt-1 text-3xl font-bold ${
                totalDowntimeMinutes > 30 ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {totalDowntimeMinutes}m
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Units at Station */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Units at Station</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {unitsAtStation.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.unit className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2">No units currently at this station</p>
                </div>
              ) : (
                unitsAtStation.map((unit) => {
                  const exec = unit.executions[0];
                  const cycleTime = exec
                    ? Math.round(
                        (Date.now() - new Date(exec.startedAt).getTime()) / 60000
                      )
                    : 0;

                  return (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-mono font-medium text-gray-900">
                          {unit.serialNumber}
                        </p>
                        <p className="text-sm text-gray-500">
                          {unit.workOrder.productCode} - {exec?.operation.sequence ?? '?'}.{' '}
                          {exec?.operator?.name ?? 'No operator'}
                        </p>
                      </div>
                      <div className="text-right">
                        <UnitStatusBadge status={unit.status as 'in_progress'} />
                        <p className="mt-1 text-sm text-gray-500">
                          {cycleTime} min in progress
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.activity className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2">No recent activity</p>
                </div>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <div
                      className={`mt-0.5 rounded-full p-1.5 ${
                        event.eventType.includes('completed')
                          ? 'bg-green-100'
                          : event.eventType.includes('downtime')
                            ? 'bg-amber-100'
                            : 'bg-blue-100'
                      }`}
                    >
                      {event.eventType.includes('completed') ? (
                        <Icons.pass className="h-3 w-3 text-green-600" />
                      ) : event.eventType.includes('downtime') ? (
                        <Icons.warning className="h-3 w-3 text-amber-600" />
                      ) : (
                        <Icons.activity className="h-3 w-3 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {event.eventType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Operations */}
          <div className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Recent Operations</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Serial</th>
                    <th className="px-4 py-2">Operator</th>
                    <th className="px-4 py-2">Started</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOperations.slice(0, 8).map((op) => {
                    const duration = op.completedAt
                      ? Math.round(
                          (new Date(op.completedAt).getTime() -
                            new Date(op.startedAt).getTime()) /
                            60000
                        )
                      : null;

                    return (
                      <tr key={op.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-sm">
                          {op.unit.serialNumber}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {op.operator?.name ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {new Date(op.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {duration !== null ? `${duration} min` : 'In progress'}
                        </td>
                        <td className="px-4 py-2">
                          {op.result ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                op.result === 'pass'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {op.result === 'pass' ? (
                                <Icons.pass className="h-3 w-3" />
                              ) : (
                                <Icons.qualityFail className="h-3 w-3" />
                              )}
                              {op.result}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
