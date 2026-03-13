import { getQualityCheckDefinitions, getStationsForQualityChecks } from '@/lib/actions/admin/quality-checks';
import { QualityCheckTable } from '@/components/admin/QualityCheckTable';
import { QualityCheckForm } from '@/components/admin/QualityCheckForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function QualityChecksPage() {
  const [definitions, stations] = await Promise.all([
    getQualityCheckDefinitions(),
    getStationsForQualityChecks(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Check Definitions</h1>
          <p className="text-slate-500 mt-1">
            Configure quality checks performed at stations
          </p>
        </div>
        <QualityCheckForm stations={stations} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quality Checks</CardTitle>
          <CardDescription>
            {definitions.length} quality check{definitions.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QualityCheckTable definitions={definitions} stations={stations} />
        </CardContent>
      </Card>
    </div>
  );
}
