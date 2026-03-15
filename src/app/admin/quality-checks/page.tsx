import { getQualityCheckDefinitions, getStationsForQualityChecks } from '@/lib/actions/admin/quality-checks';
import { QualityCheckTable } from '@/components/admin/QualityCheckTable';
import { QualityCheckForm } from '@/components/admin/QualityCheckForm';

export default async function QualityChecksPage() {
  const [definitions, stations] = await Promise.all([
    getQualityCheckDefinitions(),
    getStationsForQualityChecks(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quality Check Definitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {definitions.length} quality check{definitions.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <QualityCheckForm stations={stations} />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <QualityCheckTable definitions={definitions} stations={stations} />
      </div>
    </div>
  );
}
