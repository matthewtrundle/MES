import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons, UnitStatusBadge } from '@/components/icons';
import { KPICard, KPIGrid } from '@/components/supervisor/KPICard';
import { ProductionFlow } from '@/components/supervisor/ProductionFlow';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { SimulationControl } from '@/components/supervisor/SimulationControl';
import { DashboardTabs } from '@/components/supervisor/DashboardTabs';

export const revalidate = 30;

async function getDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    activeWorkOrders,
    unitsCompletedToday,
    activeDowntime,
    openNCRs,
    stations,
    recentUnits,
    downtimeIntervals,
    qualityResults,
    aiInsights,
    currentWorkOrder,
    wipCounts,
    activeUnits,
    recentCompletions,
    lastEventsPerStation,
    materialLots,
    consumptions,
    fpyExecutions,
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
        executions: {
          where: { completedAt: null },
          include: {
            operator: true,
            operation: true,
            station: true,
          },
          take: 1,
        },
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
    // AI insights (unacknowledged, recent)
    prisma.aIInsight.findMany({
      where: { acknowledged: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { station: { select: { name: true } } },
    }),
    // Current active work order
    prisma.workOrder.findFirst({
      where: { status: { in: ['released', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
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
    // Active units at stations with operator info
    prisma.unit.findMany({
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      include: {
        executions: {
          where: { completedAt: null },
          include: {
            operation: true,
            operator: true,
          },
          take: 1,
        },
      },
    }),
    // Recent completions for throughput (last hour)
    prisma.unitOperationExecution.groupBy({
      by: ['stationId'],
      where: {
        completedAt: { gte: oneHourAgo },
      },
      _count: true,
    }),
    // Last activity per station from events
    prisma.event.groupBy({
      by: ['stationId'],
      where: {
        stationId: { not: null },
      },
      _max: {
        createdAt: true,
      },
    }),
    // Material lots with remaining qty
    prisma.materialLot.findMany({
      where: { qtyRemaining: { gt: 0 } },
    }),
    // Material consumptions in last 24h
    prisma.unitMaterialConsumption.groupBy({
      by: ['materialLotId'],
      where: { timestamp: { gte: yesterday } },
      _sum: { qtyConsumed: true },
    }),
    // FPY executions
    prisma.unitOperationExecution.findMany({
      where: {
        completedAt: { not: null },
        result: { not: null },
      },
      select: {
        isRework: true,
        result: true,
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

  const wipMap = new Map(
    wipCounts.map((w) => [w.currentStationId, w._count])
  );

  const throughputMap = new Map(
    recentCompletions.map((c) => [c.stationId, c._count])
  );

  // Build allUnits map - group all units by station
  const allUnitsAtStation = new Map<string, Array<{
    serialNumber: string;
    cycleTime: number;
    estimatedTime?: number;
    operatorName?: string;
  }>>();

  // Sort by updatedAt to get the oldest (first in queue) unit per station
  const sortedActiveUnits = [...activeUnits].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  );

  sortedActiveUnits.forEach((unit) => {
    if (unit.currentStationId && unit.executions[0]) {
      const exec = unit.executions[0];
      const cycleTime = Math.round((Date.now() - new Date(exec.startedAt).getTime()) / 60000);

      const unitData = {
        serialNumber: unit.serialNumber,
        cycleTime,
        estimatedTime: exec.operation.estimatedMinutes ?? undefined,
        operatorName: exec.operator?.name,
      };

      const existing = allUnitsAtStation.get(unit.currentStationId) || [];
      existing.push(unitData);
      allUnitsAtStation.set(unit.currentStationId, existing);
    }
  });

  // Map first (oldest) active unit to each station for backward compatibility
  const unitAtStation = new Map<string, { serial: string; cycleTime?: number; estimatedTime?: number }>();
  allUnitsAtStation.forEach((units, stationId) => {
    if (units.length > 0) {
      unitAtStation.set(stationId, {
        serial: units[0].serialNumber,
        cycleTime: units[0].cycleTime,
        estimatedTime: units[0].estimatedTime,
      });
    }
  });

  const downtimeStationIds = new Set(activeDowntime.map((d) => d.stationId));

  const lastActivityMap = new Map(
    lastEventsPerStation.map((e) => [e.stationId, e._max.createdAt])
  );

  const stationsWithData = stations.map((station) => {
    const unitsAtThisStation = allUnitsAtStation.get(station.id) || [];
    const activeOperator = unitsAtThisStation.length > 0 ? unitsAtThisStation[0].operatorName : undefined;

    return {
      id: station.id,
      name: station.name,
      stationType: station.stationType,
      sequenceOrder: station.sequenceOrder,
      wipCount: wipMap.get(station.id) ?? 0,
      isDowntime: downtimeStationIds.has(station.id),
      currentUnit: unitAtStation.get(station.id)?.serial,
      cycleTime: unitAtStation.get(station.id)?.cycleTime,
      estimatedTime: unitAtStation.get(station.id)?.estimatedTime,
      lastActivity: lastActivityMap.get(station.id) ?? null,
      // Enhanced data
      allUnits: unitsAtThisStation,
      activeOperator,
      throughputPerHour: throughputMap.get(station.id) ?? 0,
    };
  });

  const totalWIP = stationsWithData.reduce((sum, s) => sum + s.wipCount, 0);

  // Identify bottleneck - station with highest WIP (not in downtime) is the constraint
  const activeStationsWithWIP = stationsWithData.filter(s => !s.isDowntime && s.wipCount > 0);
  let bottleneckStationId: string | null = null;
  let bottleneckStationName: string | null = null;

  if (activeStationsWithWIP.length > 0) {
    const bottleneck = activeStationsWithWIP.reduce((max, s) =>
      s.wipCount > max.wipCount ? s : max
    );
    // Only flag as bottleneck if WIP >= 2 (meaningful accumulation)
    if (bottleneck.wipCount >= 2) {
      bottleneckStationId = bottleneck.id;
      bottleneckStationName = bottleneck.name;
    }
  }

  // Calculate shift-based targets
  const now = new Date();
  const shiftStartHour = 6;
  const shiftLengthHours = 8;
  const targetUnitsPerShift = 30; // Target output per shift
  const targetDowntimeMinutes = 15; // Max acceptable downtime
  const targetQualityRate = 98; // Target quality %
  const targetMaxWIP = 5; // Target max WIP

  // Calculate expected units by now based on shift progress
  const hoursIntoShift = Math.max(0, (now.getHours() - shiftStartHour) + (now.getMinutes() / 60));
  const shiftProgress = Math.min(1, hoursIntoShift / shiftLengthHours);
  const expectedUnitsByNow = Math.round(targetUnitsPerShift * shiftProgress);

  // Calculate inventory runway
  const consumptionMap = new Map(
    consumptions.map((c) => [c.materialLotId, c._sum.qtyConsumed ?? 0])
  );

  // Aggregate by material code and calculate runway
  const materialMap = new Map<string, {
    qtyRemaining: number;
    consumption24h: number;
  }>();

  materialLots.forEach((lot) => {
    const existing = materialMap.get(lot.materialCode) || { qtyRemaining: 0, consumption24h: 0 };
    materialMap.set(lot.materialCode, {
      qtyRemaining: existing.qtyRemaining + lot.qtyRemaining,
      consumption24h: existing.consumption24h + (consumptionMap.get(lot.id) || 0),
    });
  });

  let lowestRunwayHours: number | null = null;
  let criticalMaterialCount = 0;
  let lowMaterialCount = 0;

  materialMap.forEach((material) => {
    const consumptionRate = material.consumption24h / 24; // per hour
    const runwayHours = consumptionRate > 0 ? material.qtyRemaining / consumptionRate : null;

    if (runwayHours !== null) {
      if (lowestRunwayHours === null || runwayHours < lowestRunwayHours) {
        lowestRunwayHours = runwayHours;
      }
      if (runwayHours < 4) {
        criticalMaterialCount++;
      } else if (runwayHours < 12) {
        lowMaterialCount++;
      }
    }
  });

  const inventoryStatus: 'good' | 'warning' | 'critical' =
    criticalMaterialCount > 0 ? 'critical' :
    lowMaterialCount > 0 ? 'warning' : 'good';

  // Calculate FPY for the KPI card
  const fpyFirstAttempts = fpyExecutions.filter((e) => !e.isRework);
  const fpyFirstPassCount = fpyFirstAttempts.filter((e) => e.result === 'pass').length;
  const overallFPY = fpyFirstAttempts.length > 0
    ? Math.round((fpyFirstPassCount / fpyFirstAttempts.length) * 1000) / 10
    : 100;

  // Calculate uptime percentage for today
  // Use time since start of shift (reuse shiftStartHour from targets section)
  const shiftStart = new Date(today);
  shiftStart.setHours(shiftStartHour, 0, 0, 0);

  // If current time is before shift start, use start of day
  const effectiveStart = now > shiftStart ? shiftStart : today;
  const minutesSinceShiftStart = Math.max(1, Math.round((now.getTime() - effectiveStart.getTime()) / 60000));

  // Total downtime across all stations today (including active downtime)
  const activeDowntimeMinutes = activeDowntime.reduce((sum, dt) => {
    return sum + Math.round((Date.now() - new Date(dt.startedAt).getTime()) / 60000);
  }, 0);

  // Uptime % = (Available time - Downtime) / Available time * 100
  // For multiple stations, we calculate per-station and average
  const totalStationMinutes = minutesSinceShiftStart * stations.length;
  const totalDowntimeMinutes = downtimeMinutesToday + activeDowntimeMinutes;
  const uptimePercent = totalStationMinutes > 0
    ? Math.round(((totalStationMinutes - totalDowntimeMinutes) / totalStationMinutes) * 100)
    : 100;

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
    aiInsights,
    currentWorkOrder,
    inventoryStatus,
    lowestRunwayHours,
    criticalMaterialCount,
    lowMaterialCount,
    uptimePercent: Math.min(100, Math.max(0, uptimePercent)),
    // Bottleneck identification
    bottleneckStationId,
    bottleneckStationName,
    // Targets
    expectedUnitsByNow,
    targetUnitsPerShift,
    targetDowntimeMinutes,
    targetQualityRate,
    targetMaxWIP,
    // FPY
    overallFPY,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with industrial styling */}
      <header className="industrial-header">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg">
                <Icons.station className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                  Production Dashboard
                </h1>
                <p className="text-sm text-slate-500 font-medium">Motor Assembly Plant</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="metric-badge bg-green-50 border border-green-200">
                <div className="h-2 w-2 rounded-full bg-green-500 live-indicator" />
                <span className="ml-2 text-green-700 font-semibold text-xs uppercase tracking-wide">System Online</span>
              </div>
              <AutoRefresh intervalSeconds={30} />
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Icons.settings className="h-4 w-4" />
                Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Work Order Hero Section with industrial styling */}
      {data.currentWorkOrder && (
        <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <Icons.activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold">Active Work Order</p>
                  <h2 className="text-3xl font-bold text-blue-900 tracking-tight">{data.currentWorkOrder.orderNumber}</h2>
                </div>
                <div className="h-14 w-px bg-blue-200" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold">Product</p>
                  <p className="text-xl font-bold text-blue-800 tracking-tight">{data.currentWorkOrder.productCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold">Units Completed</p>
                  <p className="text-4xl font-bold text-blue-900 tracking-tight">
                    {data.currentWorkOrder.qtyCompleted}
                    <span className="text-xl text-blue-400 font-normal"> / {data.currentWorkOrder.qtyOrdered}</span>
                  </p>
                </div>
                <div className="w-56 bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-blue-500 uppercase tracking-wide font-semibold">Progress</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {Math.round((data.currentWorkOrder.qtyCompleted / data.currentWorkOrder.qtyOrdered) * 100)}%
                    </span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-blue-100 border border-blue-200">
                    <div
                      className="h-full transition-all duration-500 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"
                      style={{
                        width: `${Math.round((data.currentWorkOrder.qtyCompleted / data.currentWorkOrder.qtyOrdered) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Controls */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <SimulationControl />
        </div>
      </div>

      {/* Dashboard Navigation Tabs */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <DashboardTabs />
        </div>
      </div>

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

        {/* AI Insights Alert - Actionable Recommendations */}
        {data.aiInsights.length > 0 && (
          <div className="mb-6 rounded-lg border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Icons.ai className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-purple-800">
                    AI Recommendations
                  </h3>
                  <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {data.aiInsights.length} actionable
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {data.aiInsights.slice(0, 2).map((insight) => (
                    <div
                      key={insight.id}
                      className={`flex items-start gap-3 rounded-lg p-2 ${
                        insight.severity === 'critical'
                          ? 'bg-red-50 border border-red-200'
                          : insight.severity === 'warning'
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-white border border-purple-100'
                      }`}
                    >
                      <div className={`mt-0.5 rounded-full p-1 ${
                        insight.severity === 'critical'
                          ? 'bg-red-100'
                          : insight.severity === 'warning'
                            ? 'bg-amber-100'
                            : 'bg-purple-100'
                      }`}>
                        <Icons.warning className={`h-3 w-3 ${
                          insight.severity === 'critical'
                            ? 'text-red-600'
                            : insight.severity === 'warning'
                              ? 'text-amber-600'
                              : 'text-purple-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          insight.severity === 'critical'
                            ? 'text-red-800'
                            : insight.severity === 'warning'
                              ? 'text-amber-800'
                              : 'text-purple-800'
                        }`}>
                          {/* Convert passive insights to action-oriented */}
                          {insight.title.includes('Low') || insight.title.includes('High')
                            ? `Action: ${insight.description?.slice(0, 80) || insight.title}...`
                            : insight.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {insight.station?.name ? `📍 ${insight.station.name}` : '🏭 Line-wide'}
                          {' • '}
                          <span className="font-medium">
                            {insight.insightType === 'recommendation' ? 'Recommended' : insight.insightType === 'anomaly' ? 'Anomaly detected' : 'Predicted'}
                          </span>
                        </p>
                      </div>
                      <Link
                        href="/dashboard/ai"
                        className={`flex-shrink-0 rounded px-2 py-1 text-xs font-semibold transition-colors ${
                          insight.severity === 'critical'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : insight.severity === 'warning'
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        Take Action →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
              {data.aiInsights.length > 2 && (
                <Link
                  href="/dashboard/ai"
                  className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50"
                >
                  +{data.aiInsights.length - 2} more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* KPI Grid - All cards are clickable for drill-down with Target vs Actual */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KPICard
            title="Units Completed"
            value={data.unitsCompletedToday}
            icon="pass"
            status={data.unitsCompletedToday >= data.expectedUnitsByNow ? 'success' : 'warning'}
            subtitle="Today"
            target={{
              value: data.expectedUnitsByNow,
              label: 'by now',
              comparison: 'above'
            }}
            href="/dashboard/production"
          />
          <KPICard
            title="Work in Progress"
            value={data.totalWIP}
            icon="unit"
            status={data.totalWIP <= data.targetMaxWIP ? 'success' : data.totalWIP <= data.targetMaxWIP * 2 ? 'warning' : 'critical'}
            target={{
              value: data.targetMaxWIP,
              label: 'max',
              comparison: 'below'
            }}
            href="/dashboard/wip"
          />
          <KPICard
            title="Open NCRs"
            value={data.openNCRs}
            icon="qualityFail"
            status={data.openNCRs > 0 ? 'critical' : 'success'}
            subtitle={data.openNCRs > 0 ? 'Action required' : 'None'}
            target={{
              value: 0,
              comparison: 'equal'
            }}
            href="/dashboard/ncr"
          />
          <KPICard
            title="Quality Rate"
            value={`${data.qualityRate}%`}
            icon="gauge"
            status={data.qualityRate >= data.targetQualityRate ? 'success' : data.qualityRate >= 90 ? 'warning' : 'critical'}
            subtitle={`${data.passCount} pass / ${data.failCount} fail`}
            target={{
              value: `${data.targetQualityRate}%`,
              comparison: 'above'
            }}
            href="/dashboard/quality"
          />
          <KPICard
            title="First-Pass Yield"
            value={`${data.overallFPY}%`}
            icon="gauge"
            status={data.overallFPY >= 95 ? 'success' : data.overallFPY >= 90 ? 'warning' : 'critical'}
            subtitle="All stations"
            target={{
              value: '95%',
              comparison: 'above'
            }}
            href="/dashboard/quality"
          />
          <KPICard
            title="Material Runway"
            value={data.lowestRunwayHours !== null ? `${Math.round(data.lowestRunwayHours)}h` : '∞'}
            icon="material"
            status={data.inventoryStatus === 'good' ? 'success' : data.inventoryStatus}
            subtitle={
              data.criticalMaterialCount > 0
                ? `${data.criticalMaterialCount} critical`
                : data.lowMaterialCount > 0
                  ? `${data.lowMaterialCount} low`
                  : 'All good'
            }
            target={{
              value: '8h',
              label: 'min',
              comparison: 'above'
            }}
            href="/dashboard/inventory"
          />
        </div>

        {/* Production Flow */}
        <ProductionFlow
          stations={data.stationsWithData}
          uptimePercent={data.uptimePercent}
          bottleneckStationId={data.bottleneckStationId}
          bottleneckStationName={data.bottleneckStationName}
          className="mb-6"
        />

        {/* Bottom Section - Recent Units and Shift Summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Units - wider */}
          <div className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Icons.unit className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Recent Units</h3>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/traceability"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Search All
                </Link>
                <Link
                  href="/station"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <Icons.scan className="h-4 w-4" />
                  Operator View
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              {data.recentUnits.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Icons.unit className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    No units in progress
                  </p>
                  <p className="text-xs text-gray-400">
                    Release a work order to begin production
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50/50">
                    <tr className="text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5 text-left font-semibold">Serial</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Station</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Operator</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Time</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Progress</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentUnits.map((unit) => {
                      const activeExecution = unit.executions?.[0];
                      const cycleTime = activeExecution
                        ? Math.round((Date.now() - new Date(activeExecution.startedAt).getTime()) / 60000)
                        : null;
                      const estimatedTime = activeExecution?.operation?.estimatedMinutes;
                      const progressPercent = cycleTime && estimatedTime
                        ? Math.min(100, (cycleTime / estimatedTime) * 100)
                        : null;
                      const isOverTime = cycleTime && estimatedTime && cycleTime > estimatedTime;

                      return (
                        <tr key={unit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/traceability?serial=${unit.serialNumber}`}
                              className="font-mono font-medium text-blue-600 hover:underline"
                            >
                              {unit.serialNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {activeExecution?.station?.name ?? (unit.status === 'completed' ? 'Completed' : '—')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {activeExecution?.operator?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {cycleTime !== null ? (
                              <span className={`font-mono text-sm ${isOverTime ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                                {cycleTime}m
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {progressPercent !== null ? (
                              <div className="mx-auto w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${isOverTime ? 'bg-amber-400' : 'bg-green-400'}`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            ) : (
                              <div className="text-center text-gray-400">—</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <UnitStatusBadge status={unit.status as 'created' | 'in_progress' | 'completed' | 'scrapped' | 'rework'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Shift Summary */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
              <Icons.history className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Shift Summary</h3>
            </div>
            <div className="p-4 space-y-4">
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.material className="h-4 w-4" />
                  <span>Material Issues</span>
                </div>
                <span className={`font-mono font-semibold ${
                  data.criticalMaterialCount > 0 ? 'text-red-600' :
                  data.lowMaterialCount > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {data.criticalMaterialCount + data.lowMaterialCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
