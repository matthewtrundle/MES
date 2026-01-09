import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons, UnitStatusBadge } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';

async function getProductionData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [completedUnits, allUnitsToday, workOrders, hourlyBreakdown] = await Promise.all([
    // Completed units today
    prisma.unit.findMany({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
      include: { workOrder: true },
      orderBy: { updatedAt: 'desc' },
    }),

    // All units created today
    prisma.unit.findMany({
      where: {
        createdAt: { gte: today },
      },
      include: { workOrder: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Active work orders with completion stats
    prisma.workOrder.findMany({
      where: { status: { in: ['released', 'in_progress'] } },
      orderBy: { priority: 'desc' },
    }),

    // Hourly completion breakdown
    prisma.unit.groupBy({
      by: ['updatedAt'],
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
      _count: true,
    }),
  ]);

  // Calculate hourly stats
  const hourlyStats: { hour: number; count: number }[] = [];
  for (let h = 0; h <= new Date().getHours(); h++) {
    const count = completedUnits.filter((u) => {
      const hour = new Date(u.updatedAt).getHours();
      return hour === h;
    }).length;
    hourlyStats.push({ hour: h, count });
  }

  return {
    completedUnits,
    allUnitsToday,
    workOrders,
    hourlyStats,
    target: 10, // Daily target
    completedCount: completedUnits.length,
  };
}

export default async function ProductionPage() {
  const data = await getProductionData();
  const progressPercent = Math.min(100, (data.completedCount / data.target) * 100);

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
                <div className="rounded-lg bg-green-100 p-2">
                  <Icons.pass className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Production Output
                  </h1>
                  <p className="text-sm text-gray-500">Today&apos;s completed units</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={15} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Progress to Target */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Daily Progress</h2>
              <p className="text-sm text-gray-500">Target: {data.target} units</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-green-600">{data.completedCount}</p>
              <p className="text-sm text-gray-500">completed</p>
            </div>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all ${
                progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600 text-center">
            {progressPercent >= 100
              ? 'Target achieved!'
              : `${data.target - data.completedCount} more to reach target`}
          </p>
        </div>

        {/* Hourly Breakdown Chart */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hourly Output</h2>
          <div className="flex items-end gap-2 h-32">
            {data.hourlyStats.map((stat) => {
              const maxCount = Math.max(...data.hourlyStats.map((s) => s.count), 1);
              const height = (stat.count / maxCount) * 100;
              return (
                <div key={stat.hour} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t ${
                      stat.count > 0 ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-xs text-gray-500 mt-1">
                    {stat.hour.toString().padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Completed Units List */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">
                Completed Today ({data.completedUnits.length})
              </h3>
            </div>
            <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {data.completedUnits.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.unit className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2">No units completed yet today</p>
                  <p className="text-xs text-gray-400">Start the simulation to see production</p>
                </div>
              ) : (
                data.completedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-mono font-medium text-gray-900">
                        {unit.serialNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {unit.workOrder.productCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <UnitStatusBadge status="completed" />
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(unit.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Work Order Progress */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Work Order Status</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {data.workOrders.map((wo) => {
                const progress = Math.round((wo.qtyCompleted / wo.qtyOrdered) * 100);
                return (
                  <div key={wo.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{wo.orderNumber}</p>
                        <p className="text-sm text-gray-500">{wo.productName}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {wo.qtyCompleted} / {wo.qtyOrdered}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
