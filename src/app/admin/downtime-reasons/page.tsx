import { getDowntimeReasonsForAdmin, getSites } from '@/lib/actions/admin/downtime-reasons';
import { DowntimeReasonTable } from '@/components/admin/DowntimeReasonTable';
import { DowntimeReasonForm } from '@/components/admin/DowntimeReasonForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function DowntimeReasonsPage() {
  const [reasons, sites] = await Promise.all([
    getDowntimeReasonsForAdmin(),
    getSites(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Downtime Reasons</h1>
          <p className="text-slate-500 mt-1">
            Configure reasons for tracking production downtime
          </p>
        </div>
        <DowntimeReasonForm sites={sites} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Downtime Reasons</CardTitle>
          <CardDescription>
            {reasons.length} reason{reasons.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DowntimeReasonTable reasons={reasons} sites={sites} />
        </CardContent>
      </Card>
    </div>
  );
}
