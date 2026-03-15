import { prisma } from '@/lib/db/prisma';
import { MiniSparkline } from './MiniSparkline';

export async function TrendChartsSection() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [qualityResults, completedUnits, fpyExecutions] = await Promise.all([
    prisma.qualityCheckResult.findMany({
      where: { timestamp: { gte: sevenDaysAgo } },
      select: { timestamp: true, result: true },
    }),
    prisma.unit.findMany({
      where: { status: 'completed', updatedAt: { gte: sevenDaysAgo } },
      select: { updatedAt: true },
    }),
    prisma.unitOperationExecution.findMany({
      where: { completedAt: { gte: sevenDaysAgo }, isRework: false, result: { not: null } },
      select: { completedAt: true, result: true },
    }),
  ]);

  // Group by day (7 buckets)
  const dayBuckets = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  function getDayIndex(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < dayBuckets.length; i++) {
      if (d.getTime() === dayBuckets[i].getTime()) return i;
    }
    return -1;
  }

  // Quality rate per day
  const qualityByDay = Array(7).fill(null).map(() => ({ pass: 0, total: 0 }));
  qualityResults.forEach((qr) => {
    const idx = getDayIndex(qr.timestamp);
    if (idx >= 0) {
      qualityByDay[idx].total++;
      if (qr.result === 'pass') qualityByDay[idx].pass++;
    }
  });
  const qualityRateData = qualityByDay.map((d) =>
    d.total > 0 ? Math.round((d.pass / d.total) * 100) : 100
  );
  const currentQualityRate = qualityRateData[6];

  // Throughput per day
  const throughputByDay = Array(7).fill(0);
  completedUnits.forEach((u) => {
    const idx = getDayIndex(u.updatedAt);
    if (idx >= 0) throughputByDay[idx]++;
  });
  const currentThroughput = throughputByDay[6];

  // FPY per day
  const fpyByDay = Array(7).fill(null).map(() => ({ pass: 0, total: 0 }));
  fpyExecutions.forEach((e) => {
    if (e.completedAt) {
      const idx = getDayIndex(e.completedAt);
      if (idx >= 0) {
        fpyByDay[idx].total++;
        if (e.result === 'pass') fpyByDay[idx].pass++;
      }
    }
  });
  const fpyData = fpyByDay.map((d) =>
    d.total > 0 ? Math.round((d.pass / d.total) * 1000) / 10 : 100
  );
  const currentFPY = fpyData[6];

  const charts = [
    {
      title: 'Quality Rate',
      value: `${currentQualityRate}%`,
      data: qualityRateData,
      color: '#22c55e',
    },
    {
      title: 'First-Pass Yield',
      value: `${currentFPY}%`,
      data: fpyData,
      color: '#3b82f6',
    },
    {
      title: 'Throughput',
      value: `${currentThroughput}`,
      data: throughputByDay,
      color: '#8b5cf6',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {charts.map((chart) => (
          <div
            key={chart.title}
            className="industrial-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-section-title">{chart.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {chart.value}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                7-day trend
              </span>
            </div>
            <MiniSparkline
              data={chart.data}
              color={chart.color}
              height={40}
              width={200}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
