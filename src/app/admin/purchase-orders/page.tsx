import { getPurchaseOrders } from '@/lib/actions/purchase-orders';
import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { PurchaseOrderTable } from '@/components/admin/PurchaseOrderTable';
import { PurchaseOrderForm } from '@/components/admin/PurchaseOrderForm';
import { POImportDialog } from '@/components/admin/POImportDialog';

export default async function PurchaseOrdersPage() {
  const [purchaseOrders, suppliers] = await Promise.all([
    getPurchaseOrders(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''} in system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <POImportDialog />
          <PurchaseOrderForm suppliers={suppliers} />
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <PurchaseOrderTable purchaseOrders={purchaseOrders} suppliers={suppliers} />
      </div>
    </div>
  );
}
