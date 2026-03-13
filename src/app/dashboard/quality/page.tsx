import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import dynamic from 'next/dynamic';

const FPYTrendChart = dynamic(
  () => import('@/components/supervisor/FPYTrendChart').then(mod => mod.FPYTrendChart),
  { loading: () => <div className="h-[250px] animate-pulse rounded bg-gray-100" /> }
);
import { FPYStationCards } from '@/components/supervisor/FPYStationCards';

export const revalidate = 60;

async function getQualityData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [qualityResults, qualityDefs, ncrs, stationBreakdown] = await Promise.all([
    // All quality results today
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: today } },
      include: {
        unit: true,
        definition: true,
        operator: true,
      },
      orderBy: { timestamp: 'desc' },
    }),

    // Quality check definitions (stationIds is a string array, not a relation)
    prisma.qualityCheckDefinition.findMany(),

    // NCRs created today
    prisma.nonconformanceRecord.findMany({
      where: { createdAt: { gte: today } },
      include: { unit: true, station: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Station breakdown
    prisma.qualityCheckResult.groupBy({
      by: ['definitionId'],
      where: { timestamp: { gte: today } },
      _count: true,
    }),
  ]);

  const passCount = qualityResults.filter((r) => r.result === 'pass').length;
  const failCount = qualityResults.filter((r) => r.result === 'fail').length;
  const qualityRate = qualityResults.length > 0
    ? Math.round((passCount / qualityResults.length) * 100)
    : 100;

  // Calculate per-check stats
  const checkStats = qualityDefs.map((def) => {
    const results = qualityResults.filter((r) => r.definitionId === def.id);
    const passes = results.filter((r) => r.result === 'pass').length;
    const fails = results.filter((r) => r.result === 'fail').length;
    return {
      id: def.id,
      name: def.name,
      station: def.stationIds.length > 0 ? `${def.stationIds.length} station(s)` : 'All Stations',
      checkType: def.checkType,
      total: results.length,
      passes,
      fails,
      rate: results.length > 0 ? Math.round((passes / results.length) * 100) : 100,
    };
  });

  return {
    qualityResults,
    checkStats,
    ncrs,
    passCount,
    failCount,
    qualityRate,
  };
}

async function getFPYData() {
  // Get the first site (for demo)
  const site = await prisma.site.findFirst({ where: { active: true } });
  if (!site) return null;

  const stations = await prisma.station.findMany({
    where: { siteId: site.id, active: true },
    orderBy: { sequenceOrder: 'asc' },
  });

  // Get all completed executions
  const executions = await prisma.unitOperationExecution.findMany({
    where: {
      station: { siteId: site.id },
      completedAt: { not: null },
    },
    select: {
      stationId: true,
      isRework: true,
      result: true,
      completedAt: true,
    },
  });

  // Calculate overall FPY
  const completed = executions.filter((e) => e.result !== null);
  const firstAttempts = completed.filter((e) => !e.isRework);
  const firstPassCount = firstAttempts.filter((e) => e.result === 'pass').length;
  const overallFPY = firstAttempts.length > 0
    ? Math.round((firstPassCount / firstAttempts.length) * 1000) / 10
    : 100;

  // Calculate per-station FPY
  const byStation = new Map<string, { isRework: boolean; result: string | null }[]>();
  for (const exec of executions) {
    const list = byStation.get(exec.stationId) || [];
    list.push(exec);
    byStation.set(exec.stationId, list);
  }

  const stationFPYData = stations.map((station) => {
    const stationExecs = (byStation.get(station.id) || []).filter((e) => e.result !== null);
    const stationFirstAttempts = stationExecs.filter((e) => !e.isRework);
    const stationFirstPassCount = stationFirstAttempts.filter((e) => e.result === 'pass').length;
    const fpy = stationFirstAttempts.length > 0
      ? Math.round((stationFirstPassCount / stationFirstAttempts.length) * 1000) / 10
      : 100;

    return {
      stationId: station.id,
      stationName: station.name,
      stationType: station.stationType,
      sequenceOrder: station.sequenceOrder,
      fpy,
      totalAttempted: stationExecs.length,
      firstPassCount: stationFirstPassCount,
    };
  });

  // Calculate daily FPY trend (last 7 days)
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const trendPoints = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * msPerDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + msPerDay);

    const dayExecs = executions.filter((e) => {
      const t = e.completedAt!.getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime() && e.result !== null;
    });

    const dayFirstAttempts = dayExecs.filter((e) => !e.isRework);
    const dayFirstPass = dayFirstAttempts.filter((e) => e.result === 'pass').length;
    const dayFPY = dayFirstAttempts.length > 0
      ? Math.round((dayFirstPass / dayFirstAttempts.length) * 1000) / 10
      : 100;

    trendPoints.push({
      periodStart: dayStart.toISOString(),
      periodLabel: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fpy: dayFPY,
      totalAttempted: dayExecs.length,
      firstPassCount: dayFirstPass,
    });
  }

  return {
    overallFPY,
    totalFirstAttempts: firstAttempts.length,
    totalFirstPassCount: firstPassCount,
    stationFPYData,
    trendPoints,
  };
}

export default async function QualityPage() {
  const [data, fpyData] = await Promise.all([
    getQualityData(),
    getFPYData(),
  ]);

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
                <div className="rounded-lg bg-blue-100 p-2">
                  <Icons.gauge className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Quality Metrics</h1>
                  <p className="text-sm text-gray-500">Quality check results, FPY, and trends</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={15} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Quality Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Quality Rate</p>
            <p
              className={`text-4xl font-bold ${
                data.qualityRate < 95 ? 'text-amber-600' : 'text-green-600'
              }`}
            >
              {data.qualityRate}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Total Checks</p>
            <p className="text-4xl font-bold text-gray-900">
              {data.passCount + data.failCount}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">Passed</p>
            <p className="text-4xl font-bold text-green-600">{data.passCount}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Failed</p>
            <p className="text-4xl font-bold text-red-600">{data.failCount}</p>
          </div>
        </div>

        {/* FPY Section */}
        {fpyData && (
          <>
            {/* FPY Summary */}
            <div className="mb-6 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">First-Pass Yield (FPY)</h2>
                  <p className="text-sm text-gray-500">
                    Units passing first time without rework
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-5xl font-bold ${
                      fpyData.overallFPY >= 95
                        ? 'text-green-600'
                        : fpyData.overallFPY >= 90
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {fpyData.overallFPY}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {fpyData.totalFirstPassCount} of {fpyData.totalFirstAttempts} first attempts
                  </p>
                </div>
              </div>
            </div>

            {/* FPY Trend Chart */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">FPY Trend (Last 7 Days)</h3>
              <FPYTrendChart data={fpyData.trendPoints} height={250} />
            </div>

            {/* FPY by Station */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">FPY by Station</h3>
              <FPYStationCards stations={fpyData.stationFPYData} />
            </div>
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Check Type Breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Quality Checks by Type</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {data.checkStats.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.gauge className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2">No quality checks recorded today</p>
                </div>
              ) : (
                data.checkStats.map((check) => (
                  <div key={check.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{check.name}</p>
                        <p className="text-sm text-gray-500">
                          {check.station} - {check.checkType}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            check.rate < 90 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {check.rate}%
                        </span>
                        <p className="text-xs text-gray-500">
                          {check.passes} pass / {check.fails} fail
                        </p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full ${
                          check.rate < 90 ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${check.rate}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Quality Events */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Recent Quality Events</h3>
            </div>
            <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {data.qualityResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.search className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2">No quality checks recorded today</p>
                </div>
              ) : (
                data.qualityResults.slice(0, 15).map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-1.5 ${
                          result.result === 'pass' ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        {result.result === 'pass' ? (
                          <Icons.pass className="h-4 w-4 text-green-600" />
                        ) : (
                          <Icons.qualityFail className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {result.unit.serialNumber}
                        </p>
                        <p className="text-sm text-gray-500">{result.definition.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          result.result === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {result.result}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* NCRs Created Today */}
          <div className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                NCRs Created Today ({data.ncrs.length})
              </h3>
              <Link
                href="/dashboard/ncr"
                className="text-sm text-blue-600 hover:underline"
              >
                View All NCRs
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {data.ncrs.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Icons.pass className="mx-auto h-8 w-8 text-green-300" />
                  <p className="mt-2 text-green-600">No NCRs today - great quality!</p>
                </div>
              ) : (
                data.ncrs.map((ncr) => (
                  <div
                    key={ncr.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {ncr.unit?.serialNumber ?? 'IQC NCR'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {ncr.defectType} at {ncr.station?.name}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        ncr.status === 'open'
                          ? 'bg-red-100 text-red-700'
                          : ncr.status === 'closed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {ncr.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
