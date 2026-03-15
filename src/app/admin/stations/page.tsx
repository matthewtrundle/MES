import { getStationsForAdmin } from '@/lib/actions/admin/stations';
import { getSites } from '@/lib/actions/admin/downtime-reasons';
import { StationTable } from '@/components/admin/StationTable';
import { StationForm } from '@/components/admin/StationForm';

export default async function StationsPage() {
  const [stations, sites] = await Promise.all([
    getStationsForAdmin(),
    getSites(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stations.length} station{stations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <StationForm sites={sites} />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <StationTable stations={stations} sites={sites} />
      </div>
    </div>
  );
}
