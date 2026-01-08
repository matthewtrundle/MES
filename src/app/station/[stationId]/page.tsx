import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StationHeader } from '@/components/operator/StationHeader';
import { WorkOrderList } from '@/components/operator/WorkOrderList';
import { ActiveUnit } from '@/components/operator/ActiveUnit';
import { DowntimePanel } from '@/components/operator/DowntimePanel';

interface StationPageProps {
  params: Promise<{ stationId: string }>;
}

export default async function StationPage({ params }: StationPageProps) {
  const { stationId } = await params;
  const user = await requireUser();

  // Get station details
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      site: true,
    },
  });

  if (!station) {
    notFound();
  }

  // Get active downtime
  const activeDowntime = await prisma.downtimeInterval.findFirst({
    where: {
      stationId,
      endedAt: null,
    },
    include: {
      reason: true,
      operator: true,
    },
  });

  // Get available work orders at this station
  const workOrders = await prisma.workOrder.findMany({
    where: {
      siteId: station.siteId,
      status: { in: ['released', 'in_progress'] },
      operations: {
        some: {
          stationId,
          status: { in: ['pending', 'in_progress'] },
        },
      },
    },
    include: {
      units: {
        where: {
          status: { in: ['created', 'in_progress', 'rework'] },
        },
      },
      operations: {
        where: { stationId },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: [{ priority: 'desc' }, { releasedAt: 'asc' }],
  });

  // Get units currently at this station
  const activeUnits = await prisma.unit.findMany({
    where: {
      currentStationId: stationId,
      status: 'in_progress',
    },
    include: {
      workOrder: true,
      executions: {
        where: {
          stationId,
          completedAt: null,
        },
        include: {
          operation: true,
          operator: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get downtime reasons
  const downtimeReasons = await prisma.downtimeReason.findMany({
    where: {
      siteId: station.siteId,
      active: true,
    },
    orderBy: [{ isPlanned: 'asc' }, { code: 'asc' }],
  });

  // Get quality checks for this station
  const qualityChecks = await prisma.qualityCheckDefinition.findMany({
    where: {
      stationIds: { has: stationId },
      active: true,
    },
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Station Header */}
      <StationHeader
        station={station}
        user={user}
        hasActiveDowntime={!!activeDowntime}
      />

      {/* Main Content */}
      <div className="p-4">
        {/* Downtime Alert */}
        {activeDowntime && (
          <DowntimePanel
            downtime={activeDowntime}
            reasons={downtimeReasons}
            stationId={stationId}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Work Orders */}
          <div className="lg:col-span-1">
            <WorkOrderList
              workOrders={workOrders}
              stationId={stationId}
              disabled={!!activeDowntime}
            />
          </div>

          {/* Right Column - Active Units & Controls */}
          <div className="space-y-4 lg:col-span-2">
            {activeUnits.length === 0 ? (
              <div className="rounded-lg bg-white p-8 text-center shadow">
                <p className="text-lg text-gray-500">No active units at this station</p>
                <p className="mt-2 text-sm text-gray-400">
                  Select a work order and scan or create a unit to begin
                </p>
              </div>
            ) : (
              activeUnits.map((unit) => (
                <ActiveUnit
                  key={unit.id}
                  unit={unit}
                  stationId={stationId}
                  qualityChecks={qualityChecks}
                  disabled={!!activeDowntime}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button variant="outline" asChild>
            <Link href="/station">Change Station</Link>
          </Button>

          {!activeDowntime ? (
            <DowntimeStartButton stationId={stationId} />
          ) : (
            <DowntimeEndButton downtimeId={activeDowntime.id} />
          )}
        </div>
      </div>

      {/* Spacer for fixed bottom nav */}
      <div className="h-20" />
    </div>
  );
}

// Client components for downtime buttons
import { DowntimeStartButton, DowntimeEndButton } from '@/components/operator/DowntimeButtons';
