import { getInspectionQueue, getCompletedInspections } from '@/lib/actions/iqc';
import { IQCInspectionQueue } from '@/components/admin/IQCInspectionQueue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function IQCPage() {
  const [queue, completed] = await Promise.all([
    getInspectionQueue(),
    getCompletedInspections(),
  ]);

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const inProgressCount = queue.filter((i) => i.status === 'in_progress').length;
  const conformingCount = completed.filter((i) => i.overallResult === 'conforming').length;
  const nonconformingCount = completed.filter(
    (i) => i.overallResult && i.overallResult !== 'conforming'
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">IQC Inspections</h1>
        <p className="text-slate-500 mt-1">
          Incoming Quality Control - inspect and disposition received material lots
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-700">{pendingCount}</div>
            <p className="text-xs text-slate-500">Pending Inspection</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
            <p className="text-xs text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{conformingCount}</div>
            <p className="text-xs text-slate-500">Conforming (completed)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{nonconformingCount}</div>
            <p className="text-xs text-slate-500">Nonconforming (completed)</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Inspection Queue</CardTitle>
          <CardDescription>
            {queue.length} inspection{queue.length !== 1 ? 's' : ''} requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IQCInspectionQueue inspections={queue} />
        </CardContent>
      </Card>

      {/* Completed Inspections */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Completed Inspections</CardTitle>
            <CardDescription>
              Last {completed.length} completed inspection{completed.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Result</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Lot Number</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Material</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Supplier</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Inspector</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Completed</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Measurements</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((inspection) => {
                  const passCount = inspection.results.filter(
                    (r) => r.result === 'pass'
                  ).length;
                  const failCount = inspection.results.filter(
                    (r) => r.result === 'fail'
                  ).length;

                  return (
                    <tr key={inspection.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <ResultBadge result={inspection.overallResult} />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {inspection.materialLot.lotNumber}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {inspection.materialLot.materialCode}
                      </td>
                      <td className="py-2 px-3">
                        {inspection.materialLot.supplierRef?.name ??
                          inspection.materialLot.supplier ??
                          '-'}
                      </td>
                      <td className="py-2 px-3">
                        {inspection.inspector?.name ?? '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {inspection.completedAt
                          ? new Date(inspection.completedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-green-600">{passCount}P</span>
                        {failCount > 0 && (
                          <span className="text-red-600 ml-1">/ {failCount}F</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: string | null }) {
  switch (result) {
    case 'conforming':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Conforming
        </span>
      );
    case 'nonconforming_rework':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          NC - Rework
        </span>
      );
    case 'nonconforming_uai':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          NC - UAI
        </span>
      );
    case 'nonconforming_scrap':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          NC - Scrap
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {result ?? 'Unknown'}
        </span>
      );
  }
}
