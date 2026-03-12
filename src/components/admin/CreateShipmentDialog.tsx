'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  getWorkOrderShippingDetails,
  createShipment,
} from '@/lib/actions/shipping';

type WorkOrderDetails = Awaited<ReturnType<typeof getWorkOrderShippingDetails>>;
type UnitWithShipStatus = WorkOrderDetails['units'][number];

interface CreateShipmentDialogProps {
  workOrderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateShipmentDialog({
  workOrderId,
  open,
  onOpenChange,
}: CreateShipmentDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetails | null>(null);

  // Form state
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [totalBoxes, setTotalBoxes] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [specialNotes, setSpecialNotes] = useState('');
  const [boxAssignments, setBoxAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      setError(null);
      try {
        const details = await getWorkOrderShippingDetails(workOrderId);
        setWorkOrder(details);

        // Auto-select all shippable (completed, not already shipped) units
        const shippableUnits = details.units.filter(
          (u) => u.status === 'completed' && !u.alreadyShipped
        );
        setSelectedUnitIds(new Set(shippableUnits.map((u) => u.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load work order details');
      } finally {
        setLoading(false);
      }
    }

    if (open && workOrderId) {
      loadDetails();
    }
  }, [open, workOrderId]);

  const shippableUnits = workOrder?.units.filter(
    (u) => u.status === 'completed' && !u.alreadyShipped
  ) ?? [];

  const toggleUnit = useCallback((unitId: string) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedUnitIds(new Set(shippableUnits.map((u) => u.id)));
  }, [shippableUnits]);

  const deselectAll = useCallback(() => {
    setSelectedUnitIds(new Set());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!workOrder) return;
    if (selectedUnitIds.size === 0) {
      setError('Please select at least one unit to ship');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedUnits = workOrder.units.filter((u) => selectedUnitIds.has(u.id));

      await createShipment({
        workOrderId: workOrder.id,
        customerName: workOrder.customerName ?? 'Unknown Customer',
        customerAddress: undefined,
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
        totalBoxes: totalBoxes ? parseInt(totalBoxes, 10) : undefined,
        totalWeight: totalWeight ? parseFloat(totalWeight) : undefined,
        weightUnit,
        specialNotes: specialNotes || undefined,
        lines: selectedUnits.map((unit) => ({
          unitId: unit.id,
          serialNumber: unit.serialNumber,
          boxNumber: boxAssignments[unit.id]
            ? parseInt(boxAssignments[unit.id], 10)
            : undefined,
        })),
      });

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shipment');
    } finally {
      setSubmitting(false);
    }
  }, [workOrder, selectedUnitIds, carrier, trackingNumber, totalBoxes, totalWeight, weightUnit, specialNotes, boxAssignments, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Shipment</DialogTitle>
          <DialogDescription>
            {workOrder
              ? `Create a shipment for work order ${workOrder.orderNumber}`
              : 'Loading work order details...'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="py-8 text-center text-slate-500">
            Loading work order details...
          </div>
        ) : workOrder ? (
          <div className="space-y-6">
            {/* Work Order Info */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Work Order:</span>{' '}
                  <span className="font-medium">{workOrder.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">Product:</span>{' '}
                  <span className="font-medium">
                    {workOrder.productCode}
                    {workOrder.productName ? ` - ${workOrder.productName}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Customer:</span>{' '}
                  <span className="font-medium">
                    {workOrder.customerName ?? 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Customer Ref:</span>{' '}
                  <span className="font-medium">
                    {workOrder.customerOrderRef ?? '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Unit Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">
                  Select Units to Ship ({selectedUnitIds.size} of{' '}
                  {shippableUnits.length} selected)
                </Label>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {shippableUnits.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    No units available for shipment
                  </div>
                ) : (
                  shippableUnits.map((unit: UnitWithShipStatus) => (
                    <div
                      key={unit.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={selectedUnitIds.has(unit.id)}
                        onCheckedChange={() => toggleUnit(unit.id)}
                      />
                      <div className="flex-1">
                        <span className="font-mono text-sm font-medium">
                          {unit.serialNumber}
                        </span>
                      </div>
                      <div>
                        {unit.eolResult ? (
                          <Badge
                            variant={
                              unit.eolResult.compositeResult === 'pass'
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            EOL: {unit.eolResult.compositeResult.toUpperCase()}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No EOL Test</Badge>
                        )}
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          placeholder="Box #"
                          min={1}
                          value={boxAssignments[unit.id] ?? ''}
                          onChange={(e) =>
                            setBoxAssignments((prev) => ({
                              ...prev,
                              [unit.id]: e.target.value,
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Shipping Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., FedEx, UPS, DHL"
                />
              </div>
              <div>
                <Label htmlFor="trackingNumber">Tracking Number</Label>
                <Input
                  id="trackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
              <div>
                <Label htmlFor="totalBoxes">Total Boxes</Label>
                <Input
                  id="totalBoxes"
                  type="number"
                  min={1}
                  value={totalBoxes}
                  onChange={(e) => setTotalBoxes(e.target.value)}
                  placeholder="Number of boxes"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="totalWeight">Total Weight</Label>
                  <Input
                    id="totalWeight"
                    type="number"
                    min={0}
                    step={0.1}
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value)}
                    placeholder="Weight"
                  />
                </div>
                <div className="w-20">
                  <Label htmlFor="weightUnit">Unit</Label>
                  <select
                    id="weightUnit"
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="specialNotes">Special Notes</Label>
              <Textarea
                id="specialNotes"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any special handling or delivery instructions..."
                rows={3}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || selectedUnitIds.size === 0}
          >
            {submitting ? 'Creating...' : 'Create Shipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
