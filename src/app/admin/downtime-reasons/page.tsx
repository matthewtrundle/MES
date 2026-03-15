import { getDowntimeReasonsForAdmin, getSites } from '@/lib/actions/admin/downtime-reasons';
import { DowntimeReasonTable } from '@/components/admin/DowntimeReasonTable';
import { DowntimeReasonForm } from '@/components/admin/DowntimeReasonForm';

export default async function DowntimeReasonsPage() {
  const [reasons, sites] = await Promise.all([
    getDowntimeReasonsForAdmin(),
    getSites(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Downtime Reasons</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {reasons.length} reason{reasons.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <DowntimeReasonForm sites={sites} />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <DowntimeReasonTable reasons={reasons} sites={sites} />
      </div>
    </div>
  );
}
