import { getCTQDefinitions, getDistinctPartNumbers } from '@/lib/actions/admin/ctq-definitions';
import { CTQTable } from '@/components/admin/CTQTable';
import { CTQForm } from '@/components/admin/CTQForm';

export default async function CTQPage() {
  const definitions = await getCTQDefinitions();
  const partRevisions = await getDistinctPartNumbers();

  const partNumbers = [...new Set(definitions.map((d) => d.partNumber))];
  const totalActive = definitions.filter((d) => d.active).length;
  const safetyCriticalCount = definitions.filter((d) => d.safetyCritical).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">CTQ Definitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {definitions.length} dimension{definitions.length !== 1 ? 's' : ''} &middot; {totalActive} active &middot; {partNumbers.length} part{partNumbers.length !== 1 ? 's' : ''}
            {safetyCriticalCount > 0 && (
              <span className="text-red-600 font-medium"> &middot; {safetyCriticalCount} safety-critical</span>
            )}
          </p>
        </div>
        <CTQForm />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <CTQTable definitions={definitions} partRevisions={partRevisions} />
      </div>
    </div>
  );
}
