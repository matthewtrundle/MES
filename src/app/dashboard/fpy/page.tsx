import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { FPYDashboard } from '@/components/supervisor/FPYDashboard';
import { getOverallFPY, getFPYByStation } from '@/lib/actions/fpy-analytics';

export const revalidate = 60;

async function getFPYSummary() {
  try {
    const [overall, byStation] = await Promise.all([
      getOverallFPY(30),
      getFPYByStation(30),
    ]);

    const belowTarget = byStation.filter((s) => s.fpy < 95).length;
    const critical = byStation.filter((s) => s.fpy < 90).length;

    return {
      overallFPY: overall.fpy,
      totalFirstPass: overall.totalFirstPass,
      passedFirstPass: overall.passedFirstPass,
      stationCount: byStation.length,
      belowTarget,
      critical,
    };
  } catch {
    return {
      overallFPY: 100,
      totalFirstPass: 0,
      passedFirstPass: 0,
      stationCount: 0,
      belowTarget: 0,
      critical: 0,
    };
  }
}

export default async function FPYPage() {
  const summary = await getFPYSummary();

  const fpyColor =
    summary.overallFPY >= 95
      ? 'text-green-600'
      : summary.overallFPY >= 90
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="First-Pass Yield Analysis" subtitle="FPY metrics by station, step, and trend">
        <AutoRefresh intervalSeconds={30} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero FPY Card */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Overall First-Pass Yield</h2>
              <p className="text-sm text-slate-500 mt-1">
                Units passing first attempt without rework (last 30 days)
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                <span>{summary.stationCount} stations monitored</span>
                {summary.belowTarget > 0 && (
                  <span className="text-amber-600 font-medium">
                    {summary.belowTarget} below 95% target
                  </span>
                )}
                {summary.critical > 0 && (
                  <span className="text-red-600 font-medium">
                    {summary.critical} critical (&lt;90%)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-5xl font-bold ${fpyColor}`}>
                {summary.overallFPY}%
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {summary.passedFirstPass} of {summary.totalFirstPass} first attempts
              </p>
            </div>
          </div>
        </div>

        {/* Interactive FPY Dashboard */}
        <FPYDashboard />
      </main>
    </div>
  );
}
