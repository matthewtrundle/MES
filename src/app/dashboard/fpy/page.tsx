import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { FPYDashboard } from '@/components/supervisor/FPYDashboard';
import { getOverallFPY, getFPYByStation } from '@/lib/actions/fpy-analytics';

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
                <div className="rounded-lg bg-emerald-100 p-2">
                  <Icons.pass className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">First-Pass Yield Analysis</h1>
                  <p className="text-sm text-gray-500">FPY metrics by station, step, and trend</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={30} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero FPY Card */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Overall First-Pass Yield</h2>
              <p className="text-sm text-gray-500 mt-1">
                Units passing first attempt without rework (last 30 days)
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
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
              <p className="text-sm text-gray-500 mt-1">
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
