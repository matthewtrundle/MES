import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { ParetoChart } from '@/components/supervisor/ParetoChart';
import { toParetoData } from '@/lib/utils/pareto';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

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
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Pareto Analysis" subtitle="80/20 root cause analysis">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
            {[1, 7, 30].map((d) => (
              <Link
                key={d}
                href={`/dashboard/analytics?days=${d}`}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {d === 1 ? 'Today' : `${d} Days`}
              </Link>
            ))}
          </div>
          <AutoRefresh intervalSeconds={60} />
        </div>
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Inline Summary Stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mb-6">
          <span>Period <span className="ml-1 font-semibold text-slate-900">{days === 1 ? 'Today' : `${days} Days`}</span></span>
          <span>Total Downtime <span className="ml-1 font-semibold text-amber-600">{data.summary.totalDowntimeMinutes} min</span></span>
          <span>NCRs Created <span className="ml-1 font-semibold text-red-600">{data.summary.totalNCRs}</span></span>
          <span>Quality Rate <span className="ml-1 font-semibold text-green-600">{data.summary.qualityRate}%</span></span>
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
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900 mb-3">About Pareto Analysis</h3>
          <div className="text-sm text-slate-600 space-y-2">
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
              &quot;vital few&quot; (top 80%) and should be prioritized for improvement.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
