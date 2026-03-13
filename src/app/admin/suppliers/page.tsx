import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { SupplierTable } from '@/components/admin/SupplierTable';
import { SupplierForm } from '@/components/admin/SupplierForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500 mt-1">
            Manage supplier records and qualification status
          </p>
        </div>
        <SupplierForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierTable suppliers={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
