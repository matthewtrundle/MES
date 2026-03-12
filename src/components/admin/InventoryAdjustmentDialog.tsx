'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adjustInventory } from '@/lib/actions/inventory-adjustment';

interface InventoryAdjustmentDialogProps {
  lotId: string;
  currentQty: number;
  materialCode: string;
  lotNumber: string;
  onClose: () => void;
}

export function InventoryAdjustmentDialog({
  lotId,
  currentQty,
  materialCode,
  lotNumber,
  onClose,
}: InventoryAdjustmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [newQty, setNewQty] = useState(currentQty.toString());
  const [reason, setReason] = useState('');

  const parsedQty = parseFloat(newQty);
  const isValidQty = !isNaN(parsedQty) && parsedQty >= 0;
  const delta = isValidQty ? parsedQty - currentQty : 0;

  const handleSubmit = () => {
    if (!isValidQty || !reason.trim()) return;

    startTransition(async () => {
      try {
        await adjustInventory({
          lotId,
          newQty: parsedQty,
          reason: reason.trim(),
        });
        toast.success('Inventory adjusted successfully');
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to adjust inventory'
        );
      }
    });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Adjust quantity for lot{' '}
            <span className="font-mono font-medium">{lotNumber}</span> (
            {materialCode})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current vs New Qty */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Current Quantity</span>
              <span className="font-mono font-medium text-lg">
                {currentQty}
              </span>
            </div>
            {isValidQty && delta !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Change</span>
                <span
                  className={`font-mono font-medium text-lg ${
                    delta > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              </div>
            )}
          </div>

          {/* New Quantity */}
          <div className="space-y-2">
            <Label htmlFor="newQty">New Quantity</Label>
            <Input
              id="newQty"
              type="number"
              step="0.01"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="text-lg h-12"
              autoFocus
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cycle count correction, damaged material"
              className="h-12"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="h-12 min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !isValidQty ||
              !reason.trim() ||
              parsedQty === currentQty
            }
            className="h-12 min-w-[100px]"
          >
            {isPending ? 'Saving...' : 'Confirm Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
