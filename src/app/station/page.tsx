import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

  // Get active work counts per station
  const stationsWithCounts = await Promise.all(
    stations.map(async (station) => {
      const activeUnits = await prisma.unit.count({
        where: {
          currentStationId: station.id,
          status: 'in_progress',
        },
      });

      const pendingOperations = await prisma.workOrderOperation.count({
        where: {
          stationId: station.id,
          status: { in: ['pending', 'in_progress'] },
          workOrder: {
            status: { in: ['released', 'in_progress'] },
          },
        },
      });

      return {
        ...station,
        activeUnits,
        pendingOperations,
        hasActiveDowntime: station._count.downtimeIntervals > 0,
      };
    })
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Select Your Station</h1>
          <p className="text-gray-600">Welcome, {user.name}</p>
        </div>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stationsWithCounts.map((station) => (
              <Link key={station.id} href={`/station/${station.id}`}>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    station.hasActiveDowntime
                      ? 'border-2 border-yellow-400 bg-yellow-50'
                      : 'hover:border-blue-300'
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-lg">{station.name}</span>
                      {station.hasActiveDowntime && (
                        <span className="rounded bg-yellow-400 px-2 py-1 text-xs font-medium text-yellow-900">
                          DOWN
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-500">{station.site.name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-500">Active Units</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {station.activeUnits}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Pending Ops</p>
                        <p className="text-2xl font-bold text-gray-700">
                          {station.pendingOperations}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs ${
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
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
