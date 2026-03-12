'use client';

import { useState, useEffect, useTransition } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAvailableMaterialLots } from '@/lib/actions/materials';
import { pickKitLine } from '@/lib/actions/kitting';

type KitLine = {
  id: string;
  materialCode: string;
  description: string | null;
  qtyRequired: number;
  qtyPicked: number;
};

type MaterialLot = {
  id: string;
  lotNumber: string;
  materialCode: string;
  qtyRemaining: number;
  expiresAt: Date | string | null;
};

interface KitPickDialogProps {
  kitLine: KitLine;
  onClose: () => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function KitPickDialog({ kitLine, onClose }: KitPickDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [qtyToPick, setQtyToPick] = useState('');

  const qtyNeeded = kitLine.qtyRequired - kitLine.qtyPicked;

  useEffect(() => {
    setIsLoading(true);
    getAvailableMaterialLots(kitLine.materialCode)
      .then((availableLots) => {
        setLots(availableLots);
      })
      .catch(() => {
        toast.error('Failed to load available lots');
        setLots([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [kitLine.materialCode]);

  const handlePick = () => {
    if (!selectedLotId || !qtyToPick) return;

    startTransition(async () => {
      try {
        await pickKitLine({
          kitLineId: kitLine.id,
          materialLotId: selectedLotId,
          qtyPicked: parseFloat(qtyToPick),
        });
        toast.success('Material picked successfully');
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to pick material');
      }
    });
  };

  const selectedLot = lots.find((l) => l.id === selectedLotId);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick Material</DialogTitle>
          <DialogDescription>
            Select a lot for {kitLine.materialCode}
            {kitLine.description ? ` - ${kitLine.description}` : ''}.
            Need {qtyNeeded} more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="text-center text-slate-500 py-4">Loading available lots...</div>
          ) : lots.length === 0 ? (
            <div className="text-center text-slate-500 py-4">
              No available lots found for material code {kitLine.materialCode}
            </div>
          ) : (
            <>
              <div className="rounded-lg border max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Lot #</TableHead>
                      <TableHead className="text-right">Qty Available</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => (
                      <TableRow
                        key={lot.id}
                        className={`cursor-pointer ${selectedLotId === lot.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => {
                          setSelectedLotId(lot.id);
                          // Auto-fill qty to pick (min of available and needed)
                          const autoQty = Math.min(lot.qtyRemaining, qtyNeeded);
                          setQtyToPick(autoQty.toString());
                        }}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="selectedLot"
                            checked={selectedLotId === lot.id}
                            onChange={() => {
                              setSelectedLotId(lot.id);
                              const autoQty = Math.min(lot.qtyRemaining, qtyNeeded);
                              setQtyToPick(autoQty.toString());
                            }}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium">{lot.lotNumber}</TableCell>
                        <TableCell className="text-right font-mono">{lot.qtyRemaining}</TableCell>
                        <TableCell className="text-slate-500">{formatDate(lot.expiresAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedLotId && (
                <div className="space-y-2">
                  <Label htmlFor="qtyToPick">Quantity to Pick</Label>
                  <Input
                    id="qtyToPick"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedLot ? Math.min(selectedLot.qtyRemaining, qtyNeeded) : undefined}
                    value={qtyToPick}
                    onChange={(e) => setQtyToPick(e.target.value)}
                    placeholder={`Max: ${selectedLot ? Math.min(selectedLot.qtyRemaining, qtyNeeded) : '-'}`}
                  />
                  <p className="text-xs text-slate-500">
                    Need {qtyNeeded} | Available from selected lot: {selectedLot?.qtyRemaining ?? '-'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handlePick}
            disabled={isPending || !selectedLotId || !qtyToPick || parseFloat(qtyToPick) <= 0}
          >
            {isPending ? 'Picking...' : 'Confirm Pick'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
