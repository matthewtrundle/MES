import { prisma } from '@/lib/db/prisma';
import { notFound } from 'next/navigation';
import { Icons, UnitStatusBadge, StatusIndicator } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 30;

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

  // Calculate average cycle time from completed operations
  const completedOps = recentOperations.filter(op => op.completedAt);
  const avgCycleTime = completedOps.length > 0
    ? Math.round(
        completedOps.reduce((sum, op) => {
          const duration = op.completedAt!.getTime() - op.startedAt.getTime();
          return sum + duration / 60000; // Convert to minutes
        }, 0) / completedOps.length
      )
    : null;

  // Get estimated time from operations (if available)
  const estimatedTime = recentOperations[0]?.operation?.estimatedMinutes ?? null;

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
    avgCycleTime,
    estimatedTime,
    recentEvents,
  };
}

export default async function StationDetailPage({ params }: StationPageProps) {
  const { id } = await params;
  const data = await getStationData(id);

  if (!data) {
    notFound();
  }

  const { station, activeDowntime, unitsAtStation, recentOperations, todayDowntime, totalDowntimeMinutes, completedToday, passRate, avgCycleTime, estimatedTime, recentEvents } = data;

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader
        title={station.name}
        subtitle={`Station ${station.sequenceOrder} - ${station.stationType}`}
      >
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
        <AutoRefresh intervalSeconds={10} />
      </DashboardPageHeader>

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

        {/* Stats Row - Key metrics for drill-down */}
        <div className="mb-6 grid grid-cols-5 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icons.unit className="h-4 w-4" />
              <span>Current WIP</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {unitsAtStation.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icons.pass className="h-4 w-4" />
              <span>Completed Today</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-slate-900">{completedToday}</p>
          </div>
          {/* Avg Cycle Time - Critical demo metric */}
          <div className={`rounded-lg border p-4 ${
            avgCycleTime && estimatedTime && avgCycleTime > estimatedTime
              ? 'border-amber-300 bg-amber-50'
              : 'border-slate-200 bg-white'
          }`}>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icons.timer className="h-4 w-4" />
              <span>Avg Cycle Time</span>
            </div>
            <p className={`mt-1 text-xl font-semibold ${
              avgCycleTime && estimatedTime && avgCycleTime > estimatedTime
                ? 'text-amber-600'
                : 'text-slate-900'
            }`}>
              {avgCycleTime ?? '—'}m
            </p>
            {estimatedTime && (
              <p className="text-xs text-slate-500 mt-1">
                Target: {estimatedTime}m
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icons.gauge className="h-4 w-4" />
              <span>Pass Rate</span>
            </div>
            <p
              className={`mt-1 text-xl font-semibold ${
                passRate < 90 ? 'text-amber-600' : 'text-green-600'
              }`}
            >
              {passRate}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Target: ≥98%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icons.clock className="h-4 w-4" />
              <span>Downtime Today</span>
            </div>
            <p
              className={`mt-1 text-xl font-semibold ${
                totalDowntimeMinutes > 30 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {totalDowntimeMinutes}m
            </p>
            <p className="text-xs text-slate-500 mt-1">Target: &lt;15m</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Units at Station */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Units at Station</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {unitsAtStation.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500">
                  <Icons.unit className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2">No units currently at this station</p>
                </div>
              ) : (
                unitsAtStation.map((unit, index) => {
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
                        <p className="font-mono font-medium text-slate-900">
                          {unit.serialNumber}
                        </p>
                        <p className="text-sm text-slate-500">
                          {unit.workOrder.productCode} - Op {exec?.operation.sequence ?? '?'}
                          {exec?.operator && ` • ${exec.operator.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          In Progress
                        </span>
                        <p className="mt-1 text-sm text-slate-500">
                          {cycleTime} min
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            </div>
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500">
                  <Icons.activity className="mx-auto h-8 w-8 text-slate-300" />
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
                      <p className="text-sm text-slate-900">
                        {event.eventType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Operations */}
          <div className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Recent Operations</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Serial</th>
                    <th className="px-4 py-2">Operator</th>
                    <th className="px-4 py-2">Started</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOperations.slice(0, 8).map((op) => {
                    const duration = op.completedAt
                      ? Math.round(
                          (new Date(op.completedAt).getTime() -
                            new Date(op.startedAt).getTime()) /
                            60000
                        )
                      : null;

                    return (
                      <tr key={op.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-sm">
                          {op.unit.serialNumber}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                          {op.operator?.name ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                          {new Date(op.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
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
                            <span className="text-sm text-slate-400">-</span>
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
