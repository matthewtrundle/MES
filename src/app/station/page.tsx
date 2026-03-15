import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Factory, ArrowLeft, ChevronRight } from 'lucide-react';

export default async function StationSelectionPage() {
  const user = await requireUser();

  // If user has an assigned station, auto-redirect to it
  if (user.assignedStationId) {
    redirect(`/station/${user.assignedStationId}`);
  }

  // Get all active stations (simplified - show all stations for demo)
  const stations = await prisma.station.findMany({
    where: {
      active: true,
    },
    include: {
      site: true,
      _count: {
        select: {
          downtimeIntervals: {
            where: { endedAt: null },
          },
        },
      },
    },
    orderBy: [{ site: { name: 'asc' } }, { sequenceOrder: 'asc' }],
  });

  // Batch counts with groupBy instead of N per-station queries
  const stationIds = stations.map(s => s.id);
  const [unitCounts, opCounts] = await Promise.all([
    prisma.unit.groupBy({
      by: ['currentStationId'],
      where: {
        currentStationId: { in: stationIds },
        status: 'in_progress',
      },
      _count: true,
    }),
    prisma.workOrderOperation.groupBy({
      by: ['stationId'],
      where: {
        stationId: { in: stationIds },
        status: { in: ['pending', 'in_progress'] },
        workOrder: {
          status: { in: ['released', 'in_progress'] },
        },
      },
      _count: true,
    }),
  ]);

  const unitCountMap = new Map(unitCounts.map(c => [c.currentStationId, c._count]));
  const opCountMap = new Map(opCounts.map(c => [c.stationId, c._count]));

  const stationsWithCounts = stations.map((station) => ({
    ...station,
    activeUnits: unitCountMap.get(station.id) ?? 0,
    pendingOperations: opCountMap.get(station.id) ?? 0,
    hasActiveDowntime: station._count.downtimeIntervals > 0,
  }));

  // Determine current shift (basic time-based logic)
  const hour = new Date().getHours();
  const shiftName = hour >= 6 && hour < 14 ? 'Day Shift' : hour >= 14 && hour < 22 ? 'Swing Shift' : 'Night Shift';
  const shiftTime = hour >= 6 && hour < 14 ? '06:00 – 14:00' : hour >= 14 && hour < 22 ? '14:00 – 22:00' : '22:00 – 06:00';

  return (
    <div className="min-h-screen bg-slate-50" data-testid="station-selection-page">
      {/* Header Banner */}
      <div className="industrial-header-dark px-4 py-8">
        <div className="mx-auto max-w-4xl animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Select Your Station</h1>
              <p className="text-slate-400">
                Welcome, <span className="text-slate-200 font-medium">{user.name}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-200">
                {shiftName}
              </div>
              <div className="text-xs text-slate-400">
                {shiftTime} &middot; {stations.length} stations
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {stations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">No stations available.</p>
              <p className="text-sm text-gray-400">
                Contact your administrator to assign you to a site.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
            {stationsWithCounts.map((station) => {
              const statusClass = station.hasActiveDowntime
                ? 'station-downtime'
                : station.activeUnits > 0
                  ? 'station-active'
                  : 'station-idle';

              const borderColor = station.hasActiveDowntime
                ? 'border-l-amber-500'
                : station.activeUnits > 0
                  ? 'border-l-green-500'
                  : 'border-l-slate-300';

              return (
                <Link key={station.id} href={`/station/${station.id}`}>
                  <div
                    data-testid={`station-card-${station.id}`}
                    className={`${statusClass} rounded-lg p-4 cursor-pointer transition-all duration-150 hover:shadow-md border-l-4 ${borderColor}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                          {station.sequenceOrder}
                        </span>
                        <div>
                          <h3 data-testid={`station-card-name-${station.id}`} className="text-base font-semibold text-slate-900">{station.name}</h3>
                          <p className="text-xs text-slate-500">{station.site.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {station.hasActiveDowntime ? (
                          <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            DOWN
                          </span>
                        ) : (
                          <span className={`relative flex h-2.5 w-2.5`}>
                            <span className={`absolute inline-flex h-full w-full rounded-full ${
                              station.activeUnits > 0 ? 'bg-green-400 animate-ping opacity-75' : 'bg-gray-300'
                            }`} />
                            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                              station.activeUnits > 0 ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-sm mb-2">
                      <div>
                        <p className="text-[11px] text-slate-500">Active Units</p>
                        <p className="text-lg font-bold text-blue-600">
                          {station.activeUnits}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500">Pending Ops</p>
                        <p className="text-lg font-bold text-slate-700">
                          {station.pendingOperations}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          station.stationType === 'winding'
                            ? 'bg-purple-100 text-purple-700'
                            : station.stationType === 'assembly'
                              ? 'bg-green-100 text-green-700'
                              : station.stationType === 'test'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {station.stationType}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
