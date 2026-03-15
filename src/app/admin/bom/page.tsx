import { getRoutingsWithBom } from '@/lib/actions/bom';
import { getStationsForQualityChecks } from '@/lib/actions/admin/quality-checks';
import { BomEditor } from '@/components/admin/BomEditor';

export default async function BomPage() {
  const [routings, stations] = await Promise.all([
    getRoutingsWithBom(),
    getStationsForQualityChecks(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bill of Materials</h1>
        <p className="text-sm text-sm text-slate-500 mt-0.5">Define material requirements per routing and station</p>
      </div>
      <BomEditor routings={routings} stations={stations} />
    </div>
  );
}
