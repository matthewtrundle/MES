import { getPartMasters } from '@/lib/actions/admin/parts';
import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { PartMasterTable } from '@/components/admin/PartMasterTable';
import { PartMasterForm } from '@/components/admin/PartMasterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PartsPage() {
  const [parts, suppliers] = await Promise.all([
    getPartMasters(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Part Master</h1>
          <p className="text-slate-500 mt-1">
            Manage the canonical part catalog for all materials
          </p>
        </div>
        <PartMasterForm suppliers={suppliers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Parts</CardTitle>
          <CardDescription>
            {parts.length} part{parts.length !== 1 ? 's' : ''} in catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartMasterTable parts={parts} suppliers={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
