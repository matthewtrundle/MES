import { prisma } from '@/lib/db/prisma';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DowntimeParetoChart } from '@/components/supervisor/DowntimeParetoChart';
import { DowntimeTable } from '@/components/supervisor/DowntimeTable';

export const revalidate = 30;

interface DowntimeStats {
  reasonCode: string;
  reasonDescription: string;
  isPlanned: boolean;
  lossType: string;
  totalMinutes: number;
  count: number;
}

async function getDowntimeData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get completed downtime intervals from the last 7 days
  const intervals = await prisma.downtimeInterval.findMany({
    where: {
      startedAt: { gte: sevenDaysAgo },
      endedAt: { not: null },
      reasonId: { not: null },
    },
    include: {
      reason: true,
      station: true,
      operator: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  // Calculate Pareto stats
  const statsMap = new Map<string, DowntimeStats>();

  intervals.forEach((interval) => {
    if (!interval.reason || !interval.endedAt) return;

    const minutes = Math.round(
      (new Date(interval.endedAt).getTime() -
        new Date(interval.startedAt).getTime()) /
        60000
    );

    const key = interval.reason.id;
    const existing = statsMap.get(key);

    if (existing) {
      existing.totalMinutes += minutes;
      existing.count += 1;
    } else {
      statsMap.set(key, {
        reasonCode: interval.reason.code,
        reasonDescription: interval.reason.description,
        isPlanned: interval.reason.isPlanned,
        lossType: interval.reason.lossType,
        totalMinutes: minutes,
        count: 1,
      });
    }
  });

  // Sort by total minutes descending
  const paretoData = Array.from(statsMap.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );

  // Get active downtime
  const activeDowntime = await prisma.downtimeInterval.findMany({
    where: { endedAt: null },
    include: {
      reason: true,
      station: true,
      operator: true,
    },
  });

  return {
    paretoData,
    recentIntervals: intervals.slice(0, 20),
    activeDowntime,
  };
}

export default async function DowntimePage() {
  const { paretoData, recentIntervals, activeDowntime } =
    await getDowntimeData();

  const totalMinutes = paretoData.reduce((sum, d) => sum + d.totalMinutes, 0);
  const plannedMinutes = paretoData
    .filter((d) => d.isPlanned)
    .reduce((sum, d) => sum + d.totalMinutes, 0);
  const unplannedMinutes = totalMinutes - plannedMinutes;

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Downtime Analysis" subtitle="Last 7 days" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total Downtime</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{totalMinutes} min</p>
            <p className="text-sm text-slate-500">{Math.round(totalMinutes / 60)} hours</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Planned</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">{plannedMinutes} min</p>
            <p className="text-sm text-slate-500">{totalMinutes > 0 ? Math.round((plannedMinutes / totalMinutes) * 100) : 0}% of total</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Unplanned</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{unplannedMinutes} min</p>
            <p className="text-sm text-slate-500">{totalMinutes > 0 ? Math.round((unplannedMinutes / totalMinutes) * 100) : 0}% of total</p>
          </div>
        </div>

        {/* Active Downtime Alert */}
        {activeDowntime.length > 0 && (
          <div className="mb-6 rounded-lg border-2 border-yellow-400 bg-yellow-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-yellow-400">
              <h3 className="font-semibold text-yellow-800">
                Active Downtime ({activeDowntime.length})
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {activeDowntime.map((dt) => {
                  const elapsedMinutes = Math.round(
                    (Date.now() - new Date(dt.startedAt).getTime()) / 60000
                  );
                  return (
                    <div
                      key={dt.id}
                      className="flex items-center justify-between rounded bg-white p-3"
                    >
                      <div>
                        <span className="font-medium">{dt.station.name}</span>
                        <span className="ml-2 text-slate-600">
                          {dt.reason?.code ?? 'No reason'} -{' '}
                          {dt.reason?.description ?? 'Awaiting selection'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-yellow-700">
                          {elapsedMinutes} min
                        </span>
                        <p className="text-xs text-slate-500">
                          Started by {dt.operator.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pareto Chart + Breakdown */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Pareto Analysis</h3>
            </div>
            <div className="p-4">
              <DowntimeParetoChart data={paretoData} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Downtime by Reason</h3>
            </div>
            <div className="p-4">
              {paretoData.length === 0 ? (
                <p className="py-8 text-center text-slate-500">
                  No downtime recorded in the last 7 days
                </p>
              ) : (
                <div className="space-y-2">
                  {paretoData.map((item, idx) => {
                    const percentage =
                      totalMinutes > 0
                        ? Math.round((item.totalMinutes / totalMinutes) * 100)
                        : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {item.reasonCode}
                            <span className="ml-1 text-slate-500">
                              ({item.count}x)
                            </span>
                          </span>
                          <span>
                            {item.totalMinutes} min ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-slate-200">
                          <div
                            className={`h-full ${item.isPlanned ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Downtime Table */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Recent Downtime Events</h3>
          </div>
          <div className="p-4">
            <DowntimeTable intervals={recentIntervals} />
          </div>
        </div>
      </main>
    </div>
  );
}
