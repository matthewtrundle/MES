'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { submitPurchaseOrder, cancelPurchaseOrder } from '@/lib/actions/purchase-orders';

type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplierId: string;
  buyerName: string;
  orderDate: Date | string;
  expectedDate: Date | string | null;
  status: string;
  currency: string;
  totalValue: number | null;
  supplier: {
    id: string;
    name: string;
    supplierId: string;
  };
  _count: {
    lineItems: number;
  };
};

type Supplier = {
  id: string;
  name: string;
  supplierId: string;
};

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrderRow[];
  suppliers: Supplier[];
}

const PO_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'fully_received', label: 'Fully Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

export function PurchaseOrderTable({ purchaseOrders, suppliers }: PurchaseOrderTableProps) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = purchaseOrders.filter((po) => {
    if (filterStatus !== 'all' && po.status !== filterStatus) return false;
    if (filterSupplier !== 'all' && po.supplierId !== filterSupplier) return false;
    return true;
  });

  const handleSubmit = async (id: string) => {
    if (!confirm('Submit this purchase order? It will no longer be editable.')) return;
    setActionLoading(id);
    try {
      await submitPurchaseOrder(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit PO');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this purchase order?')) return;
    setActionLoading(id);
    try {
      await cancelPurchaseOrder(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel PO');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PO_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Supplier:</Label>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                  No purchase orders found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link
                      href={`/admin/purchase-orders/${po.id}`}
                      className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {po.poNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{po.supplier.name}</span>
                      <div className="text-xs text-slate-400 font-mono">{po.supplier.supplierId}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{po.buyerName}</TableCell>
                  <TableCell className="text-slate-600">{formatDate(po.orderDate)}</TableCell>
                  <TableCell className="text-slate-500">{formatDate(po.expectedDate)}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell className="text-right text-slate-500">
                    {po._count.lineItems}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(po.totalValue, po.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/purchase-orders/${po.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      {po.status === 'draft' && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={actionLoading === po.id}
                          onClick={() => handleSubmit(po.id)}
                        >
                          {actionLoading === po.id ? '...' : 'Submit'}
                        </Button>
                      )}
                      {po.status !== 'cancelled' && po.status !== 'closed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={actionLoading === po.id}
                          onClick={() => handleCancel(po.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
