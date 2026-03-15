import { getShippableWorkOrders, getShipments } from '@/lib/actions/shipping';
import { ShippingDashboard } from '@/components/admin/ShippingDashboard';

export default async function ShippingPage() {
  const [shippableWorkOrders, shipmentsResult] = await Promise.all([
    getShippableWorkOrders(),
    getShipments(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Shipping</h1>
        <p className="text-sm text-slate-500 mt-0.5">
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
