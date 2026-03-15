import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';

export async function AlertsSidebar() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [openNCRs, materialLots, consumptions] = await Promise.all([
    prisma.nonconformanceRecord.findMany({
      where: { status: { in: ['open', 'dispositioned'] } },
      select: { severity: true },
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

  // NCR breakdown
  const ncrCount = openNCRs.length;
  const criticalNCRs = openNCRs.filter((n) => n.severity === 'critical').length;
  const majorNCRs = openNCRs.filter((n) => n.severity === 'major').length;

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

  let criticalMaterialCount = 0;
  let lowMaterialCount = 0;

  materialMap.forEach((material) => {
    const consumptionRate = material.consumption24h / 24;
    const runwayHours =
      consumptionRate > 0 ? material.qtyRemaining / consumptionRate : null;
    if (runwayHours !== null) {
      if (runwayHours < 4) criticalMaterialCount++;
      else if (runwayHours < 12) lowMaterialCount++;
    }
  });

  const hasAlerts =
    ncrCount > 0 || criticalMaterialCount > 0 || lowMaterialCount > 0;
  if (!hasAlerts) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <h3 className="text-section-title">Alerts</h3>
      </div>
      <div className="p-3 space-y-2">
        {/* NCR Alerts */}
        {ncrCount > 0 && (
          <Link
            href="/dashboard/ncr"
            className="flex items-center justify-between rounded-md border border-slate-200 p-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100">
                <Icons.qualityFail className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Open NCRs
                </p>
                <p className="text-[10px] text-slate-500">
                  {criticalNCRs > 0 && (
                    <span className="text-red-600 font-medium">
                      {criticalNCRs} critical
                    </span>
                  )}
                  {criticalNCRs > 0 && majorNCRs > 0 && ' · '}
                  {majorNCRs > 0 && (
                    <span className="text-amber-600 font-medium">
                      {majorNCRs} major
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span className="text-lg font-bold text-red-700">{ncrCount}</span>
          </Link>
        )}

        {/* Material Alerts */}
        {(criticalMaterialCount > 0 || lowMaterialCount > 0) && (
          <Link
            href="/dashboard/inventory"
            className="flex items-center justify-between rounded-md border border-slate-200 p-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100">
                <Icons.material className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Material Alerts
                </p>
                <p className="text-[10px] text-slate-500">
                  {criticalMaterialCount > 0 && (
                    <span className="text-red-600 font-medium">
                      {criticalMaterialCount} critical
                    </span>
                  )}
                  {criticalMaterialCount > 0 && lowMaterialCount > 0 && ' · '}
                  {lowMaterialCount > 0 && (
                    <span className="text-amber-600 font-medium">
                      {lowMaterialCount} low
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span className="text-lg font-bold text-amber-700">
              {criticalMaterialCount + lowMaterialCount}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
