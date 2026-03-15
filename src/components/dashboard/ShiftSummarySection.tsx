import { prisma } from '@/lib/db/prisma';
import { Icons } from '@/components/icons';

export async function ShiftSummarySection() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    activeWorkOrders,
    downtimeIntervals,
    qualityResults,
    materialLots,
    consumptions,
  ] = await Promise.all([
    prisma.workOrder.count({
      where: { status: { in: ['released', 'in_progress'] } },
    }),
    prisma.downtimeInterval.findMany({
      where: { startedAt: { gte: today }, endedAt: { not: null } },
    }),
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: today } },
    }),
    prisma.materialLot.findMany({
      where: { qtyRemaining: { gt: 0 } },
    }),
    prisma.unitMaterialConsumption.groupBy({
      by: ['materialLotId'],
      where: { timestamp: { gte: yesterday } },
      _sum: { qtyConsumed: true },
    }),
  ]);

  const downtimeMinutesToday = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  const passCount = qualityResults.filter((q) => q.result === 'pass').length;
  const failCount = qualityResults.filter((q) => q.result === 'fail').length;

  const consumptionMap = new Map(
    consumptions.map((c) => [c.materialLotId, c._sum.qtyConsumed ?? 0])
  );

  let criticalMaterialCount = 0;
  let lowMaterialCount = 0;
  const materialMap = new Map<string, { qtyRemaining: number; consumption24h: number }>();
  materialLots.forEach((lot) => {
    const existing = materialMap.get(lot.materialCode) || { qtyRemaining: 0, consumption24h: 0 };
    materialMap.set(lot.materialCode, {
      qtyRemaining: existing.qtyRemaining + lot.qtyRemaining,
      consumption24h: existing.consumption24h + (consumptionMap.get(lot.id) || 0),
    });
  });
  materialMap.forEach((material) => {
    const consumptionRate = material.consumption24h / 24;
    const runwayHours = consumptionRate > 0 ? material.qtyRemaining / consumptionRate : null;
    if (runwayHours !== null) {
      if (runwayHours < 4) criticalMaterialCount++;
      else if (runwayHours < 12) lowMaterialCount++;
    }
  });

  return (
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
          <span className={`font-mono font-semibold ${downtimeMinutesToday > 30 ? 'text-amber-600' : 'text-gray-900'}`}>
            {downtimeMinutesToday} min
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icons.gauge className="h-4 w-4" />
            <span>Quality Checks</span>
          </div>
          <span className="font-mono font-semibold text-gray-900">{passCount + failCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icons.station className="h-4 w-4" />
            <span>Active Work Orders</span>
          </div>
          <span className="font-mono font-semibold text-gray-900">{activeWorkOrders}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icons.material className="h-4 w-4" />
            <span>Material Issues</span>
          </div>
          <span className={`font-mono font-semibold ${
            criticalMaterialCount > 0 ? 'text-red-600' :
            lowMaterialCount > 0 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {criticalMaterialCount + lowMaterialCount}
          </span>
        </div>
      </div>
    </div>
  );
}
