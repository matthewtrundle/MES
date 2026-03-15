import { getInspectionQueue, getCompletedInspections } from '@/lib/actions/iqc';
import { IQCInspectionQueue } from '@/components/admin/IQCInspectionQueue';

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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">IQC Inspections</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {pendingCount} pending &middot; {inProgressCount} in progress &middot;{' '}
          <span className="text-green-600">{conformingCount} conforming</span>
          {nonconformingCount > 0 && (
            <span className="text-red-600"> &middot; {nonconformingCount} nonconforming</span>
          )}
        </p>
      </div>

      {/* Active Queue */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-2">Inspection Queue ({queue.length})</h2>
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <IQCInspectionQueue inspections={queue} />
        </div>
      </div>

      {/* Completed Inspections */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-700 mb-2">Recent Completed ({completed.length})</h2>
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <table className="table-enhanced">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Lot Number</th>
                  <th>Material</th>
                  <th>Supplier</th>
                  <th>Inspector</th>
                  <th>Completed</th>
                  <th className="text-right">Measurements</th>
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
                    <tr key={inspection.id}>
                      <td>
                        <ResultBadge result={inspection.overallResult} />
                      </td>
                      <td className="font-mono">
                        {inspection.materialLot.lotNumber}
                      </td>
                      <td className="font-mono">
                        {inspection.materialLot.materialCode}
                      </td>
                      <td>
                        {inspection.materialLot.supplierRef?.name ??
                          inspection.materialLot.supplier ??
                          '-'}
                      </td>
                      <td>
                        {inspection.inspector?.name ?? '-'}
                      </td>
                      <td className="text-slate-500">
                        {inspection.completedAt
                          ? new Date(inspection.completedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="text-right">
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
          </div>
        </div>
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
