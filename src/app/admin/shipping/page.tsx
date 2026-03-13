import { getShippableWorkOrders, getShipments } from '@/lib/actions/shipping';
import { ShippingDashboard } from '@/components/admin/ShippingDashboard';

export const dynamic = 'force-dynamic';

export default async function ShippingPage() {
  const [shippableWorkOrders, shipmentsResult] = await Promise.all([
    getShippableWorkOrders(),
    getShipments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shipping</h1>
        <p className="text-slate-500 mt-1">
          Create shipments, generate packing lists, and manage outbound logistics
        </p>
      </div>

      <ShippingDashboard
        initialShippableWorkOrders={shippableWorkOrders}
        initialShipments={shipmentsResult.shipments}
      />
    </div>
  );
}
