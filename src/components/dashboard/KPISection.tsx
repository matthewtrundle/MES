import { prisma } from '@/lib/db/prisma';
import { KPICard } from '@/components/supervisor/KPICard';

export async function KPISection() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    unitsCompletedToday,
    unitsCompletedYesterday,
    unitsLastHour,
    openNCRs,
    qualityResults,
    qualityResultsYesterday,
    wipCounts,
    materialLots,
    consumptions,
    fpyExecutions,
  ] = await Promise.all([
    prisma.unit.count({
      where: { status: 'completed', updatedAt: { gte: today } },
    }),
    prisma.unit.count({
      where: { status: 'completed', updatedAt: { gte: yesterdayStart, lt: today } },
    }),
    prisma.unit.count({
      where: { status: 'completed', updatedAt: { gte: oneHourAgo } },
    }),
    prisma.nonconformanceRecord.count({
      where: { status: { in: ['open', 'dispositioned'] } },
    }),
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: today } },
    }),
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: yesterdayStart, lt: today } },
    }),
    prisma.unit.groupBy({
      by: ['currentStationId'],
      where: {
        status: { in: ['in_progress', 'rework'] },
        currentStationId: { not: null },
      },
      _count: true,
    }),
    prisma.materialLot.findMany({
      where: { qtyRemaining: { gt: 0 } },
    }),
    prisma.unitMaterialConsumption.groupBy({
      by: ['materialLotId'],
      where: { timestamp: { gte: yesterday } },
      _sum: { qtyConsumed: true },
    }),
    prisma.unitOperationExecution.findMany({
      where: { completedAt: { not: null }, result: { not: null } },
      select: { isRework: true, result: true },
    }),
  ]);

  // Quality rate today
  const passCount = qualityResults.filter((q) => q.result === 'pass').length;
  const failCount = qualityResults.filter((q) => q.result === 'fail').length;
  const qualityRate =
    qualityResults.length > 0
      ? Math.round((passCount / qualityResults.length) * 100)
      : 100;

  // Quality rate yesterday
  const passYesterday = qualityResultsYesterday.filter((q) => q.result === 'pass').length;
  const qualityRateYesterday =
    qualityResultsYesterday.length > 0
      ? Math.round((passYesterday / qualityResultsYesterday.length) * 100)
      : 100;

  const qualityDelta = qualityRate - qualityRateYesterday;

  const totalWIP = wipCounts.reduce((sum, w) => sum + w._count, 0);

  // Material runway
  const consumptionMap = new Map(
    consumptions.map((c) => [c.materialLotId, c._sum.qtyConsumed ?? 0])
  );

  const materialMap = new Map<string, { qtyRemaining: number; consumption24h: number }>();
  materialLots.forEach((lot) => {
    const existing = materialMap.get(lot.materialCode) || {
      qtyRemaining: 0,
      consumption24h: 0,
    };
    materialMap.set(lot.materialCode, {
      qtyRemaining: existing.qtyRemaining + lot.qtyRemaining,
      consumption24h:
        existing.consumption24h + (consumptionMap.get(lot.id) || 0),
    });
  });

  let lowestRunwayHours: number | null = null;
  let criticalMaterialCount = 0;
  let lowMaterialCount = 0;

  materialMap.forEach((material) => {
    const consumptionRate = material.consumption24h / 24;
    const runwayHours =
      consumptionRate > 0 ? material.qtyRemaining / consumptionRate : null;
    if (runwayHours !== null) {
      if (lowestRunwayHours === null || runwayHours < lowestRunwayHours) {
        lowestRunwayHours = runwayHours;
      }
      if (runwayHours < 4) criticalMaterialCount++;
      else if (runwayHours < 12) lowMaterialCount++;
    }
  });

  const inventoryStatus: 'good' | 'warning' | 'critical' =
    criticalMaterialCount > 0
      ? 'critical'
      : lowMaterialCount > 0
        ? 'warning'
        : 'good';

  // FPY
  const fpyFirstAttempts = fpyExecutions.filter((e) => !e.isRework);
  const fpyFirstPassCount = fpyFirstAttempts.filter(
    (e) => e.result === 'pass'
  ).length;
  const overallFPY =
    fpyFirstAttempts.length > 0
      ? Math.round((fpyFirstPassCount / fpyFirstAttempts.length) * 1000) / 10
      : 100;

  // Shift targets
  const now = new Date();
  const shiftStartHour = 6;
  const shiftLengthHours = 8;
  const targetUnitsPerShift = 30;
  const targetQualityRate = 98;
  const targetMaxWIP = 5;
  const hoursIntoShift = Math.max(
    0,
    now.getHours() - shiftStartHour + now.getMinutes() / 60
  );
  const shiftProgress = Math.min(1, hoursIntoShift / shiftLengthHours);
  const expectedUnitsByNow = Math.round(targetUnitsPerShift * shiftProgress);

  // Trends
  const unitsDelta = unitsCompletedToday - unitsCompletedYesterday;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title="Quality Rate"
          value={`${qualityRate}%`}
          icon="gauge"
          size="lg"
          status={
            qualityRate >= targetQualityRate
              ? 'success'
              : qualityRate >= 90
                ? 'warning'
                : 'critical'
          }
          subtitle={`${passCount} pass / ${failCount} fail`}
          target={{
            value: `${targetQualityRate}%`,
            comparison: 'above',
          }}
          trend={
            qualityDelta !== 0
              ? {
                  direction: qualityDelta > 0 ? 'up' : 'down',
                  value: `${Math.abs(qualityDelta)}%`,
                }
              : undefined
          }
          href="/dashboard/quality"
          className="lg:col-span-2"
        />
        <KPICard
          title="Units Completed"
          value={unitsCompletedToday}
          icon="pass"
          size="md"
          status={
            unitsCompletedToday >= expectedUnitsByNow ? 'success' : 'warning'
          }
          subtitle="Today"
          target={{
            value: expectedUnitsByNow,
            label: 'by now',
            comparison: 'above',
          }}
          trend={
            unitsDelta !== 0
              ? {
                  direction: unitsDelta > 0 ? 'up' : 'down',
                  value: `${Math.abs(unitsDelta)}`,
                }
              : undefined
          }
          timeBreakdown={{
            lastHour: `${unitsLastHour}`,
            today: `${unitsCompletedToday}`,
            direction: unitsLastHour > 0 ? 'up' : 'neutral',
          }}
          href="/dashboard/production"
          className="lg:col-span-2"
        />
        <KPICard
          title="Work in Progress"
          value={totalWIP}
          icon="unit"
          size="md"
          status={
            totalWIP <= targetMaxWIP
              ? 'success'
              : totalWIP <= targetMaxWIP * 2
                ? 'warning'
                : 'critical'
          }
          target={{
            value: targetMaxWIP,
            label: 'max',
            comparison: 'below',
          }}
          href="/dashboard/wip"
          className="lg:col-span-2"
        />
        <KPICard
          title="Material Runway"
          value={
            lowestRunwayHours !== null
              ? `${Math.round(lowestRunwayHours)}h`
              : '∞'
          }
          icon="material"
          size="sm"
          status={inventoryStatus === 'good' ? 'success' : inventoryStatus}
          subtitle={
            criticalMaterialCount > 0
              ? `${criticalMaterialCount} critical`
              : lowMaterialCount > 0
                ? `${lowMaterialCount} low`
                : 'All good'
          }
          target={{ value: '8h', label: 'min', comparison: 'above' }}
          href="/dashboard/inventory"
          className="lg:col-span-2"
        />
        <KPICard
          title="First-Pass Yield"
          value={`${overallFPY}%`}
          icon="gauge"
          size="sm"
          status={
            overallFPY >= 95
              ? 'success'
              : overallFPY >= 90
                ? 'warning'
                : 'critical'
          }
          subtitle="All stations"
          target={{ value: '95%', comparison: 'above' }}
          href="/dashboard/quality"
          className="lg:col-span-2"
        />
        <KPICard
          title="Open NCRs"
          value={openNCRs}
          icon="qualityFail"
          size="sm"
          status={openNCRs > 0 ? 'critical' : 'success'}
          subtitle={openNCRs > 0 ? 'Action required' : 'None'}
          target={{ value: 0, comparison: 'equal' }}
          href="/dashboard/ncr"
          className="lg:col-span-2"
        />
      </div>
    </div>
  );
}
