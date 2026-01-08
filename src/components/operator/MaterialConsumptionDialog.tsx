'use client';

import { useState, useTransition, useEffect } from 'react';
import { MaterialLot } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { consumeMaterial, getAvailableMaterialLots } from '@/lib/actions/materials';
import { useRouter } from 'next/navigation';

interface MaterialConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  stationId: string;
}

export function MaterialConsumptionDialog({
  open,
  onOpenChange,
  unitId,
  stationId,
}: MaterialConsumptionDialogProps) {
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<MaterialLot | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Load available lots when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getAvailableMaterialLots()
        .then(setLots)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    } else {
      // Reset state when closed
      setSelectedLot(null);
      setQuantity('1');
      setSearchQuery('');
      setError(null);
    }
  }, [open]);

  const filteredLots = lots.filter(
    (lot) =>
      lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedLot) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (qty > selectedLot.qtyRemaining) {
      setError(`Quantity exceeds available (${selectedLot.qtyRemaining})`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await consumeMaterial({
          unitId,
          materialLotId: selectedLot.id,
          qtyConsumed: qty,
          stationId,
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record consumption');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Material Consumption</DialogTitle>
        </DialogHeader>

        {!selectedLot ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search or Scan Lot Number</Label>
              <input
                id="search"
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
                placeholder="Enter lot number or material code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-gray-500">Loading lots...</p>
            ) : filteredLots.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                {searchQuery ? 'No matching lots found' : 'No material lots available'}
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {filteredLots.map((lot) => (
                  <Button
                    key={lot.id}
                    variant="outline"
                    className="h-auto w-full justify-start py-3 text-left"
                    onClick={() => setSelectedLot(lot)}
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{lot.lotNumber}</p>
                        <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-700">
                          Qty: {lot.qtyRemaining}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {lot.materialCode}
                        {lot.description && ` - ${lot.description}`}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="font-medium">{selectedLot.lotNumber}</p>
              <p className="text-sm text-gray-500">
                {selectedLot.materialCode}
                {selectedLot.description && ` - ${selectedLot.description}`}
              </p>
              <p className="mt-1 text-sm text-green-600">
                Available: {selectedLot.qtyRemaining}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity to Consume</Label>
              <input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedLot.qtyRemaining}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedLot(null);
                  setQuantity('1');
                  setError(null);
                }}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? 'Recording...' : 'Record'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
