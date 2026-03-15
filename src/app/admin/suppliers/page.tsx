import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { SupplierTable } from '@/components/admin/SupplierTable';
import { SupplierForm } from '@/components/admin/SupplierForm';

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <SupplierForm />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <SupplierTable suppliers={suppliers} />
      </div>
    </div>
  );
}
