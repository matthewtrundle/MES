import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { InventoryCard, InventorySummary } from '@/components/supervisor/InventoryCard';

async function getInventoryData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get 24 hours ago for consumption rate calculation
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [materialLots, consumptionLast24h, consumptionByHour] = await Promise.all([
    // All material lots with remaining quantity
    prisma.materialLot.findMany({
      where: {
        qtyRemaining: { gt: 0 },
      },
      orderBy: { materialCode: 'asc' },
    }),

    // Consumption in last 24 hours grouped by material
    prisma.unitMaterialConsumption.groupBy({
      by: ['materialLotId'],
      where: {
        timestamp: { gte: yesterday },
      },
      _sum: {
        qtyConsumed: true,
      },
    }),

    // Hourly consumption for trend (last 8 hours)
    prisma.unitMaterialConsumption.findMany({
      where: {
        timestamp: { gte: new Date(today.getTime() - 8 * 60 * 60 * 1000) },
      },
      select: {
        timestamp: true,
        qtyConsumed: true,
        materialLotId: true,
      },
      orderBy: { timestamp: 'asc' },
    }),
  ]);

  // Build consumption map by lot ID
  const consumptionMap = new Map(
    consumptionLast24h.map((c) => [c.materialLotId, c._sum.qtyConsumed ?? 0])
  );

  // Build lot ID to material code map
  const lotCodeMap = new Map(
    materialLots.map((lot) => [lot.id, lot.materialCode])
  );

  // Group by material code to aggregate multiple lots
  const materialMap = new Map<
    string,
    {
      materialCode: string;
      description: string;
      qtyRemaining: number;
      qtyReceived: number;
      lotCount: number;
      consumption24h: number;
      lotIds: string[];
    }
  >();

  materialLots.forEach((lot) => {
    const existing = materialMap.get(lot.materialCode);
    const lotConsumption = consumptionMap.get(lot.id) ?? 0;

    if (existing) {
      existing.qtyRemaining += lot.qtyRemaining;
      existing.qtyReceived += lot.qtyReceived;
      existing.lotCount += 1;
      existing.consumption24h += lotConsumption;
      existing.lotIds.push(lot.id);
    } else {
      materialMap.set(lot.materialCode, {
        materialCode: lot.materialCode,
        description: lot.description ?? lot.materialCode,
        qtyRemaining: lot.qtyRemaining,
        qtyReceived: lot.qtyReceived,
        lotCount: 1,
        consumption24h: lotConsumption,
        lotIds: [lot.id],
      });
    }
  });

  // Calculate consumption rate and runway
  const materials = Array.from(materialMap.values()).map((material) => {
    const consumptionRate = material.consumption24h / 24; // per hour
    const runwayHours = consumptionRate > 0
      ? material.qtyRemaining / consumptionRate
      : null;

    // Determine status based on runway hours
    let status: 'good' | 'low' | 'critical' = 'good';
    if (runwayHours !== null) {
      if (runwayHours < 4) {
        status = 'critical';
      } else if (runwayHours < 12) {
        status = 'low';
      }
    }

    // Also check percentage remaining
    const percentRemaining = (material.qtyRemaining / material.qtyReceived) * 100;
    if (percentRemaining < 10) {
      status = 'critical';
    } else if (percentRemaining < 25 && status === 'good') {
      status = 'low';
    }

    return {
      ...material,
      consumptionRate,
      runwayHours,
      status,
    };
  });

  // Sort by status (critical first, then low, then good)
  materials.sort((a, b) => {
    const statusOrder = { critical: 0, low: 1, good: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Calculate hourly consumption trends by material code
  const hourlyConsumption = new Map<string, number[]>();
  const hours = 8;

  for (let i = 0; i < hours; i++) {
    const hourStart = new Date(today.getTime() - (hours - i) * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    consumptionByHour
      .filter((c) => {
        const timestamp = new Date(c.timestamp);
        return timestamp >= hourStart && timestamp < hourEnd;
      })
      .forEach((c) => {
        const materialCode = lotCodeMap.get(c.materialLotId);
        if (materialCode) {
          const existing = hourlyConsumption.get(materialCode) ?? new Array(hours).fill(0);
          existing[i] += c.qtyConsumed;
          hourlyConsumption.set(materialCode, existing);
        }
      });
  }

  // Calculate summary stats
  const totalMaterials = materials.length;
  const lowStockCount = materials.filter((m) => m.status === 'low').length;
  const criticalCount = materials.filter((m) => m.status === 'critical').length;
  const avgRunwayHours =
    materials.reduce((sum, m) => sum + (m.runwayHours ?? 0), 0) /
    Math.max(materials.filter((m) => m.runwayHours !== null).length, 1);

  // Generate hour labels
  const hourLabels = Array.from({ length: hours }, (_, i) => {
    const hour = new Date(today.getTime() - (hours - 1 - i) * 60 * 60 * 1000);
    return `${hour.getHours()}:00`;
  });

  return {
    materials,
    hourlyConsumption,
    hourLabels,
    summary: {
      totalMaterials,
      lowStockCount,
      criticalCount,
      avgRunwayHours,
    },
  };
}

export default async function InventoryPage() {
  const data = await getInventoryData();

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
                <div className="rounded-lg bg-purple-100 p-2">
                  <Icons.chart className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Inventory Tracking</h1>
                  <p className="text-sm text-gray-500">Material levels and consumption</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={30} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <InventorySummary
          totalMaterials={data.summary.totalMaterials}
          lowStockCount={data.summary.lowStockCount}
          criticalCount={data.summary.criticalCount}
          avgRunwayHours={data.summary.avgRunwayHours}
        />

        {/* Critical Alerts */}
        {data.summary.criticalCount > 0 && (
          <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Icons.warning className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">
                  Critical Stock Alert
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {data.summary.criticalCount} material(s) have critically low stock levels.
                  Review and reorder immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Warning */}
        {data.summary.lowStockCount > 0 && data.summary.criticalCount === 0 && (
          <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Icons.warning className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-800">
                  Low Stock Warning
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {data.summary.lowStockCount} material(s) are running low.
                  Consider reordering soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Grid */}
        {data.materials.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Icons.chart className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No materials in inventory</p>
            <p className="text-sm text-gray-400">Material lots will appear here once added</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.materials.map((material) => (
              <InventoryCard
                key={material.materialCode}
                materialCode={material.materialCode}
                description={material.description}
                qtyRemaining={material.qtyRemaining}
                qtyReceived={material.qtyReceived}
                lotCount={material.lotCount}
                consumptionRate={material.consumptionRate}
                runwayHours={material.runwayHours}
                status={material.status}
              />
            ))}
          </div>
        )}

        {/* Consumption Trends Section */}
        {data.materials.length > 0 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">
                Consumption Rate (Last 8 Hours)
              </h3>
            </div>
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {data.materials.slice(0, 6).map((material) => {
                  const hourlyData = data.hourlyConsumption.get(material.materialCode) ?? [];
                  return (
                    <div
                      key={`trend-${material.materialCode}`}
                      className="rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {material.materialCode}
                        </span>
                        <span className="text-sm text-gray-500">
                          {material.consumptionRate.toFixed(1)}/hr
                        </span>
                      </div>
                      <div className="h-10">
                        {hourlyData.length > 0 ? (
                          <svg
                            viewBox="0 0 200 40"
                            preserveAspectRatio="none"
                            className="w-full h-full"
                          >
                            {(() => {
                              const max = Math.max(...hourlyData, 1);
                              const points = hourlyData.map((value, index) => {
                                const x = 4 + (index / Math.max(hourlyData.length - 1, 1)) * 192;
                                const y = 36 - (value / max) * 32;
                                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                              });
                              return (
                                <path
                                  d={points.join(' ')}
                                  fill="none"
                                  stroke="#8B9A82"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              );
                            })()}
                          </svg>
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-gray-400">
                            No consumption data
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>{data.hourLabels[0]}</span>
                        <span>{data.hourLabels[data.hourLabels.length - 1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-500">Good (&gt;12h runway)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-gray-500">Low (4-12h runway)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-gray-500">Critical (&lt;4h runway)</span>
          </div>
        </div>
      </main>
    </div>
  );
}
