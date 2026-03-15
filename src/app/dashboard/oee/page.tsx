import { prisma } from '@/lib/db/prisma';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { OEEGauge } from '@/components/supervisor/OEEGauge';
import { OEESparkline } from '@/components/supervisor/OEESparkline';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

async function getOEEData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get shift start (assume 8 hour shift started at 6am)
  const shiftStart = new Date(today);
  shiftStart.setHours(6, 0, 0, 0);
  const now = new Date();

  // Calculate planned production time (minutes since shift start)
  const plannedMinutes = Math.max(0, Math.round((now.getTime() - shiftStart.getTime()) / 60000));

  const [
    completedUnits,
    totalUnitsStarted,
    downtimeIntervals,
    qualityResults,
    hourlyData,
  ] = await Promise.all([
    // Completed units today
    prisma.unit.count({
      where: {
        status: 'completed',
        updatedAt: { gte: today },
      },
    }),

    // Total units started today
    prisma.unit.count({
      where: {
        createdAt: { gte: today },
      },
    }),

    // Downtime intervals today (completed ones)
    prisma.downtimeInterval.findMany({
      where: {
        startedAt: { gte: today },
        endedAt: { not: null },
      },
    }),

    // Quality check results today
    prisma.qualityCheckResult.findMany({
      where: {
        timestamp: { gte: today },
      },
    }),

    // Hourly breakdown for sparklines
    prisma.unit.findMany({
      where: {
        createdAt: { gte: shiftStart },
      },
      select: {
        createdAt: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  // Calculate downtime minutes
  const downtimeMinutes = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  // AVAILABILITY = (Planned Time - Downtime) / Planned Time
  const availableMinutes = Math.max(0, plannedMinutes - downtimeMinutes);
  const availability = plannedMinutes > 0 ? (availableMinutes / plannedMinutes) * 100 : 100;

  // PERFORMANCE = (Actual Output / Expected Output) based on cycle time
  // Assume ideal cycle time of 15 min per unit
  const idealCycleTime = 15; // minutes per unit
  const expectedUnits = Math.floor(availableMinutes / idealCycleTime);
  const performance = expectedUnits > 0 ? Math.min(100, (completedUnits / expectedUnits) * 100) : 100;

  // QUALITY = First Pass Yield (pass count / total checks)
  const passCount = qualityResults.filter((r) => r.result === 'pass').length;
  const totalChecks = qualityResults.length;
  const quality = totalChecks > 0 ? (passCount / totalChecks) * 100 : 100;

  // OEE = Availability x Performance x Quality
  const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

  // Calculate hourly trends for sparklines
  const hourlyTrends = calculateHourlyTrends(hourlyData, shiftStart, now);

  return {
    oee: Math.round(oee * 10) / 10,
    availability: Math.round(availability * 10) / 10,
    performance: Math.round(performance * 10) / 10,
    quality: Math.round(quality * 10) / 10,
    completedUnits,
    expectedUnits,
    plannedMinutes,
    downtimeMinutes,
    passCount,
    totalChecks,
    failCount: totalChecks - passCount,
    hourlyTrends,
  };
}

function calculateHourlyTrends(
  units: { createdAt: Date; status: string; updatedAt: Date }[],
  shiftStart: Date,
  now: Date
) {
  const hours: number[] = [];
  const completedByHour: number[] = [];

  // Generate hourly data points
  let currentHour = new Date(shiftStart);
  while (currentHour < now) {
    const hourEnd = new Date(currentHour.getTime() + 60 * 60 * 1000);
    const completed = units.filter(
      (u) =>
        u.status === 'completed' &&
        new Date(u.updatedAt) >= currentHour &&
        new Date(u.updatedAt) < hourEnd
    ).length;

    hours.push(currentHour.getHours());
    completedByHour.push(completed);
    currentHour = hourEnd;
  }

  return { hours, completedByHour };
}

export default async function OEEPage() {
  const data = await getOEEData();

  // Determine OEE status
  const getStatus = (value: number) => {
    if (value >= 85) return 'excellent';
    if (value >= 70) return 'good';
    if (value >= 50) return 'warning';
    return 'critical';
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="OEE Dashboard" subtitle="Overall Equipment Effectiveness">
        <AutoRefresh intervalSeconds={30} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Main OEE Gauge */}
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-8">
          <div className="flex flex-col items-center">
            <h2 className="mb-6 text-lg font-semibold text-slate-700">Overall Equipment Effectiveness</h2>
            <OEEGauge
              value={data.oee}
              size="xl"
              status={getStatus(data.oee)}
              showBenchmark
            />
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">World-Class Target:</span>
              <span className="font-semibold text-blue-600">85%</span>
            </div>
          </div>
        </div>

        {/* Three Component Gauges */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {/* Availability */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-col items-center">
              <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                Availability
              </h3>
              <OEEGauge
                value={data.availability}
                size="lg"
                status={getStatus(data.availability)}
                color="blue"
              />
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  {data.plannedMinutes - data.downtimeMinutes} min / {data.plannedMinutes} min
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Downtime: {data.downtimeMinutes} min
                </p>
              </div>
              <OEESparkline
                data={data.hourlyTrends.completedByHour}
                labels={data.hourlyTrends.hours.map((h) => `${h}:00`)}
                className="mt-4 h-12 w-full"
              />
            </div>
          </div>

          {/* Performance */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-col items-center">
              <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                Performance
              </h3>
              <OEEGauge
                value={data.performance}
                size="lg"
                status={getStatus(data.performance)}
                color="green"
              />
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  {data.completedUnits} units / {data.expectedUnits} expected
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Based on 15 min cycle time
                </p>
              </div>
              <OEESparkline
                data={data.hourlyTrends.completedByHour}
                labels={data.hourlyTrends.hours.map((h) => `${h}:00`)}
                className="mt-4 h-12 w-full"
              />
            </div>
          </div>

          {/* Quality */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-col items-center">
              <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                Quality
              </h3>
              <OEEGauge
                value={data.quality}
                size="lg"
                status={getStatus(data.quality)}
                color="purple"
              />
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  {data.passCount} pass / {data.totalChecks} total
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  First Pass Yield
                </p>
              </div>
              <OEESparkline
                data={data.hourlyTrends.completedByHour}
                labels={data.hourlyTrends.hours.map((h) => `${h}:00`)}
                className="mt-4 h-12 w-full"
              />
            </div>
          </div>
        </div>

        {/* OEE Formula Breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
            OEE Calculation
          </h3>
          <div className="flex items-center justify-center gap-4 text-lg">
            <div className="text-center">
              <span className="font-bold text-blue-600">{data.availability}%</span>
              <p className="text-xs text-slate-400">Availability</p>
            </div>
            <span className="text-slate-400">×</span>
            <div className="text-center">
              <span className="font-bold text-green-600">{data.performance}%</span>
              <p className="text-xs text-slate-400">Performance</p>
            </div>
            <span className="text-slate-400">×</span>
            <div className="text-center">
              <span className="font-bold text-purple-600">{data.quality}%</span>
              <p className="text-xs text-slate-400">Quality</p>
            </div>
            <span className="text-slate-400">=</span>
            <div className="text-center">
              <span className={`text-2xl font-black ${
                data.oee >= 85 ? 'text-green-600' : data.oee >= 70 ? 'text-blue-600' : 'text-amber-600'
              }`}>
                {data.oee}%
              </span>
              <p className="text-xs text-slate-400">OEE</p>
            </div>
          </div>

          {/* OEE Legend */}
          <div className="mt-6 flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-slate-500">World-Class (≥85%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-slate-500">Good (70-84%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-slate-500">Needs Improvement (50-69%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-slate-500">Critical (&lt;50%)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
