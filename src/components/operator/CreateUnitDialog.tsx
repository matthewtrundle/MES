'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createUnit, startOperation } from '@/lib/actions/units';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CreateUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  stationId: string;
}

export function CreateUnitDialog({
  open,
  onOpenChange,
  workOrderId,
  stationId,
}: CreateUnitDialogProps) {
  const [serialNumber, setSerialNumber] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      let unit: { id: string; serialNumber: string } | null = null;
      try {
        // Create the unit
        unit = await createUnit(workOrderId, serialNumber || undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create unit');
        return;
      }

      try {
        // Get the operation for this station
        const response = await fetch(
          `/api/station/${stationId}/operation?workOrderId=${workOrderId}`
        );

        if (!response.ok) {
          throw new Error('Failed to find operation for this station');
        }

        const { operationId } = await response.json();

        if (!operationId) {
          // Unit created but no operation found at this station
          onOpenChange(false);
          setSerialNumber('');
          toast.warning(`Unit ${unit.serialNumber} created but no operation found at this station`);
          router.refresh();
          return;
        }

        // Start the operation automatically
        await startOperation(unit.id, stationId, operationId);

        onOpenChange(false);
        setSerialNumber('');
        toast.success(`Unit ${unit.serialNumber} created and started`);
        router.refresh();
      } catch (err) {
        // Unit was already created — don't show "Failed to create" message
        onOpenChange(false);
        setSerialNumber('');
        toast.error(
          `Unit ${unit.serialNumber} was created but could not start the operation: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="create-unit-dialog">
        <DialogHeader>
          <DialogTitle>Start New Unit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="serial">Serial Number (optional)</Label>
            <input
              id="serial"
              data-testid="create-unit-serial-input"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Leave blank to auto-generate"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              disabled={isPending}
              autoFocus
            />
            <p className="text-sm text-slate-500">
              Scan a barcode or enter manually. Leave blank for auto-generated serial.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" data-testid="create-unit-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="create-unit-cancel"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            size="lg"
            onClick={handleCreate}
            disabled={isPending}
            data-testid="create-unit-submit"
          >
            {isPending ? 'Creating...' : 'Create & Start'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
