import { getStationsForAdmin } from '@/lib/actions/admin/stations';
import { getSites } from '@/lib/actions/admin/downtime-reasons';
import { StationTable } from '@/components/admin/StationTable';
import { StationForm } from '@/components/admin/StationForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function StationsPage() {
  const [stations, sites] = await Promise.all([
    getStationsForAdmin(),
    getSites(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stations</h1>
          <p className="text-slate-500 mt-1">
            Manage production stations and their configuration
          </p>
        </div>
        <StationForm sites={sites} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Stations</CardTitle>
          <CardDescription>
            {stations.length} station{stations.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StationTable stations={stations} sites={sites} />
        </CardContent>
      </Card>
    </div>
  );
}
