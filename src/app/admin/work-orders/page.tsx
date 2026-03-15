'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createWorkOrder,
  releaseWorkOrder,
  completeWorkOrder,
  submitWorkOrder,
  startKitting,
  startProduction,
  startTesting,
  shipWorkOrder,
  cancelWorkOrder,
} from '@/lib/actions/work-orders';

interface WorkOrder {
  id: string;
  orderNumber: string;
  productCode: string;
  productName: string | null;
  qtyOrdered: number;
  qtyCompleted: number;
  status: string;
  priority: number;
  dueDate: Date | null;
  releasedAt: Date | null;
  completedAt: Date | null;
  shippedAt: Date | null;
  kittingStartedAt: Date | null;
  testingStartedAt: Date | null;
  draftedAt: Date | null;
  createdAt: Date;
  siteId: string;
  routingId: string | null;
  // P1.7: Customer fields
  customerName: string | null;
  customerOrderRef: string | null;
  targetStartDate: Date | null;
  notes: string | null;
  site?: { name: string };
  routing?: { name: string } | null;
  _count?: { units: number };
}

interface Site {
  id: string;
  name: string;
}

interface Routing {
  id: string;
  name: string;
}

// P1.6: All 8 statuses + cancelled
const ALL_STATUSES = [
  'draft',
  'pending',
  'released',
  'kitting',
  'in_progress',
  'in_testing',
  'completed',
  'shipped',
  'cancelled',
] as const;

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-400';
    case 'pending':
      return 'bg-slate-500';
    case 'released':
      return 'bg-blue-500';
    case 'kitting':
      return 'bg-indigo-500';
    case 'in_progress':
      return 'bg-yellow-500';
    case 'in_testing':
      return 'bg-purple-500';
    case 'completed':
      return 'bg-green-500';
    case 'shipped':
      return 'bg-emerald-600';
    case 'cancelled':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

function getStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedRouting, setSelectedRouting] = useState('');

  const refreshData = async () => {
    try {
      const response = await fetch('/api/admin/work-orders');
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
      setSites(data.sites || []);
      setRoutings(data.routings || []);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/work-orders');
        const data = await response.json();
        setWorkOrders(data.workOrders || []);
        setSites(data.sites || []);
        setRoutings(data.routings || []);
        // Auto-select first site/routing so dropdowns aren't empty
        if (data.sites?.[0]) {
          setSelectedSite(data.sites[0].id);
        }
        if (data.routings?.[0]) {
          setSelectedRouting(data.routings[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredWorkOrders = statusFilter === 'all'
    ? workOrders
    : workOrders.filter((wo) => wo.status === statusFilter);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);

    if (!selectedSite) {
      setActionError('Please select a site');
      setIsSubmitting(false);
      return;
    }

    try {
      await createWorkOrder({
        siteId: selectedSite,
        orderNumber: formData.get('orderNumber') as string,
        productCode: formData.get('productCode') as string,
        productName: formData.get('productName') as string || undefined,
        qtyOrdered: parseInt(formData.get('qtyOrdered') as string, 10),
        routingId: selectedRouting || undefined,
        priority: parseInt(formData.get('priority') as string, 10) || 0,
        dueDate: formData.get('dueDate') ? new Date(formData.get('dueDate') as string) : undefined,
        // P1.7: Customer fields
        customerName: formData.get('customerName') as string || undefined,
        customerOrderRef: formData.get('customerOrderRef') as string || undefined,
        targetStartDate: formData.get('targetStartDate')
          ? new Date(formData.get('targetStartDate') as string)
          : undefined,
        notes: formData.get('notes') as string || undefined,
      });

      setCreateOpen(false);
      (e.target as HTMLFormElement).reset();
      await refreshData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusAction = async (
    workOrderId: string,
    action: (id: string) => Promise<unknown>,
    errorPrefix: string
  ) => {
    setActionError(null);
    try {
      const result = await action(workOrderId);
      await refreshData();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : `${errorPrefix} failed`;
      setActionError(msg);
      return null;
    }
  };

  const handleCancel = async (workOrderId: string) => {
    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;
    setActionError(null);
    try {
      await cancelWorkOrder(workOrderId, reason);
      await refreshData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to cancel');
    }
  };

  // Get available actions for a work order based on its status
  function getAvailableActions(wo: WorkOrder) {
    const actions: Array<{
      label: string;
      action: () => void;
      variant?: 'default' | 'outline' | 'destructive';
    }> = [];

    switch (wo.status) {
      case 'draft':
        actions.push({
          label: 'Submit',
          action: () => handleStatusAction(wo.id, submitWorkOrder, 'Submit'),
          variant: 'outline',
        });
        break;
      case 'pending':
        actions.push({
          label: 'Release',
          action: () => handleStatusAction(wo.id, releaseWorkOrder, 'Release'),
          variant: 'default',
        });
        break;
      case 'released':
        actions.push({
          label: 'Start Kitting',
          action: () => handleStatusAction(wo.id, startKitting, 'Start Kitting'),
          variant: 'outline',
        });
        actions.push({
          label: 'Start Production',
          action: () => handleStatusAction(wo.id, startProduction, 'Start Production'),
          variant: 'outline',
        });
        break;
      case 'kitting':
        actions.push({
          label: 'Start Production',
          action: () => handleStatusAction(wo.id, startProduction, 'Start Production'),
          variant: 'default',
        });
        break;
      case 'in_progress':
        actions.push({
          label: 'Start Testing',
          action: () => handleStatusAction(wo.id, startTesting, 'Start Testing'),
          variant: 'outline',
        });
        actions.push({
          label: 'Complete',
          action: () => handleStatusAction(wo.id, completeWorkOrder, 'Complete'),
          variant: 'default',
        });
        break;
      case 'in_testing':
        actions.push({
          label: 'Complete',
          action: () => handleStatusAction(wo.id, completeWorkOrder, 'Complete'),
          variant: 'default',
        });
        break;
      case 'completed':
        actions.push({
          label: 'Ship',
          action: () => handleStatusAction(wo.id, shipWorkOrder, 'Ship'),
          variant: 'default',
        });
        break;
    }

    // Cancel is available from any non-terminal state
    if (!['cancelled', 'shipped'].includes(wo.status)) {
      actions.push({
        label: 'Cancel',
        action: () => handleCancel(wo.id),
        variant: 'destructive',
      });
    }

    return actions;
  }

  function TravelerLink({ workOrderId }: { workOrderId: string }) {
    return (
      <Link href={`/dashboard/traveler/${workOrderId}`}>
        <Button variant="outline" size="sm">
          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Traveler
        </Button>
      </Link>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Work Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage production work orders
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            // Ensure defaults are set when dialog opens
            if (!selectedSite && sites.length > 0) setSelectedSite(sites[0].id);
            if (!selectedRouting && routings.length > 0) setSelectedRouting(routings[0].id);
            setActionError(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Work Order</DialogTitle>
              <DialogDescription>
                Create a new production work order (starts in draft status)
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orderNumber">Order Number</Label>
                    <Input
                      id="orderNumber"
                      name="orderNumber"
                      placeholder="e.g., WO-1002"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productCode">Product Code</Label>
                    <Input
                      id="productCode"
                      name="productCode"
                      placeholder="e.g., MOTOR-STD-001"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    name="productName"
                    placeholder="e.g., Standard Motor Assembly"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qtyOrdered">Quantity</Label>
                    <Input
                      id="qtyOrdered"
                      name="qtyOrdered"
                      type="number"
                      min="1"
                      placeholder="10"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      name="priority"
                      type="number"
                      min="0"
                      defaultValue="0"
                    />
                    <p className="text-xs text-slate-500">
                      Higher = more urgent
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select value={selectedSite} onValueChange={setSelectedSite}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Routing</Label>
                    <Select value={selectedRouting} onValueChange={setSelectedRouting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select routing" />
                      </SelectTrigger>
                      <SelectContent>
                        {routings.map((routing) => (
                          <SelectItem key={routing.id} value={routing.id}>
                            {routing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetStartDate">Target Start Date</Label>
                    <Input
                      id="targetStartDate"
                      name="targetStartDate"
                      type="date"
                    />
                  </div>
                </div>

                {/* P1.7: Customer Fields */}
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Customer Information</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        name="customerName"
                        placeholder="e.g., Acme Corp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerOrderRef">Customer PO / Order Ref</Label>
                      <Input
                        id="customerOrderRef"
                        name="customerOrderRef"
                        placeholder="e.g., PO-12345"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Any additional notes or instructions..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Work Order'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{actionError}</p>
          <button
            className="text-xs text-red-500 underline mt-1"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Status Filter</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {getStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 text-sm text-slate-500">
          {filteredWorkOrders.length} work order{filteredWorkOrders.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' ? ` (${getStatusLabel(statusFilter)})` : ''}
        </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    No work orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell className="font-mono font-medium">
                      <button
                        className="text-blue-600 hover:underline cursor-pointer"
                        onClick={() => {
                          setSelectedWO(wo);
                          setDetailOpen(true);
                        }}
                      >
                        {wo.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{wo.productCode}</span>
                        {wo.productName && (
                          <p className="text-sm text-slate-500">{wo.productName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {wo.customerName ? (
                        <div>
                          <span className="text-sm">{wo.customerName}</span>
                          {wo.customerOrderRef && (
                            <p className="text-xs text-slate-400">{wo.customerOrderRef}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        {wo.qtyCompleted} / {wo.qtyOrdered}
                      </span>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(100, (wo.qtyCompleted / wo.qtyOrdered) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(wo.status)} text-white`}>
                        {getStatusLabel(wo.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {wo.priority > 0 ? (
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
                          P{wo.priority}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">Normal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {wo.dueDate ? (
                        <span className="text-sm">
                          {new Date(wo.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <TravelerLink workOrderId={wo.id} />
                        {getAvailableActions(wo).map((act) => (
                          <Button
                            key={act.label}
                            variant={act.variant || 'outline'}
                            size="sm"
                            onClick={act.action}
                          >
                            {act.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>

      {/* Work Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Work Order Detail</DialogTitle>
            <DialogDescription>
              {selectedWO?.orderNumber} - {selectedWO?.productCode}
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-4 py-2">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Status:</span>
                <Badge className={`${getStatusColor(selectedWO.status)} text-white`}>
                  {getStatusLabel(selectedWO.status)}
                </Badge>
              </div>

              {/* Product info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Product Code:</span>
                  <p className="font-medium">{selectedWO.productCode}</p>
                </div>
                <div>
                  <span className="text-slate-500">Product Name:</span>
                  <p className="font-medium">{selectedWO.productName || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Quantity:</span>
                  <p className="font-medium">{selectedWO.qtyCompleted} / {selectedWO.qtyOrdered}</p>
                </div>
                <div>
                  <span className="text-slate-500">Priority:</span>
                  <p className="font-medium">{selectedWO.priority > 0 ? `P${selectedWO.priority}` : 'Normal'}</p>
                </div>
              </div>

              {/* Customer info (P1.7) */}
              {(selectedWO.customerName || selectedWO.customerOrderRef || selectedWO.notes) && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Customer Information</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Customer:</span>
                      <p className="font-medium">{selectedWO.customerName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Customer PO:</span>
                      <p className="font-medium">{selectedWO.customerOrderRef || '-'}</p>
                    </div>
                  </div>
                  {selectedWO.notes && (
                    <div className="mt-2 text-sm">
                      <span className="text-slate-500">Notes:</span>
                      <p className="mt-1 bg-slate-50 p-2 rounded text-slate-700">
                        {selectedWO.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Dates & Timeline (P1.6) */}
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Timeline</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedWO.draftedAt && (
                    <div>
                      <span className="text-slate-500">Drafted:</span>
                      <p>{new Date(selectedWO.draftedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.releasedAt && (
                    <div>
                      <span className="text-slate-500">Released:</span>
                      <p>{new Date(selectedWO.releasedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.kittingStartedAt && (
                    <div>
                      <span className="text-slate-500">Kitting Started:</span>
                      <p>{new Date(selectedWO.kittingStartedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.testingStartedAt && (
                    <div>
                      <span className="text-slate-500">Testing Started:</span>
                      <p>{new Date(selectedWO.testingStartedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.completedAt && (
                    <div>
                      <span className="text-slate-500">Completed:</span>
                      <p>{new Date(selectedWO.completedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.shippedAt && (
                    <div>
                      <span className="text-slate-500">Shipped:</span>
                      <p>{new Date(selectedWO.shippedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedWO.dueDate && (
                    <div>
                      <span className="text-slate-500">Due Date:</span>
                      <p>{new Date(selectedWO.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedWO.targetStartDate && (
                    <div>
                      <span className="text-slate-500">Target Start:</span>
                      <p>{new Date(selectedWO.targetStartDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-3 flex gap-2 flex-wrap">
                {getAvailableActions(selectedWO).map((act) => (
                  <Button
                    key={act.label}
                    variant={act.variant || 'outline'}
                    size="sm"
                    onClick={() => {
                      act.action();
                      setDetailOpen(false);
                    }}
                  >
                    {act.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
