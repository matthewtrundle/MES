'use client';

import { useEffect, useState } from 'react';
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
import { createWorkOrder, releaseWorkOrder, completeWorkOrder } from '@/lib/actions/work-orders';
import { prisma } from '@/lib/db/prisma';

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
  createdAt: Date;
  siteId: string;
  routingId: string | null;
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

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'released':
      return 'default';
    case 'in_progress':
      return 'default';
    case 'completed':
      return 'default';
    default:
      return 'outline';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-slate-500';
    case 'released':
      return 'bg-blue-500';
    case 'in_progress':
      return 'bg-yellow-500';
    case 'completed':
      return 'bg-green-500';
    default:
      return '';
  }
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedRouting, setSelectedRouting] = useState('');

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/work-orders');
        const data = await response.json();
        setWorkOrders(data.workOrders || []);
        setSites(data.sites || []);
        setRoutings(data.routings || []);
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

    const formData = new FormData(e.currentTarget);

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
      });

      setCreateOpen(false);
      (e.target as HTMLFormElement).reset();

      // Refresh data
      const response = await fetch('/api/admin/work-orders');
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async (workOrderId: string) => {
    try {
      await releaseWorkOrder(workOrderId);
      // Refresh data
      const response = await fetch('/api/admin/work-orders');
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to release work order');
    }
  };

  const handleComplete = async (workOrderId: string) => {
    try {
      await completeWorkOrder(workOrderId);
      // Refresh data
      const response = await fetch('/api/admin/work-orders');
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to complete work order');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-slate-500 mt-1">
            Create and manage production work orders
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Work Order</DialogTitle>
              <DialogDescription>
                Create a new production work order
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

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Status Filter</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="released">Released</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Work Orders</CardTitle>
          <CardDescription>
            {filteredWorkOrders.length} work order{filteredWorkOrders.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' ? ` (${statusFilter})` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Product</TableHead>
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
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    No work orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell className="font-mono font-medium">
                      {wo.orderNumber}
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
                      <Badge
                        variant={getStatusBadgeVariant(wo.status)}
                        className={getStatusColor(wo.status)}
                      >
                        {wo.status.replace('_', ' ')}
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
                      <div className="flex justify-end gap-2">
                        {wo.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRelease(wo.id)}
                            >
                              Release
                            </Button>
                          </>
                        )}
                        {(wo.status === 'released' || wo.status === 'in_progress') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleComplete(wo.id)}
                          >
                            Complete
                          </Button>
                        )}
                        {wo.status === 'completed' && (
                          <span className="text-sm text-slate-400">Done</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
