import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { ParetoChart, toParetoData } from '@/components/supervisor/ParetoChart';

interface SearchParams {
  days?: string;
}

async function getAnalyticsData(days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const [
    downtimeIntervals,
    ncrs,
    operationExecutions,
    qualityResults,
  ] = await Promise.all([
    // Downtime intervals
    prisma.downtimeInterval.findMany({
      where: {
        startedAt: { gte: startDate },
        endedAt: { not: null },
      },
      include: {
        reason: true,
        station: true,
      },
    }),

    // NCRs
    prisma.nonconformanceRecord.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        station: true,
      },
    }),

    // Operation executions by station
    prisma.unitOperationExecution.findMany({
      where: {
        completedAt: { gte: startDate },
      },
      include: {
        station: true,
      },
    }),

    // Quality results
    prisma.qualityCheckResult.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      include: {
        definition: true,
      },
    }),
  ]);

  // Downtime by reason (Pareto)
  const downtimeByReason = new Map<string, number>();
  downtimeIntervals.forEach((dt) => {
    if (dt.reason && dt.endedAt) {
      const reason = dt.reason.description;
      const minutes = Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
      downtimeByReason.set(reason, (downtimeByReason.get(reason) ?? 0) + minutes);
    }
  });

  const downtimePareto = toParetoData(
    Array.from(downtimeByReason.entries()).map(([label, value]) => ({ label, value }))
  );

  // Downtime by station
  const downtimeByStation = new Map<string, number>();
  downtimeIntervals.forEach((dt) => {
    if (dt.endedAt) {
      const station = dt.station.name;
      const minutes = Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
      downtimeByStation.set(station, (downtimeByStation.get(station) ?? 0) + minutes);
    }
  });

  const downtimeByStationPareto = toParetoData(
    Array.from(downtimeByStation.entries()).map(([label, value]) => ({ label, value }))
  );

  // NCRs by defect type
  const ncrsByDefect = new Map<string, number>();
  ncrs.forEach((ncr) => {
    const defect = ncr.defectType;
    ncrsByDefect.set(defect, (ncrsByDefect.get(defect) ?? 0) + 1);
  });

  const ncrPareto = toParetoData(
    Array.from(ncrsByDefect.entries()).map(([label, value]) => ({ label, value }))
  );

  // NCRs by station
  const ncrsByStation = new Map<string, number>();
  ncrs.forEach((ncr) => {
    if (ncr.station) {
      const station = ncr.station.name;
      ncrsByStation.set(station, (ncrsByStation.get(station) ?? 0) + 1);
    }
  });

  const ncrByStationPareto = toParetoData(
    Array.from(ncrsByStation.entries()).map(([label, value]) => ({ label, value }))
  );

  // Station cycle time (operations completed)
  const stationCycleTimes = new Map<string, number[]>();
  operationExecutions.forEach((exec) => {
    if (exec.completedAt) {
      const station = exec.station.name;
      const cycleTime = Math.round(
        (exec.completedAt.getTime() - new Date(exec.startedAt).getTime()) / 60000
      );
      if (!stationCycleTimes.has(station)) {
        stationCycleTimes.set(station, []);
      }
      stationCycleTimes.get(station)!.push(cycleTime);
    }
  });

  const avgCycleTimeByStation = Array.from(stationCycleTimes.entries()).map(([station, times]) => ({
    label: station,
    value: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
  }));

  const cycleTimePareto = toParetoData(avgCycleTimeByStation);

  // Quality fails by check type
  const failsByCheck = new Map<string, number>();
  qualityResults.forEach((result) => {
    if (result.result === 'fail') {
      const check = result.definition.name;
      failsByCheck.set(check, (failsByCheck.get(check) ?? 0) + 1);
    }
  });

  const qualityFailPareto = toParetoData(
    Array.from(failsByCheck.entries()).map(([label, value]) => ({ label, value }))
  );

  // Summary stats
  const totalDowntimeMinutes = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  const totalNCRs = ncrs.length;
  const totalQualityChecks = qualityResults.length;
  const qualityFailCount = qualityResults.filter((r) => r.result === 'fail').length;
  const qualityRate = totalQualityChecks > 0
    ? Math.round((1 - qualityFailCount / totalQualityChecks) * 100)
    : 100;

  return {
    downtimePareto,
    downtimeByStationPareto,
    ncrPareto,
    ncrByStationPareto,
    cycleTimePareto,
    qualityFailPareto,
    summary: {
      totalDowntimeMinutes,
      totalNCRs,
      totalQualityChecks,
      qualityRate,
      days,
    },
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const days = parseInt(params.days ?? '7', 10);
  const data = await getAnalyticsData(days);

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
                <div className="rounded-lg bg-orange-100 p-2">
                  <Icons.chart className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Pareto Analysis</h1>
                  <p className="text-sm text-gray-500">80/20 root cause analysis</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Date Range Selector */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
                {[1, 7, 30].map((d) => (
                  <Link
                    key={d}
                    href={`/dashboard/analytics?days=${d}`}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      days === d
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {d === 1 ? 'Today' : `${d} Days`}
                  </Link>
                ))}
              </div>
              <AutoRefresh intervalSeconds={60} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Analysis Period</p>
            <p className="text-2xl font-bold text-gray-900">
              {days === 1 ? 'Today' : `${days} Days`}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Total Downtime</p>
            <p className="text-2xl font-bold text-amber-600">
              {data.summary.totalDowntimeMinutes} min
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">NCRs Created</p>
            <p className="text-2xl font-bold text-red-600">{data.summary.totalNCRs}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">Quality Rate</p>
            <p className="text-2xl font-bold text-green-600">{data.summary.qualityRate}%</p>
          </div>
        </div>

        {/* Pareto Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Downtime by Reason */}
          <ParetoChart
            data={data.downtimePareto}
            title="Downtime by Reason"
            valueLabel="min"
            color="amber"
          />

          {/* Downtime by Station */}
          <ParetoChart
            data={data.downtimeByStationPareto}
            title="Downtime by Station"
            valueLabel="min"
            color="amber"
          />

          {/* NCRs by Defect Type */}
          <ParetoChart
            data={data.ncrPareto}
            title="NCRs by Defect Type"
            valueLabel="NCRs"
            color="red"
          />

          {/* NCRs by Station */}
          <ParetoChart
            data={data.ncrByStationPareto}
            title="NCRs by Station"
            valueLabel="NCRs"
            color="red"
          />

          {/* Quality Failures by Check */}
          <ParetoChart
            data={data.qualityFailPareto}
            title="Quality Failures by Check Type"
            valueLabel="fails"
            color="red"
          />

          {/* Avg Cycle Time by Station */}
          <ParetoChart
            data={data.cycleTimePareto}
            title="Avg Cycle Time by Station (Bottlenecks)"
            valueLabel="min"
            color="blue"
          />
        </div>

        {/* Pareto Principle Explanation */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-3">About Pareto Analysis</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>The Pareto Principle (80/20 Rule)</strong> states that roughly 80% of effects
              come from 20% of causes. In manufacturing:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>80% of downtime comes from 20% of reasons</li>
              <li>80% of defects come from 20% of causes</li>
              <li>80% of quality issues come from 20% of processes</li>
            </ul>
            <p className="mt-3">
              Items marked with <span className="text-blue-500 font-medium">*</span> are in the
              "vital few" (top 80%) and should be prioritized for improvement.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
