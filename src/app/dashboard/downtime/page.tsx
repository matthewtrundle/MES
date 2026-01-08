import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { DowntimeParetoChart } from '@/components/supervisor/DowntimeParetoChart';
import { DowntimeTable } from '@/components/supervisor/DowntimeTable';

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
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Downtime Analysis</h1>
          <p className="text-gray-600">Last 7 days</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Downtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalMinutes} min</p>
            <p className="text-sm text-gray-500">
              {Math.round(totalMinutes / 60)} hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Planned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {plannedMinutes} min
            </p>
            <p className="text-sm text-gray-500">
              {totalMinutes > 0
                ? Math.round((plannedMinutes / totalMinutes) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Unplanned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {unplannedMinutes} min
            </p>
            <p className="text-sm text-gray-500">
              {totalMinutes > 0
                ? Math.round((unplannedMinutes / totalMinutes) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Downtime Alert */}
      {activeDowntime.length > 0 && (
        <Card className="mb-6 border-2 border-yellow-400 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-yellow-800">
              Active Downtime ({activeDowntime.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                      <span className="ml-2 text-gray-600">
                        {dt.reason?.code ?? 'No reason'} -{' '}
                        {dt.reason?.description ?? 'Awaiting selection'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-yellow-700">
                        {elapsedMinutes} min
                      </span>
                      <p className="text-xs text-gray-500">
                        Started by {dt.operator.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pareto Chart */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pareto Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <DowntimeParetoChart data={paretoData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Downtime by Reason</CardTitle>
          </CardHeader>
          <CardContent>
            {paretoData.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
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
                          <span className="ml-1 text-gray-500">
                            ({item.count}x)
                          </span>
                        </span>
                        <span>
                          {item.totalMinutes} min ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-gray-200">
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
          </CardContent>
        </Card>
      </div>

      {/* Recent Downtime Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Downtime Events</CardTitle>
        </CardHeader>
        <CardContent>
          <DowntimeTable intervals={recentIntervals} />
        </CardContent>
      </Card>
    </div>
  );
}
