'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { receiveMaterialLot } from '@/lib/actions/material-receiving';

export function MaterialReceivingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'available' | 'quarantine'>('available');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;

    startTransition(async () => {
      try {
        const expiresAtValue = formData.get('expiresAt') as string;

        await receiveMaterialLot({
          lotNumber: formData.get('lotNumber') as string,
          materialCode: formData.get('materialCode') as string,
          description: (formData.get('description') as string) || undefined,
          qtyReceived: parseFloat(formData.get('qtyReceived') as string),
          unitOfMeasure: (formData.get('unitOfMeasure') as string) || 'EA',
          supplier: (formData.get('supplier') as string) || undefined,
          purchaseOrderNumber: (formData.get('purchaseOrderNumber') as string) || undefined,
          expiresAt: expiresAtValue ? new Date(expiresAtValue) : undefined,
          status,
        });

        toast.success('Material lot received successfully');
        form.reset();
        setStatus('available');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to receive material lot');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive New Lot</CardTitle>
        <CardDescription>Enter details for the incoming material lot</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot Number *</Label>
              <Input
                id="lotNumber"
                name="lotNumber"
                placeholder="e.g., LOT-2026-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialCode">Material Code *</Label>
              <Input
                id="materialCode"
                name="materialCode"
                placeholder="e.g., MAG-WIRE-22AWG"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="e.g., 22 AWG Magnet Wire"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qtyReceived">Qty Received *</Label>
              <Input
                id="qtyReceived"
                name="qtyReceived"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 100"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Input
                id="unitOfMeasure"
                name="unitOfMeasure"
                defaultValue="EA"
                placeholder="e.g., EA, KG, M"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                name="supplier"
                placeholder="e.g., Acme Supplies"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseOrderNumber">PO Number</Label>
              <Input
                id="purchaseOrderNumber"
                name="purchaseOrderNumber"
                placeholder="e.g., PO-2026-0042"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires At</Label>
              <Input
                id="expiresAt"
                name="expiresAt"
                type="date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'available' | 'quarantine')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Receiving...' : 'Receive Lot'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
