'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  createKitForWorkOrder,
  getKitForWorkOrder,
  issueKit,
} from '@/lib/actions/kitting';
import { KitPickDialog } from './KitPickDialog';

type WorkOrder = {
  id: string;
  orderNumber: string;
  productCode: string;
  productName: string | null;
  qtyOrdered: number;
  status: string;
  routing: { name: string } | null;
  kit: {
    id: string;
    status: string;
    issuedAt: Date | string | null;
    _count: { lines: number };
  } | null;
};

type KitLine = {
  id: string;
  materialCode: string;
  description: string | null;
  qtyRequired: number;
  qtyPicked: number;
  materialLot: { lotNumber: string; qtyRemaining: number; expiresAt: Date | string | null } | null;
  pickedBy: { name: string | null } | null;
};

type KitDetail = {
  id: string;
  status: string;
  lines: KitLine[];
  createdBy: { name: string | null } | null;
  issuedBy: { name: string | null } | null;
};

interface KitBuilderProps {
  workOrders: WorkOrder[];
}

function getKitStatusBadge(kit: WorkOrder['kit']) {
  if (!kit) {
    return <Badge variant="secondary">No Kit</Badge>;
  }

  switch (kit.status) {
    case 'pending':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Pending</Badge>;
    case 'in_progress':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>;
    case 'complete':
      return <Badge className="bg-green-500 hover:bg-green-600">Complete</Badge>;
    case 'issued':
      return <Badge className="bg-purple-500 hover:bg-purple-600">Issued</Badge>;
    default:
      return <Badge variant="outline">{kit.status}</Badge>;
  }
}

function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'released':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Released</Badge>;
    case 'in_progress':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function KitBuilder({ workOrders }: KitBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [kitDetail, setKitDetail] = useState<KitDetail | null>(null);
  const [isLoadingKit, setIsLoadingKit] = useState(false);
  const [pickingLine, setPickingLine] = useState<KitLine | null>(null);

  const handleCreateKit = (workOrderId: string) => {
    startTransition(async () => {
      try {
        await createKitForWorkOrder(workOrderId);
        toast.success('Kit created successfully');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create kit');
      }
    });
  };

  const handleIssueKit = (kitId: string) => {
    startTransition(async () => {
      try {
        await issueKit(kitId);
        toast.success('Kit issued successfully');
        router.refresh();
        setExpandedOrderId(null);
        setKitDetail(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to issue kit');
      }
    });
  };

  const handleToggleExpand = async (workOrderId: string) => {
    if (expandedOrderId === workOrderId) {
      setExpandedOrderId(null);
      setKitDetail(null);
      return;
    }

    setExpandedOrderId(workOrderId);
    setIsLoadingKit(true);

    try {
      const kit = await getKitForWorkOrder(workOrderId);
      setKitDetail(kit);
    } catch {
      toast.error('Failed to load kit details');
      setKitDetail(null);
    } finally {
      setIsLoadingKit(false);
    }
  };

  const handlePickComplete = async () => {
    setPickingLine(null);
    // Reload kit detail
    if (expandedOrderId) {
      try {
        const kit = await getKitForWorkOrder(expandedOrderId);
        setKitDetail(kit);
      } catch {
        // Silently fail on reload
      }
    }
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Work Orders</CardTitle>
          <CardDescription>
            {workOrders.length} work order{workOrders.length !== 1 ? 's' : ''} available for kitting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kit Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                      No work orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  workOrders.map((wo) => (
                    <>
                      <TableRow key={wo.id}>
                        <TableCell className="font-mono font-medium">{wo.orderNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{wo.productName || wo.productCode}</div>
                            {wo.routing && (
                              <div className="text-xs text-slate-500">{wo.routing.name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{wo.qtyOrdered}</TableCell>
                        <TableCell>{getOrderStatusBadge(wo.status)}</TableCell>
                        <TableCell>{getKitStatusBadge(wo.kit)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!wo.kit && (
                              <Button
                                size="sm"
                                onClick={() => handleCreateKit(wo.id)}
                                disabled={isPending}
                              >
                                {isPending ? 'Creating...' : 'Create Kit'}
                              </Button>
                            )}
                            {wo.kit && wo.kit.status !== 'issued' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleExpand(wo.id)}
                              >
                                {expandedOrderId === wo.id ? 'Hide Kit' : 'View Kit'}
                              </Button>
                            )}
                            {wo.kit && wo.kit.status === 'complete' && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={() => handleIssueKit(wo.kit!.id)}
                                disabled={isPending}
                              >
                                {isPending ? 'Issuing...' : 'Issue Kit'}
                              </Button>
                            )}
                            {wo.kit && wo.kit.status === 'issued' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleExpand(wo.id)}
                              >
                                {expandedOrderId === wo.id ? 'Hide' : 'View'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded kit detail row */}
                      {expandedOrderId === wo.id && (
                        <TableRow key={`${wo.id}-detail`}>
                          <TableCell colSpan={6} className="bg-slate-50 p-0">
                            <div className="p-4">
                              {isLoadingKit ? (
                                <div className="text-center text-slate-500 py-4">Loading kit details...</div>
                              ) : !kitDetail ? (
                                <div className="text-center text-slate-500 py-4">No kit found</div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-slate-700">
                                      Kit Lines ({kitDetail.lines.length})
                                    </h4>
                                    {kitDetail.createdBy && (
                                      <span className="text-xs text-slate-500">
                                        Created by {kitDetail.createdBy.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="rounded-lg border bg-white">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Material Code</TableHead>
                                          <TableHead>Description</TableHead>
                                          <TableHead className="text-right">Qty Required</TableHead>
                                          <TableHead className="text-right">Qty Picked</TableHead>
                                          <TableHead>Lot #</TableHead>
                                          <TableHead>Picked By</TableHead>
                                          <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {kitDetail.lines.map((line) => (
                                          <TableRow key={line.id}>
                                            <TableCell className="font-mono text-sm">{line.materialCode}</TableCell>
                                            <TableCell className="text-slate-500 text-sm">{line.description || '-'}</TableCell>
                                            <TableCell className="text-right font-mono">{line.qtyRequired}</TableCell>
                                            <TableCell className="text-right font-mono">
                                              <span className={line.qtyPicked >= line.qtyRequired ? 'text-green-600' : 'text-orange-600'}>
                                                {line.qtyPicked}
                                              </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                              {line.materialLot?.lotNumber || '-'}
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-sm">
                                              {line.pickedBy?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {line.qtyPicked < line.qtyRequired && kitDetail.status !== 'issued' && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => setPickingLine(line)}
                                                >
                                                  Pick
                                                </Button>
                                              )}
                                              {line.qtyPicked >= line.qtyRequired && (
                                                <Badge className="bg-green-500">Done</Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pick dialog */}
      {pickingLine && (
        <KitPickDialog
          kitLine={pickingLine}
          onClose={handlePickComplete}
        />
      )}
    </>
  );
}
