import { getWorkOrdersWithKitStatus } from '@/lib/actions/kitting';
import { KitBuilder } from '@/components/admin/KitBuilder';

export default async function KittingPage() {
  const workOrders = await getWorkOrdersWithKitStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kitting</h1>
        <p className="text-sm text-slate-500 mt-1">Pre-stage materials for work orders</p>
      </div>
      <KitBuilder workOrders={workOrders} />
    </div>
  );
}
