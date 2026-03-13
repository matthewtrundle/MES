import { getPurchaseOrders } from '@/lib/actions/purchase-orders';
import { getSuppliers } from '@/lib/actions/admin/suppliers';
import { PurchaseOrderTable } from '@/components/admin/PurchaseOrderTable';
import { PurchaseOrderForm } from '@/components/admin/PurchaseOrderForm';
import { POImportDialog } from '@/components/admin/POImportDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PurchaseOrdersPage() {
  const [purchaseOrders, suppliers] = await Promise.all([
    getPurchaseOrders(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">
            Create and manage purchase orders for materials procurement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <POImportDialog />
          <PurchaseOrderForm suppliers={suppliers} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
          <CardDescription>
            {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''} in system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseOrderTable purchaseOrders={purchaseOrders} suppliers={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
