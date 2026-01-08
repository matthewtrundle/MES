import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons, UnitStatusBadge } from '@/components/icons';
import { KPICard, KPIGrid } from '@/components/supervisor/KPICard';
import { ProductionFlow } from '@/components/supervisor/ProductionFlow';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';

async function getDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeWorkOrders,
    unitsCompletedToday,
    activeDowntime,
    openNCRs,
    stations,
    recentUnits,
    downtimeIntervals,
    qualityResults,
  ] = await Promise.all([
    prisma.workOrder.count({
      where: { status: { in: ['released', 'in_progress'] } },
    }),
    prisma.unit.count({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
    }),
    prisma.downtimeInterval.findMany({
      where: { endedAt: null },
      include: { station: true, reason: true },
    }),
    prisma.nonconformanceRecord.count({
      where: { status: { in: ['open', 'dispositioned'] } },
    }),
    prisma.station.findMany({
      orderBy: { sequenceOrder: 'asc' },
    }),
    prisma.unit.findMany({
      take: 8,
      orderBy: { updatedAt: 'desc' },
      include: {
        workOrder: true,
      },
    }),
    // Downtime today
    prisma.downtimeInterval.findMany({
      where: {
        startedAt: { gte: today },
        endedAt: { not: null },
      },
    }),
    // Quality results today
    prisma.qualityCheckResult.findMany({
      where: {
        timestamp: { gte: today },
      },
    }),
  ]);

  // Calculate downtime minutes today
  const downtimeMinutesToday = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  // Calculate quality stats
  const passCount = qualityResults.filter((q) => q.result === 'pass').length;
  const failCount = qualityResults.filter((q) => q.result === 'fail').length;
  const qualityRate = qualityResults.length > 0
    ? Math.round((passCount / qualityResults.length) * 100)
    : 100;

  // Get WIP counts per station
  const wipCounts = await prisma.unit.groupBy({
    by: ['currentStationId'],
    where: {
      status: { in: ['in_progress', 'rework'] },
      currentStationId: { not: null },
    },
    _count: true,
  });

  const wipMap = new Map(
    wipCounts.map((w) => [w.currentStationId, w._count])
  );

  // Get active units at stations
  const activeUnits = await prisma.unit.findMany({
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
  });

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

  const downtimeStationIds = new Set(activeDowntime.map((d) => d.stationId));

  const stationsWithData = stations.map((station) => ({
    id: station.id,
    name: station.name,
    stationType: station.stationType,
    sequenceOrder: station.sequenceOrder,
    wipCount: wipMap.get(station.id) ?? 0,
    isDowntime: downtimeStationIds.has(station.id),
    currentUnit: unitAtStation.get(station.id)?.serial,
    cycleTime: unitAtStation.get(station.id)?.cycleTime,
    estimatedTime: unitAtStation.get(station.id)?.estimatedTime,
  }));

  const totalWIP = stationsWithData.reduce((sum, s) => sum + s.wipCount, 0);

  return {
    activeWorkOrders,
    unitsCompletedToday,
    activeDowntime,
    openNCRs,
    stationsWithData,
    recentUnits,
    totalWIP,
    downtimeMinutesToday,
    qualityRate,
    passCount,
    failCount,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.station className="h-8 w-8 text-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Production Dashboard
                </h1>
                <p className="text-sm text-gray-500">Motor Assembly Plant</p>
              </div>
            </div>
            <AutoRefresh intervalSeconds={30} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Active Downtime Alert */}
        {data.activeDowntime.length > 0 && (
          <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Icons.warning className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  Active Downtime ({data.activeDowntime.length})
                </h3>
                <div className="mt-2 space-y-1">
                  {data.activeDowntime.map((dt) => {
                    const minutes = Math.round(
                      (Date.now() - new Date(dt.startedAt).getTime()) / 60000
                    );
                    return (
                      <div
                        key={dt.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-amber-700">
                          {dt.station.name}:{' '}
                          <span className="font-medium">
                            {dt.reason?.description ?? 'Awaiting reason'}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-amber-800">
                          {minutes} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Link
                href="/dashboard/downtime"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                View Details
              </Link>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <KPIGrid columns={4} className="mb-6">
          <KPICard
            title="Units Completed Today"
            value={data.unitsCompletedToday}
            icon="pass"
            status="success"
            subtitle="Target: 10"
          />
          <KPICard
            title="Work in Progress"
            value={data.totalWIP}
            icon="unit"
            status="normal"
          />
          <KPICard
            title="Open NCRs"
            value={data.openNCRs}
            icon="qualityFail"
            status={data.openNCRs > 0 ? 'critical' : 'normal'}
            subtitle={data.openNCRs > 0 ? 'Action required' : 'None'}
          />
          <KPICard
            title="Quality Rate"
            value={`${data.qualityRate}%`}
            icon="gauge"
            status={data.qualityRate < 95 ? 'warning' : 'success'}
            subtitle={`${data.passCount} pass / ${data.failCount} fail`}
          />
        </KPIGrid>

        {/* Production Flow */}
        <ProductionFlow stations={data.stationsWithData} className="mb-6" />

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Units */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Icons.unit className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Recent Units</h3>
              </div>
              <Link
                href="/dashboard/traceability"
                className="text-sm text-blue-600 hover:underline"
              >
                Search All
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {data.recentUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-mono font-medium text-gray-900">
                      {unit.serialNumber}
                    </p>
                    <p className="text-sm text-gray-500">
                      {unit.workOrder.productCode}
                    </p>
                  </div>
                  <UnitStatusBadge status={unit.status as 'created' | 'in_progress' | 'completed' | 'scrapped' | 'rework'} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">Quick Access</h3>
              <div className="grid grid-cols-2 gap-3">
                <NavCard
                  href="/dashboard/wip"
                  icon="chart"
                  title="WIP Details"
                  description="Station breakdown"
                />
                <NavCard
                  href="/dashboard/downtime"
                  icon="clock"
                  title="Downtime"
                  description="Pareto analysis"
                />
                <NavCard
                  href="/dashboard/traceability"
                  icon="search"
                  title="Traceability"
                  description="Serial & lot search"
                />
                <NavCard
                  href="/dashboard/ncr"
                  icon="warning"
                  title="NCR Queue"
                  description={`${data.openNCRs} pending`}
                />
              </div>
            </div>

            {/* Summary Stats */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Today's Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icons.clock className="h-4 w-4" />
                    <span>Downtime</span>
                  </div>
                  <span
                    className={`font-mono font-semibold ${
                      data.downtimeMinutesToday > 30 ? 'text-amber-600' : 'text-gray-900'
                    }`}
                  >
                    {data.downtimeMinutesToday} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icons.gauge className="h-4 w-4" />
                    <span>Quality Checks</span>
                  </div>
                  <span className="font-mono font-semibold text-gray-900">
                    {data.passCount + data.failCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icons.station className="h-4 w-4" />
                    <span>Active Work Orders</span>
                  </div>
                  <span className="font-mono font-semibold text-gray-900">
                    {data.activeWorkOrders}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: 'chart' | 'clock' | 'search' | 'warning';
  title: string;
  description: string;
}) {
  const iconMap = {
    chart: Icons.chart,
    clock: Icons.clock,
    search: Icons.search,
    warning: Icons.warning,
  };
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="rounded-lg bg-gray-100 p-2">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
