import { getMaterialLotsForAdmin } from '@/lib/actions/material-receiving';
import { MaterialReceivingForm } from '@/components/admin/MaterialReceivingForm';
import { MaterialLotTable } from '@/components/admin/MaterialLotTable';

export default async function MaterialsPage() {
  const lots = await getMaterialLotsForAdmin();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Material Receiving</h1>
          <p className="text-sm text-sm text-slate-500 mt-0.5">Receive material lots into inventory</p>
        </div>
      </div>
      <MaterialReceivingForm />
      <MaterialLotTable lots={lots} />
    </div>
  );
}
