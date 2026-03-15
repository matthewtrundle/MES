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
import { toast } from 'sonner';

interface BomItem {
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  unitOfMeasure: string;
}

interface MaterialConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  stationId: string;
  bomItems?: BomItem[];
}

export function MaterialConsumptionDialog({
  open,
  onOpenChange,
  unitId,
  stationId,
  bomItems = [],
}: MaterialConsumptionDialogProps) {
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<MaterialLot | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBomFilter, setActiveBomFilter] = useState<BomItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const hasBom = bomItems.length > 0;
  const bomMaterialCodes = new Set(bomItems.map((b) => b.materialCode));

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
      setActiveBomFilter(null);
      setError(null);
    }
  }, [open]);

  // Filter lots: if a BOM filter is active, match by materialCode; otherwise use search query
  const filteredLots = lots
    .filter((lot) => {
      if (activeBomFilter) {
        return lot.materialCode === activeBomFilter.materialCode;
      }
      if (!searchQuery) return true;
      return (
        lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    // FIFO sort: oldest receivedAt first (already sorted from server, but ensure client-side too)
    .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

  const handleSelectBomItem = (item: BomItem) => {
    setActiveBomFilter(item);
    setSearchQuery('');
    setQuantity(String(item.qtyPerUnit));
  };

  const handleClearBomFilter = () => {
    setActiveBomFilter(null);
    setSearchQuery('');
  };

  const handleSelectLot = (lot: MaterialLot) => {
    setSelectedLot(lot);
    // If a BOM filter was active, pre-fill the quantity from BOM
    if (activeBomFilter) {
      setQuantity(String(activeBomFilter.qtyPerUnit));
    }
  };

  // Check if selected lot is NOT in BOM
  const isNonBomMaterial = hasBom && selectedLot && !bomMaterialCodes.has(selectedLot.materialCode);

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
        toast.success('Material consumption recorded');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record consumption');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="material-dialog">
        <DialogHeader>
          <DialogTitle>Record Material Consumption</DialogTitle>
        </DialogHeader>

        {!selectedLot ? (
          <div className="space-y-4 py-4">
            {/* BOM Requirements Section */}
            {hasBom && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-800">
                  Required Materials (BOM)
                </h3>
                <div className="space-y-2">
                  {bomItems.map((item) => {
                    const hasMatchingLots = lots.some(
                      (lot) => lot.materialCode === item.materialCode
                    );
                    const isActive = activeBomFilter?.materialCode === item.materialCode;

                    return (
                      <div
                        key={item.materialCode}
                        data-testid={`material-bom-item-${item.materialCode}`}
                        className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                          isActive
                            ? 'border-blue-500 bg-blue-100'
                            : 'border-blue-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">
                            {item.materialCode}
                          </p>
                          {item.description && (
                            <p className="truncate text-sm text-slate-500">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs font-mono text-blue-600">
                            {item.qtyPerUnit} {item.unitOfMeasure} per unit
                          </p>
                        </div>
                        <Button
                          variant={isActive ? 'default' : 'outline'}
                          size="sm"
                          className={`ml-3 min-h-[44px] min-w-[80px] ${
                            isActive
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : ''
                          }`}
                          onClick={() =>
                            isActive ? handleClearBomFilter() : handleSelectBomItem(item)
                          }
                          disabled={!hasMatchingLots && !isActive}
                        >
                          {isActive ? 'Clear' : hasMatchingLots ? 'Select' : 'No Stock'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active BOM Filter Indicator */}
            {activeBomFilter && (
              <div className="flex items-center justify-between rounded-lg bg-blue-100 border border-blue-300 px-4 py-2">
                <p className="text-sm text-blue-800">
                  Showing lots for: <span className="font-bold">{activeBomFilter.materialCode}</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] text-blue-700 hover:text-blue-900"
                  onClick={handleClearBomFilter}
                >
                  Show All
                </Button>
              </div>
            )}

            {/* Search / Scan Input */}
            {!activeBomFilter && (
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
            )}

            {/* Lot List */}
            {isLoading ? (
              <p className="py-8 text-center text-gray-500">Loading lots...</p>
            ) : filteredLots.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                {activeBomFilter
                  ? `No lots available for ${activeBomFilter.materialCode}`
                  : searchQuery
                    ? 'No matching lots found'
                    : 'No material lots available'}
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {activeBomFilter && (
                  <p className="text-xs text-slate-500 px-1">
                    Sorted by FIFO (oldest first)
                  </p>
                )}
                {filteredLots.map((lot) => {
                  const isInBom = bomMaterialCodes.has(lot.materialCode);
                  return (
                    <Button
                      key={lot.id}
                      data-testid={`material-lot-${lot.id}`}
                      variant="outline"
                      className="h-auto w-full justify-start py-3 text-left"
                      onClick={() => handleSelectLot(lot)}
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{lot.lotNumber}</p>
                            {hasBom && !isInBom && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                Not in BOM
                              </span>
                            )}
                          </div>
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
                  );
                })}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" data-testid="material-error">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{selectedLot.lotNumber}</p>
                {isNonBomMaterial && (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800">
                    Not in BOM
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {selectedLot.materialCode}
                {selectedLot.description && ` - ${selectedLot.description}`}
              </p>
              <p className="mt-1 text-sm text-green-600">
                Available: {selectedLot.qtyRemaining}
              </p>
            </div>

            {isNonBomMaterial && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                This material is not listed in the Bill of Materials for this station. Verify this is the correct material before proceeding.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity to Consume</Label>
              <input
                id="quantity"
                data-testid="material-quantity-input"
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
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" data-testid="material-error">
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
                data-testid="material-submit-btn"
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
