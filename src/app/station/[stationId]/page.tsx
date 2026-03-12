import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StationHeader } from '@/components/operator/StationHeader';
import { WorkOrderList } from '@/components/operator/WorkOrderList';
import { ActiveUnit } from '@/components/operator/ActiveUnit';
import { DowntimePanel } from '@/components/operator/DowntimePanel';
import { Icons } from '@/components/icons';
import { getBomForStation } from '@/lib/actions/bom';

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

  // Get BOM items for each active work order's routing at this station
  const bomItemsByWorkOrder: Record<string, { materialCode: string; description: string | null; qtyPerUnit: number; unitOfMeasure: string }[]> = {};
  const routingIds = new Set(
    workOrders.map((wo) => wo.routingId).filter((id): id is string => id != null)
  );
  for (const routingId of routingIds) {
    const items = await getBomForStation(routingId, stationId);
    // Map BOM items by routing, keyed by work order ID for easy lookup
    const matchingWOs = workOrders.filter((wo) => wo.routingId === routingId);
    for (const wo of matchingWOs) {
      bomItemsByWorkOrder[wo.id] = items.map((item) => ({
        materialCode: item.materialCode,
        description: item.description,
        qtyPerUnit: item.qtyPerUnit,
        unitOfMeasure: item.unitOfMeasure,
      }));
    }
  }

  // Get previous station executions for active units
  const previousExecutionsByUnit: Record<string, {
    id: string;
    stationName: string;
    sequence: number;
    result: string | null;
    cycleTimeMinutes: number | null;
    completedAt: string | null;
    operatorName: string;
  }[]> = {};
  for (const unit of activeUnits) {
    const prevExecs = await prisma.unitOperationExecution.findMany({
      where: {
        unitId: unit.id,
        stationId: { not: stationId },
        completedAt: { not: null },
      },
      include: {
        operation: true,
        station: { select: { name: true } },
        operator: { select: { name: true } },
      },
      orderBy: { completedAt: 'asc' },
    });
    previousExecutionsByUnit[unit.id] = prevExecs.map((exec) => ({
      id: exec.id,
      stationName: exec.station.name,
      sequence: exec.operation.sequence,
      result: exec.result,
      cycleTimeMinutes: exec.cycleTimeMinutes,
      completedAt: exec.completedAt?.toISOString() ?? null,
      operatorName: exec.operator.name,
    }));
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Station Header */}
      <StationHeader
        station={station}
        user={user}
        hasActiveDowntime={!!activeDowntime}
        activeUnitsCount={activeUnits.length}
      />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Downtime Alert */}
        {activeDowntime && (
          <div className="mb-4">
            <DowntimePanel
              downtime={activeDowntime}
              reasons={downtimeReasons}
              stationId={stationId}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
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
              <div className="industrial-card">
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <Icons.unit className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-xl font-semibold text-slate-700">No active units</p>
                  <p className="mt-2 text-slate-500 max-w-sm mx-auto">
                    Select a work order from the left panel and create a new unit to begin processing
                  </p>
                </div>
              </div>
            ) : (
              activeUnits.map((unit) => (
                <ActiveUnit
                  key={unit.id}
                  unit={unit}
                  stationId={stationId}
                  qualityChecks={qualityChecks}
                  disabled={!!activeDowntime}
                  bomItems={bomItemsByWorkOrder[unit.workOrderId] ?? []}
                  previousExecutions={previousExecutionsByUnit[unit.id] ?? []}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Industrial Style */}
      <div className="fixed bottom-0 left-0 right-0 border-t-2 border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Button
            variant="outline"
            size="lg"
            className="h-14 px-6 text-base border-2 border-slate-300 bg-white hover:bg-slate-50 shadow-sm"
            asChild
          >
            <Link href="/station">
              <Icons.chevronLeft className="mr-2 h-5 w-5" />
              Change Station
            </Link>
          </Button>

          {!activeDowntime ? (
            <DowntimeStartButton stationId={stationId} />
          ) : (
            <DowntimeEndButton downtimeId={activeDowntime.id} />
          )}
        </div>
      </div>

      {/* Spacer for fixed bottom nav */}
      <div className="h-24" />
    </div>
  );
}

// Client components for downtime buttons
import { DowntimeStartButton, DowntimeEndButton } from '@/components/operator/DowntimeButtons';
