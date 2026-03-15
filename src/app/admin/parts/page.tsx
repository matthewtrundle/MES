import { getPartMasters } from '@/lib/actions/admin/parts';
import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { PartMasterTable } from '@/components/admin/PartMasterTable';
import { PartMasterForm } from '@/components/admin/PartMasterForm';

export default async function PartsPage() {
  const [parts, suppliers] = await Promise.all([
    getPartMasters(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Part Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {parts.length} part{parts.length !== 1 ? 's' : ''} in catalog
          </p>
        </div>
        <PartMasterForm suppliers={suppliers} />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <PartMasterTable parts={parts} suppliers={suppliers} />
      </div>
    </div>
  );
}
