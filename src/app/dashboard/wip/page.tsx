import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

async function getWIPData() {
  // Get all stations with their downtime
  const stations = await prisma.station.findMany({
    include: {
      downtimeIntervals: {
        where: { endedAt: null },
        include: {
          reason: true,
          operator: true,
        },
      },
    },
    orderBy: { sequenceOrder: 'asc' },
  });

  // Get all units at stations with their details
  const unitsAtStations = await prisma.unit.findMany({
    where: {
      status: { in: ['in_progress', 'rework'] },
      currentStationId: { not: null },
    },
    include: {
      workOrder: true,
      executions: {
        where: { completedAt: null },
        include: {
          operator: true,
          operation: true,
        },
      },
    },
  });

  // Group units by station
  const unitsByStation = new Map<string, typeof unitsAtStations>();
  unitsAtStations.forEach((unit) => {
    const stationId = unit.currentStationId!;
    const existing = unitsByStation.get(stationId) ?? [];
    existing.push(unit);
    unitsByStation.set(stationId, existing);
  });

  // Combine stations with their units
  const stationsWithData = stations.map((station) => ({
    ...station,
    units: unitsByStation.get(station.id) ?? [],
  }));

  return stationsWithData;
}

export default async function WIPPage() {
  const stations = await getWIPData();

  const totalWIP = stations.reduce((sum, station) => sum + station.units.length, 0);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work in Progress</h1>
          <p className="text-gray-600">
            Total WIP: <span className="font-medium">{totalWIP} units</span>
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-6">
        {stations.map((station) => (
          <Card
            key={station.id}
            className={
              station.downtimeIntervals.length > 0
                ? 'border-2 border-yellow-400'
                : ''
            }
          >
            <CardHeader
              className={
                station.downtimeIntervals.length > 0
                  ? 'bg-yellow-50'
                  : 'bg-gray-50'
              }
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full ${
                      station.downtimeIntervals.length > 0
                        ? 'bg-yellow-400'
                        : station.units.length > 0
                          ? 'bg-green-400'
                          : 'bg-gray-300'
                    }`}
                  />
                  {station.name}
                </CardTitle>
                <div className="flex items-center gap-4">
                  <span className="text-lg">
                    WIP:{' '}
                    <span className="font-bold">{station.units.length}</span>
                  </span>
                  {station.downtimeIntervals.length > 0 && (
                    <span className="rounded bg-yellow-200 px-3 py-1 text-yellow-800">
                      DOWNTIME
                    </span>
                  )}
                </div>
              </div>

              {station.downtimeIntervals.length > 0 && (
                <div className="mt-2 rounded bg-yellow-100 p-2 text-sm">
                  {station.downtimeIntervals.map((dt) => (
                    <div key={dt.id}>
                      <span className="font-medium">
                        {dt.reason?.code ?? 'No reason selected'}
                      </span>
                      {dt.reason && (
                        <span className="text-yellow-700">
                          {' '}
                          - {dt.reason.description}
                        </span>
                      )}
                      <span className="ml-2 text-yellow-600">
                        (Started:{' '}
                        {new Date(dt.startedAt).toLocaleTimeString()} by{' '}
                        {dt.operator.name})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {station.units.length === 0 ? (
                <p className="py-4 text-center text-gray-500">
                  No units at this station
                </p>
              ) : (
                <div className="space-y-3">
                  {station.units.map((unit) => {
                    const activeExecution = unit.executions[0];
                    const elapsedMinutes = activeExecution
                      ? Math.round(
                          (Date.now() -
                            new Date(activeExecution.startedAt).getTime()) /
                            60000
                        )
                      : 0;

                    return (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {unit.serialNumber}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs ${
                                unit.status === 'rework'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {unit.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {unit.workOrder.orderNumber} -{' '}
                            {unit.workOrder.productCode}
                          </p>
                        </div>

                        {activeExecution && (
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              Step {activeExecution.operation.sequence}
                            </p>
                            <p className="text-sm font-medium">
                              {elapsedMinutes} min
                              {activeExecution.operation.estimatedMinutes && (
                                <span className="text-gray-400">
                                  {' '}
                                  / {activeExecution.operation.estimatedMinutes}{' '}
                                  est
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {activeExecution.operator.name}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
