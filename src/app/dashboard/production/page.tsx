import { prisma } from '@/lib/db/prisma';
import { UnitStatusBadge } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 30;

async function getProductionData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [completedUnitsToday, allCompletedUnits, allUnitsToday, workOrders, inProgressUnits] = await Promise.all([
    // Completed units today
    prisma.unit.findMany({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
      include: { workOrder: true },
      orderBy: { updatedAt: 'desc' },
    }),

    // All completed units ever (for total count)
    prisma.unit.findMany({
      where: { status: 'completed' },
      include: { workOrder: true },
      orderBy: { updatedAt: 'desc' },
      take: 20, // Recent completions
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

    // In-progress units count
    prisma.unit.count({
      where: { status: 'in_progress' },
    }),
  ]);

  // Get total completed count
  const totalCompletedCount = await prisma.unit.count({
    where: { status: 'completed' },
  });

  // Calculate hourly stats
  const hourlyStats: { hour: number; count: number }[] = [];
  for (let h = 0; h <= new Date().getHours(); h++) {
    const count = completedUnitsToday.filter((u) => {
      const hour = new Date(u.updatedAt).getHours();
      return hour === h;
    }).length;
    hourlyStats.push({ hour: h, count });
  }

  // Use the larger of today's completed or work order qtyCompleted (in case timestamps are off)
  const workOrdersCompleted = workOrders.reduce((sum, wo) => sum + wo.qtyCompleted, 0);

  return {
    completedUnitsToday,
    allCompletedUnits,
    allUnitsToday,
    workOrders,
    hourlyStats,
    target: 10, // Daily target
    completedTodayCount: completedUnitsToday.length,
    totalCompletedCount,
    workOrdersCompleted,
    inProgressCount: inProgressUnits,
  };
}

export default async function ProductionPage() {
  const data = await getProductionData();
  const progressPercent = Math.min(100, (data.completedTodayCount / data.target) * 100);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Production Output" subtitle="Today's completed units">
        <AutoRefresh intervalSeconds={15} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Progress to Target */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Daily Progress</h2>
              <p className="text-sm text-slate-500">Target: {data.target} units</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-green-600">{data.completedTodayCount}</p>
              <p className="text-sm text-slate-500">completed</p>
            </div>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${
                progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-600 text-center">
            {progressPercent >= 100
              ? 'Target achieved!'
              : `${data.target - data.completedTodayCount} more to reach target`}
          </p>
        </div>

        {/* Hourly Breakdown Chart */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Hourly Output</h2>
          <div className="flex items-end gap-2 h-32">
            {data.hourlyStats.map((stat) => {
              const maxCount = Math.max(...data.hourlyStats.map((s) => s.count), 1);
              const height = (stat.count / maxCount) * 100;
              return (
                <div key={stat.hour} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t ${
                      stat.count > 0 ? 'bg-green-500' : 'bg-slate-200'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-xs text-slate-500 mt-1">
                    {stat.hour.toString().padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Completed Units List */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">
                Completed Today ({data.completedUnitsToday.length})
              </h3>
            </div>
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {data.completedUnitsToday.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500">
                  <p className="mt-2">No units completed yet today</p>
                  <p className="text-xs text-slate-400">Start the simulation to see production</p>
                </div>
              ) : (
                data.completedUnitsToday.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-mono font-medium text-slate-900">
                        {unit.serialNumber}
                      </p>
                      <p className="text-sm text-slate-500">
                        {unit.workOrder.productCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <UnitStatusBadge status="completed" />
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(unit.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Work Order Progress */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Work Order Status</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.workOrders.map((wo) => {
                const progress = Math.round((wo.qtyCompleted / wo.qtyOrdered) * 100);
                return (
                  <div key={wo.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-900">{wo.orderNumber}</p>
                        <p className="text-sm text-slate-500">{wo.productName}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-600">
                        {wo.qtyCompleted} / {wo.qtyOrdered}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
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
