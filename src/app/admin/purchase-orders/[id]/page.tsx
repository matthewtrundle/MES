import { getPurchaseOrder } from '@/lib/actions/purchase-orders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PurchaseOrderDetailActions } from '@/components/admin/PurchaseOrderDetailActions';
import Link from 'next/link';

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-slate-100 text-slate-700">Draft</Badge>;
    case 'submitted':
      return <Badge className="bg-blue-500">Submitted</Badge>;
    case 'partially_received':
      return <Badge className="bg-yellow-500">Partially Received</Badge>;
    case 'fully_received':
      return <Badge className="bg-green-500">Fully Received</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPurchaseOrder(id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/purchase-orders"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Purchase Orders
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-sm text-slate-500">{po.poNumber}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{po.poNumber}</h1>
          <div className="flex items-center gap-3 mt-1">
            {getStatusBadge(po.status)}
            <span className="text-slate-500">
              Supplier: {po.supplier.name}
            </span>
          </div>
        </div>
        <PurchaseOrderDetailActions
          poId={po.id}
          status={po.status}
        />
      </div>

      {/* PO Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">PO Number</span>
              <span className="text-sm font-mono font-medium">{po.poNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Order Date</span>
              <span className="text-sm">{formatDate(po.orderDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Expected Date</span>
              <span className="text-sm">{formatDate(po.expectedDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Buyer</span>
              <span className="text-sm">{po.buyerName}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Name</span>
              <span className="text-sm font-medium">{po.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Code</span>
              <span className="text-sm font-mono">{po.supplier.supplierId}</span>
            </div>
            {po.supplier.contactEmail && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Email</span>
                <span className="text-sm">{po.supplier.contactEmail}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Financial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Currency</span>
              <span className="text-sm">{po.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Total Value</span>
              <span className="text-sm font-bold">{formatCurrency(po.totalValue, po.currency)}</span>
            </div>
            {po.paymentTerms && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Payment Terms</span>
                <span className="text-sm">{po.paymentTerms}</span>
              </div>
            )}
            {po.shippingMethod && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Shipping</span>
                <span className="text-sm">{po.shippingMethod}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            {po.lineItems.length} line item{po.lineItems.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Lead Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-slate-500 py-8">
                      No line items
                    </TableCell>
                  </TableRow>
                ) : (
                  po.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-slate-500">{item.lineNumber}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-mono font-medium">{item.partNumber}</span>
                          {item.partRevision && (
                            <span className="text-xs text-slate-400 ml-1">Rev {item.partRevision}</span>
                          )}
                        </div>
                        {item.supplierPartNumber && (
                          <div className="text-xs text-slate-400">
                            Supplier: {item.supplierPartNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.qtyOrdered}</TableCell>
                      <TableCell className="text-right">
                        <span className={
                          item.qtyReceived >= item.qtyOrdered
                            ? 'text-green-600 font-medium'
                            : item.qtyReceived > 0
                              ? 'text-yellow-600 font-medium'
                              : 'text-slate-400'
                        }>
                          {item.qtyReceived}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500">{item.unitOfMeasure}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitCost, po.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalCost, po.currency)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {item.countryOfOrigin || '-'}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {item.expectedLeadTimeDays != null
                          ? `${item.expectedLeadTimeDays}d`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
