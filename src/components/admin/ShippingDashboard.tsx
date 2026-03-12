'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateShipmentDialog } from '@/components/admin/CreateShipmentDialog';
import { ShipmentDetail } from '@/components/admin/ShipmentDetail';
import type { getShippableWorkOrders, getShipments } from '@/lib/actions/shipping';

type ShippableWorkOrder = Awaited<ReturnType<typeof getShippableWorkOrders>>[number];
type ShipmentRow = Awaited<ReturnType<typeof getShipments>>['shipments'][number];

interface ShippingDashboardProps {
  initialShippableWorkOrders: ShippableWorkOrder[];
  initialShipments: ShipmentRow[];
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'pending':
      return 'outline' as const;
    case 'packed':
      return 'secondary' as const;
    case 'shipped':
      return 'default' as const;
    case 'delivered':
      return 'default' as const;
    default:
      return 'outline' as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'packed':
      return 'Packed';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    default:
      return status;
  }
}

export function ShippingDashboard({
  initialShippableWorkOrders,
  initialShipments,
}: ShippingDashboardProps) {
  const [shippableWorkOrders] = useState(initialShippableWorkOrders);
  const [shipments] = useState(initialShipments);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateShipment = useCallback((workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
    setShowCreateDialog(true);
  }, []);

  const handleViewShipment = useCallback((shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
  }, []);

  if (selectedShipmentId) {
    return (
      <ShipmentDetail
        shipmentId={selectedShipmentId}
        onBack={() => setSelectedShipmentId(null)}
      />
    );
  }

  return (
    <>
      <Tabs defaultValue="ready" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ready">
            Ready to Ship ({shippableWorkOrders.length})
          </TabsTrigger>
          <TabsTrigger value="shipments">
            Shipments ({shipments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready">
          <Card>
            <CardHeader>
              <CardTitle>Work Orders Ready to Ship</CardTitle>
              <CardDescription>
                Completed work orders with units available for shipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shippableWorkOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No work orders are ready for shipping. Work orders must be in
                  &quot;completed&quot; status with finished units.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-center">Units Ready</TableHead>
                      <TableHead className="text-center">Total Units</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shippableWorkOrders.map((wo) => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-medium">
                          {wo.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{wo.productCode}</span>
                            {wo.productName && (
                              <span className="text-slate-500 ml-2 text-sm">
                                {wo.productName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{wo.customerName ?? '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {wo.unshippedUnitCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {wo.totalUnitCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleCreateShipment(wo.id)}
                          >
                            Create Shipment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments">
          <Card>
            <CardHeader>
              <CardTitle>All Shipments</CardTitle>
              <CardDescription>
                {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} in
                the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No shipments have been created yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-center">Units</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ship Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium font-mono">
                          {shipment.shipmentNumber}
                        </TableCell>
                        <TableCell>
                          {shipment.workOrder.orderNumber}
                        </TableCell>
                        <TableCell>{shipment.customerName}</TableCell>
                        <TableCell>{shipment.carrier ?? '-'}</TableCell>
                        <TableCell className="text-center">
                          {shipment._count.lines}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(shipment.status)}>
                            {statusLabel(shipment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {shipment.shipDate
                            ? new Date(shipment.shipDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewShipment(shipment.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCreateDialog && selectedWorkOrderId && (
        <CreateShipmentDialog
          workOrderId={selectedWorkOrderId}
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) setSelectedWorkOrderId(null);
          }}
        />
      )}
    </>
  );
}
