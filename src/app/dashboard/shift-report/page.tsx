import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { PrintButton } from '@/components/supervisor/PrintButton';

async function getShiftReportData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Shift configuration (8 hour shift starting at 6am)
  const shiftStart = new Date(today);
  shiftStart.setHours(6, 0, 0, 0);

  const now = new Date();
  const shiftEnd = new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000);
  const isShiftActive = now >= shiftStart && now <= shiftEnd;
  const shiftName = now.getHours() < 14 ? 'Morning Shift' : now.getHours() < 22 ? 'Evening Shift' : 'Night Shift';

  const [
    unitsCompleted,
    unitsInProgress,
    unitsCreated,
    downtimeIntervals,
    qualityResults,
    openNCRs,
    stationStats,
    eventCount,
  ] = await Promise.all([
    // Completed units this shift
    prisma.unit.findMany({
      where: {
        status: 'completed',
        updatedAt: { gte: shiftStart },
      },
      include: { workOrder: true },
    }),

    // Units still in progress
    prisma.unit.findMany({
      where: {
        status: { in: ['in_progress', 'rework'] },
      },
      include: {
        workOrder: true,
      },
    }),

    // Units created this shift
    prisma.unit.count({
      where: {
        createdAt: { gte: shiftStart },
      },
    }),

    // Downtime intervals (completed this shift)
    prisma.downtimeInterval.findMany({
      where: {
        OR: [
          { startedAt: { gte: shiftStart } },
          { endedAt: null }, // Active downtime
        ],
      },
      include: {
        station: true,
        reason: true,
      },
    }),

    // Quality checks this shift
    prisma.qualityCheckResult.findMany({
      where: {
        timestamp: { gte: shiftStart },
      },
      include: {
        definition: true,
      },
    }),

    // Open NCRs
    prisma.nonconformanceRecord.findMany({
      where: {
        status: { in: ['open', 'dispositioned'] },
      },
      include: {
        unit: true,
        station: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Station productivity
    prisma.unitOperationExecution.groupBy({
      by: ['stationId'],
      where: {
        completedAt: { gte: shiftStart },
      },
      _count: true,
    }),

    // Total events
    prisma.event.count({
      where: {
        createdAt: { gte: shiftStart },
      },
    }),
  ]);

  // Calculate downtime summary
  const downtimeMinutes = downtimeIntervals.reduce((sum, dt) => {
    const end = dt.endedAt ?? now;
    return sum + Math.round((end.getTime() - dt.startedAt.getTime()) / 60000);
  }, 0);

  const activeDowntime = downtimeIntervals.filter((dt) => !dt.endedAt);

  // Downtime by reason
  const downtimeByReason = new Map<string, number>();
  downtimeIntervals.forEach((dt) => {
    if (dt.reason) {
      const current = downtimeByReason.get(dt.reason.description) ?? 0;
      const end = dt.endedAt ?? now;
      const minutes = Math.round((end.getTime() - dt.startedAt.getTime()) / 60000);
      downtimeByReason.set(dt.reason.description, current + minutes);
    }
  });

  // Quality stats
  const passCount = qualityResults.filter((r) => r.result === 'pass').length;
  const failCount = qualityResults.filter((r) => r.result === 'fail').length;
  const qualityRate = qualityResults.length > 0
    ? Math.round((passCount / qualityResults.length) * 100)
    : 100;

  // Station names for stats
  const stationIds = stationStats.map((s) => s.stationId);
  const stations = stationIds.length > 0
    ? await prisma.station.findMany({
        where: { id: { in: stationIds } },
      })
    : [];
  const stationNameMap = new Map(stations.map((s) => [s.id, s.name]));

  const stationProductivity = stationStats.map((s) => ({
    name: stationNameMap.get(s.stationId) ?? 'Unknown',
    completedOps: s._count,
  })).sort((a, b) => b.completedOps - a.completedOps);

  // Get station names for WIP units
  const wipStationIds = unitsInProgress.filter(u => u.currentStationId).map(u => u.currentStationId as string);
  const wipStations = wipStationIds.length > 0
    ? await prisma.station.findMany({
        where: { id: { in: wipStationIds } },
      })
    : [];
  const wipStationMap = new Map(wipStations.map((s) => [s.id, s.name]));

  // Enrich units in progress with station names
  const unitsInProgressWithStation = unitsInProgress.map((unit) => ({
    ...unit,
    stationName: unit.currentStationId ? wipStationMap.get(unit.currentStationId) ?? 'Unknown' : 'Unknown',
  }));

  // Calculate elapsed shift time
  const elapsedMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
  const elapsedHours = Math.round(elapsedMinutes / 60 * 10) / 10;

  // OEE calculation
  const plannedMinutes = Math.min(elapsedMinutes, 480); // Max 8 hours
  const availableMinutes = Math.max(0, plannedMinutes - downtimeMinutes);
  const availability = plannedMinutes > 0 ? (availableMinutes / plannedMinutes) * 100 : 100;

  const idealCycleTime = 15;
  const expectedUnits = Math.floor(availableMinutes / idealCycleTime);
  const performance = expectedUnits > 0
    ? Math.min(100, (unitsCompleted.length / expectedUnits) * 100)
    : 100;

  const oee = (availability / 100) * (performance / 100) * (qualityRate / 100) * 100;

  return {
    shiftName,
    shiftStart,
    isShiftActive,
    elapsedHours,
    summary: {
      unitsCompleted: unitsCompleted.length,
      unitsInProgress: unitsInProgress.length,
      unitsCreated,
      eventCount,
    },
    unitsInProgress: unitsInProgressWithStation,
    downtime: {
      totalMinutes: downtimeMinutes,
      activeCount: activeDowntime.length,
      activeDowntime,
      byReason: Array.from(downtimeByReason.entries())
        .map(([reason, minutes]) => ({ reason, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
    },
    quality: {
      passCount,
      failCount,
      rate: qualityRate,
    },
    openNCRs,
    stationProductivity,
    oee: {
      overall: Math.round(oee * 10) / 10,
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: qualityRate,
    },
    generatedAt: now,
  };
}

export default async function ShiftReportPage() {
  const data = await getShiftReportData();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Header - Hidden on print, shows navigation */}
      <header className="border-b border-gray-200 bg-white print:hidden">
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
                <div className="rounded-lg bg-indigo-100 p-2">
                  <Icons.clock className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Shift Report</h1>
                  <p className="text-sm text-gray-500">{data.shiftName} Summary</p>
                </div>
              </div>
            </div>
            <PrintButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-8">
        {/* Printable Report Header */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6 print:border-0 print:p-0">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SHIFT HANDOFF REPORT</h1>
              <p className="text-gray-500">Motor Assembly Plant</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">{data.shiftName}</p>
              <p className="text-sm text-gray-500">
                {data.shiftStart.toLocaleDateString()} • {data.elapsedHours}h elapsed
              </p>
              <p className="text-xs text-gray-400">
                Generated: {data.generatedAt.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-3xl font-bold text-green-600">{data.summary.unitsCompleted}</p>
              <p className="text-xs text-green-700">Completed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-3xl font-bold text-blue-600">{data.summary.unitsInProgress}</p>
              <p className="text-xs text-blue-700">In Progress</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-3xl font-bold text-amber-600">{data.downtime.totalMinutes}</p>
              <p className="text-xs text-amber-700">Downtime (min)</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-3xl font-bold text-purple-600">{data.quality.rate}%</p>
              <p className="text-xs text-purple-700">Quality Rate</p>
            </div>
            <div className={`text-center p-3 rounded-lg border ${
              data.oee.overall >= 85 ? 'bg-green-50 border-green-200' :
              data.oee.overall >= 70 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <p className={`text-3xl font-bold ${
                data.oee.overall >= 85 ? 'text-green-600' :
                data.oee.overall >= 70 ? 'text-blue-600' : 'text-amber-600'
              }`}>{data.oee.overall}%</p>
              <p className="text-xs text-gray-700">OEE</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
          {/* Active Issues Alert */}
          {(data.downtime.activeCount > 0 || data.openNCRs.length > 0) && (
            <div className="md:col-span-2 rounded-lg border-2 border-red-300 bg-red-50 p-4 print:break-inside-avoid">
              <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                <Icons.warning className="h-5 w-5" />
                ACTION REQUIRED
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {data.downtime.activeCount > 0 && (
                  <div>
                    <p className="font-medium text-red-700">Active Downtime ({data.downtime.activeCount})</p>
                    <ul className="text-sm text-red-600 mt-1">
                      {data.downtime.activeDowntime.slice(0, 3).map((dt) => (
                        <li key={dt.id}>
                          • {dt.station.name}: {dt.reason?.description ?? 'Awaiting reason'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.openNCRs.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700">Open NCRs ({data.openNCRs.length})</p>
                    <ul className="text-sm text-red-600 mt-1">
                      {data.openNCRs.slice(0, 3).map((ncr) => (
                        <li key={ncr.id}>
                          • {ncr.unit?.serialNumber ?? 'IQC'}: {ncr.defectType}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WIP Status */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 print:break-inside-avoid">
            <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
              WORK IN PROGRESS
            </h3>
            {data.unitsInProgress.length === 0 ? (
              <p className="text-gray-500 text-sm">No units currently in progress</p>
            ) : (
              <div className="space-y-2">
                {data.unitsInProgress.slice(0, 6).map((unit) => (
                  <div key={unit.id} className="flex justify-between text-sm">
                    <span className="font-mono">{unit.serialNumber}</span>
                    <span className="text-gray-500">{unit.stationName}</span>
                  </div>
                ))}
                {data.unitsInProgress.length > 6 && (
                  <p className="text-xs text-gray-400">
                    +{data.unitsInProgress.length - 6} more units
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Downtime Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 print:break-inside-avoid">
            <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
              DOWNTIME SUMMARY
            </h3>
            {data.downtime.byReason.length === 0 ? (
              <p className="text-green-600 text-sm">No downtime recorded this shift</p>
            ) : (
              <div className="space-y-2">
                {data.downtime.byReason.slice(0, 5).map((item) => (
                  <div key={item.reason} className="flex justify-between text-sm">
                    <span>{item.reason}</span>
                    <span className="font-mono font-medium text-amber-600">{item.minutes} min</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200 flex justify-between font-medium">
                  <span>Total</span>
                  <span className="font-mono text-amber-600">{data.downtime.totalMinutes} min</span>
                </div>
              </div>
            )}
          </div>

          {/* Quality Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 print:break-inside-avoid">
            <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
              QUALITY METRICS
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{data.quality.passCount}</p>
                <p className="text-xs text-gray-500">Pass</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{data.quality.failCount}</p>
                <p className="text-xs text-gray-500">Fail</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${
                  data.quality.rate >= 95 ? 'text-green-600' : 'text-amber-600'
                }`}>{data.quality.rate}%</p>
                <p className="text-xs text-gray-500">Rate</p>
              </div>
            </div>
          </div>

          {/* Station Productivity */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 print:break-inside-avoid">
            <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
              STATION PRODUCTIVITY
            </h3>
            {data.stationProductivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No operations completed this shift</p>
            ) : (
              <div className="space-y-2">
                {data.stationProductivity.slice(0, 5).map((station) => (
                  <div key={station.name} className="flex justify-between text-sm">
                    <span>{station.name}</span>
                    <span className="font-mono font-medium">{station.completedOps} ops</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OEE Breakdown */}
          <div className="md:col-span-2 rounded-lg border border-gray-200 bg-white p-4 print:break-inside-avoid">
            <h3 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
              OEE BREAKDOWN
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{data.oee.availability}%</p>
                <p className="text-xs text-gray-500">Availability</p>
              </div>
              <span className="text-2xl text-gray-300">×</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{data.oee.performance}%</p>
                <p className="text-xs text-gray-500">Performance</p>
              </div>
              <span className="text-2xl text-gray-300">×</span>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{data.oee.quality}%</p>
                <p className="text-xs text-gray-500">Quality</p>
              </div>
              <span className="text-2xl text-gray-300">=</span>
              <div className="text-center">
                <p className={`text-3xl font-black ${
                  data.oee.overall >= 85 ? 'text-green-600' :
                  data.oee.overall >= 70 ? 'text-blue-600' : 'text-amber-600'
                }`}>{data.oee.overall}%</p>
                <p className="text-xs text-gray-500">OEE</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Block (for print) */}
        <div className="hidden print:block mt-8 pt-8 border-t border-gray-300">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-500 mb-8">Outgoing Shift Supervisor</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-xs text-gray-400">Signature / Date</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-8">Incoming Shift Supervisor</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-xs text-gray-400">Signature / Date</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
