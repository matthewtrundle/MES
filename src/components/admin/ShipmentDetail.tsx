'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PackingListPreview } from '@/components/admin/PackingListPreview';
import { CoCPreview } from '@/components/admin/CoCPreview';
import {
  getShipmentDetails,
  shipShipment,
  generatePackingList,
  generateCertificateOfConformance,
} from '@/lib/actions/shipping';

type ShipmentDetails = Awaited<ReturnType<typeof getShipmentDetails>>;
type PackingListData = Awaited<ReturnType<typeof generatePackingList>>;
type CoCData = Awaited<ReturnType<typeof generateCertificateOfConformance>>;

interface ShipmentDetailProps {
  shipmentId: string;
  onBack: () => void;
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

export function ShipmentDetail({ shipmentId, onBack }: ShipmentDetailProps) {
  const router = useRouter();
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipping, setShipping] = useState(false);
  const [showPackingList, setShowPackingList] = useState(false);
  const [showCoC, setShowCoC] = useState(false);
  const [packingListData, setPackingListData] = useState<PackingListData | null>(null);
  const [cocData, setCocData] = useState<CoCData | null>(null);
  const [generatingPL, setGeneratingPL] = useState(false);
  const [generatingCoC, setGeneratingCoC] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const details = await getShipmentDetails(shipmentId);
        setShipment(details);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shipment');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [shipmentId]);

  const handleShip = useCallback(async () => {
    if (!shipment) return;

    setShipping(true);
    setError(null);
    try {
      await shipShipment(shipmentId);
      // Reload details
      const updated = await getShipmentDetails(shipmentId);
      setShipment(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ship');
    } finally {
      setShipping(false);
    }
  }, [shipment, shipmentId, router]);

  const handleGeneratePackingList = useCallback(async () => {
    setGeneratingPL(true);
    setError(null);
    try {
      const data = await generatePackingList(shipmentId);
      setPackingListData(data);
      setShowPackingList(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate packing list');
    } finally {
      setGeneratingPL(false);
    }
  }, [shipmentId]);

  const handleGenerateCoC = useCallback(async () => {
    setGeneratingCoC(true);
    setError(null);
    try {
      const data = await generateCertificateOfConformance(shipmentId);
      setCocData(data);
      setShowCoC(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate CoC');
    } finally {
      setGeneratingCoC(false);
    }
  }, [shipmentId]);

  if (showPackingList && packingListData) {
    return (
      <PackingListPreview
        data={packingListData}
        onBack={() => setShowPackingList(false)}
      />
    );
  }

  if (showCoC && cocData) {
    return (
      <CoCPreview
        data={cocData}
        onBack={() => setShowCoC(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-slate-500">
        Loading shipment details...
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          Back to Shipping
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error ?? 'Shipment not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const canShip = shipment.status === 'pending' || shipment.status === 'packed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Shipment {shipment.shipmentNumber}
            </h2>
            <p className="text-slate-500 text-sm">
              Work Order: {shipment.workOrder.orderNumber}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(shipment.status)}>
            {shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleGeneratePackingList}
            disabled={generatingPL}
          >
            {generatingPL ? 'Generating...' : 'Packing List'}
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateCoC}
            disabled={generatingCoC}
          >
            {generatingCoC ? 'Generating...' : 'Certificate of Conformance'}
          </Button>
          {canShip && (
            <Button
              onClick={handleShip}
              disabled={shipping}
              className="bg-green-600 hover:bg-green-700"
            >
              {shipping ? 'Shipping...' : 'Mark as Shipped'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Shipment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Shipment Number</dt>
                <dd className="font-mono font-medium">{shipment.shipmentNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <Badge variant={statusBadgeVariant(shipment.status)}>
                    {shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Carrier</dt>
                <dd>{shipment.carrier ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tracking Number</dt>
                <dd className="font-mono">{shipment.trackingNumber ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Ship Date</dt>
                <dd>
                  {shipment.shipDate
                    ? new Date(shipment.shipDate).toLocaleDateString()
                    : 'Not yet shipped'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total Boxes</dt>
                <dd>{shipment.totalBoxes ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total Weight</dt>
                <dd>
                  {shipment.totalWeight
                    ? `${shipment.totalWeight} ${shipment.weightUnit}`
                    : '-'}
                </dd>
              </div>
              {shipment.shippedBy && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Shipped By</dt>
                  <dd>{shipment.shippedBy.name}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer & Work Order</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Customer</dt>
                <dd className="font-medium">{shipment.customerName}</dd>
              </div>
              {shipment.customerAddress && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Address</dt>
                  <dd className="text-right max-w-[200px]">{shipment.customerAddress}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Work Order</dt>
                <dd className="font-medium">{shipment.workOrder.orderNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Product</dt>
                <dd>
                  {shipment.workOrder.productCode}
                  {shipment.workOrder.productName
                    ? ` - ${shipment.workOrder.productName}`
                    : ''}
                </dd>
              </div>
              {shipment.workOrder.customerOrderRef && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Customer PO</dt>
                  <dd className="font-mono">{shipment.workOrder.customerOrderRef}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Qty Ordered</dt>
                <dd>{shipment.workOrder.qtyOrdered}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Qty Completed</dt>
                <dd>{shipment.workOrder.qtyCompleted}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Special Notes */}
      {shipment.specialNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Special Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {shipment.specialNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Shipment Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Units in Shipment</CardTitle>
          <CardDescription>
            {shipment.lines.length} unit{shipment.lines.length !== 1 ? 's' : ''} included
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead className="text-center">Box Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-slate-500">{index + 1}</TableCell>
                  <TableCell className="font-mono font-medium">
                    {line.serialNumber}
                  </TableCell>
                  <TableCell className="text-center">
                    {line.boxNumber ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
