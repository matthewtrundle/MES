import { getCTQDefinitions, getDistinctPartNumbers } from '@/lib/actions/admin/ctq-definitions';
import { CTQTable } from '@/components/admin/CTQTable';
import { CTQForm } from '@/components/admin/CTQForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CTQPage() {
  const definitions = await getCTQDefinitions();
  const partRevisions = await getDistinctPartNumbers();

  // Group definitions by part number for display
  const partNumbers = [...new Set(definitions.map((d) => d.partNumber))];
  const totalActive = definitions.filter((d) => d.active).length;
  const safetyCriticalCount = definitions.filter((d) => d.safetyCritical).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CTQ Definitions</h1>
          <p className="text-slate-500 mt-1">
            Critical-to-Quality dimensions for incoming quality inspection
          </p>
        </div>
        <CTQForm />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{definitions.length}</div>
            <p className="text-xs text-slate-500">Total CTQ Dimensions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalActive}</div>
            <p className="text-xs text-slate-500">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{partNumbers.length}</div>
            <p className="text-xs text-slate-500">Part Numbers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{safetyCriticalCount}</div>
            <p className="text-xs text-slate-500">Safety Critical</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All CTQ Dimensions</CardTitle>
          <CardDescription>
            {definitions.length} dimension{definitions.length !== 1 ? 's' : ''} configured across {partNumbers.length} part number{partNumbers.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CTQTable definitions={definitions} partRevisions={partRevisions} />
        </CardContent>
      </Card>
    </div>
  );
}
