import { prisma } from '@/lib/db/prisma';
import { ProductionFlow } from '@/components/supervisor/ProductionFlow';

export async function ProductionFlowSection() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    stations,
    wipCounts,
    activeUnits,
    recentCompletions,
    lastEventsPerStation,
    activeDowntime,
    downtimeIntervals,
    avgCycleTimeByStation,
  ] = await Promise.all([
    prisma.station.findMany({ orderBy: { sequenceOrder: 'asc' } }),
    prisma.unit.groupBy({
      by: ['currentStationId'],
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      _count: true,
    }),
    prisma.unit.findMany({
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      include: {
        executions: {
          where: { completedAt: null },
          include: { operation: true, operator: true },
          take: 1,
        },
      },
    }),
    prisma.unitOperationExecution.groupBy({
      by: ['stationId'],
      where: { completedAt: { gte: oneHourAgo } },
      _count: true,
    }),
    prisma.event.groupBy({
      by: ['stationId'],
      where: { stationId: { not: null } },
      _max: { createdAt: true },
    }),
    prisma.downtimeInterval.findMany({
      where: { endedAt: null },
      include: { station: true, reason: true },
    }),
    prisma.downtimeInterval.findMany({
      where: { startedAt: { gte: today }, endedAt: { not: null } },
    }),
    prisma.unitOperationExecution.groupBy({
      by: ['stationId'],
      where: { completedAt: { gte: today }, cycleTimeMinutes: { not: null } },
      _avg: { cycleTimeMinutes: true },
    }),
  ]);

  const avgCycleMap = new Map(
    avgCycleTimeByStation.map((c) => [c.stationId, c._avg.cycleTimeMinutes])
  );
  const wipMap = new Map(wipCounts.map((w) => [w.currentStationId, w._count]));
  const throughputMap = new Map(recentCompletions.map((c) => [c.stationId, c._count]));
  const downtimeStationIds = new Set(activeDowntime.map((d) => d.stationId));
  const lastActivityMap = new Map(lastEventsPerStation.map((e) => [e.stationId, e._max.createdAt]));

  // Build units-at-station map
  const allUnitsAtStation = new Map<string, Array<{
    serialNumber: string;
    cycleTime: number;
    estimatedTime?: number;
    operatorName?: string;
  }>>();

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
      allUnits: unitsAtThisStation,
      activeOperator,
      throughputPerHour: throughputMap.get(station.id) ?? 0,
      avgCycleTime: avgCycleMap.get(station.id) ?? null,
    };
  });

  // Bottleneck identification
  const activeStationsWithWIP = stationsWithData.filter(s => !s.isDowntime && s.wipCount > 0);
  let bottleneckStationId: string | null = null;
  let bottleneckStationName: string | null = null;
  if (activeStationsWithWIP.length > 0) {
    const bottleneck = activeStationsWithWIP.reduce((max, s) =>
      s.wipCount > max.wipCount ? s : max
    );
    if (bottleneck.wipCount >= 2) {
      bottleneckStationId = bottleneck.id;
      bottleneckStationName = bottleneck.name;
    }
  }

  // Uptime calculation
  const now = new Date();
  const shiftStartHour = 6;
  const shiftStart = new Date(today);
  shiftStart.setHours(shiftStartHour, 0, 0, 0);
  const effectiveStart = now > shiftStart ? shiftStart : today;
  const minutesSinceShiftStart = Math.max(1, Math.round((now.getTime() - effectiveStart.getTime()) / 60000));

  const downtimeMinutesToday = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  const activeDowntimeMinutes = activeDowntime.reduce((sum, dt) => {
    return sum + Math.round((Date.now() - new Date(dt.startedAt).getTime()) / 60000);
  }, 0);

  const totalStationMinutes = minutesSinceShiftStart * stations.length;
  const totalDowntimeMinutes = downtimeMinutesToday + activeDowntimeMinutes;
  const uptimePercent = totalStationMinutes > 0
    ? Math.min(100, Math.max(0, Math.round(((totalStationMinutes - totalDowntimeMinutes) / totalStationMinutes) * 100)))
    : 100;

  return (
    <ProductionFlow
      stations={stationsWithData}
      uptimePercent={uptimePercent}
      bottleneckStationId={bottleneckStationId}
      bottleneckStationName={bottleneckStationName}
      className="mb-6"
    />
  );
}
