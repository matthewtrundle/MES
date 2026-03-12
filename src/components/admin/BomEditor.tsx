'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBomForRouting, createBomItem, deleteBomItem } from '@/lib/actions/bom';

type Routing = {
  id: string;
  name: string;
  productCode: string;
  _count: { bom: number };
};

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

type BomItem = {
  id: string;
  routingId: string;
  stationId: string;
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  unitOfMeasure: string;
  active: boolean;
  station: { id: string; name: string; sequenceOrder: number };
};

interface BomEditorProps {
  routings: Routing[];
  stations: Station[];
}

export function BomEditor({ routings, stations }: BomEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRoutingId, setSelectedRoutingId] = useState<string | null>(null);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [isLoadingBom, setIsLoadingBom] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newItem, setNewItem] = useState({
    materialCode: '',
    description: '',
    stationId: '',
    qtyPerUnit: '',
    unitOfMeasure: 'EA',
  });

  const selectedRouting = routings.find((r) => r.id === selectedRoutingId);

  useEffect(() => {
    if (selectedRoutingId) {
      setIsLoadingBom(true);
      getBomForRouting(selectedRoutingId)
        .then((items) => {
          setBomItems(items);
        })
        .catch(() => {
          toast.error('Failed to load BOM items');
          setBomItems([]);
        })
        .finally(() => {
          setIsLoadingBom(false);
        });
    } else {
      setBomItems([]);
    }
    setShowAddRow(false);
  }, [selectedRoutingId]);

  const handleAddItem = () => {
    if (!selectedRoutingId) return;

    startTransition(async () => {
      try {
        await createBomItem({
          routingId: selectedRoutingId,
          stationId: newItem.stationId,
          materialCode: newItem.materialCode,
          description: newItem.description || undefined,
          qtyPerUnit: parseFloat(newItem.qtyPerUnit),
          unitOfMeasure: newItem.unitOfMeasure,
        });

        toast.success('BOM item added');
        setShowAddRow(false);
        setNewItem({
          materialCode: '',
          description: '',
          stationId: '',
          qtyPerUnit: '',
          unitOfMeasure: 'EA',
        });

        // Reload BOM items
        const items = await getBomForRouting(selectedRoutingId);
        setBomItems(items);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add BOM item');
      }
    });
  };

  const handleDeleteItem = (itemId: string) => {
    startTransition(async () => {
      try {
        await deleteBomItem(itemId);
        toast.success('BOM item removed');

        if (selectedRoutingId) {
          const items = await getBomForRouting(selectedRoutingId);
          setBomItems(items);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove BOM item');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Routing selector */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Routings</h3>
        {routings.length === 0 ? (
          <p className="text-sm text-slate-500">No active routings found</p>
        ) : (
          <div className="space-y-2">
            {routings.map((routing) => (
              <button
                key={routing.id}
                onClick={() => setSelectedRoutingId(routing.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedRoutingId === routing.id
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-medium text-sm">{routing.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {routing.productCode}
                </div>
                <Badge variant="outline" className="mt-1 text-xs">
                  {routing._count.bom} material{routing._count.bom !== 1 ? 's' : ''}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BOM items */}
      <div className="lg:col-span-3">
        {!selectedRouting ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-slate-500">Select a routing to view its bill of materials</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedRouting.name} - BOM</CardTitle>
                  <CardDescription>
                    {bomItems.length} material{bomItems.length !== 1 ? 's' : ''} defined
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddRow(true)}
                  disabled={showAddRow}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Material
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBom ? (
                <div className="text-center text-slate-500 py-8">Loading BOM items...</div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead className="text-right">Qty Per Unit</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomItems.length === 0 && !showAddRow ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                            No materials defined for this routing. Click &quot;Add Material&quot; to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        bomItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono font-medium">{item.materialCode}</TableCell>
                            <TableCell className="text-slate-500">{item.description || '-'}</TableCell>
                            <TableCell>{item.station.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.qtyPerUnit}</TableCell>
                            <TableCell>{item.unitOfMeasure}</TableCell>
                            <TableCell>
                              <Badge className={item.active ? 'bg-green-500' : 'bg-slate-400'}>
                                {item.active ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={isPending}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}

                      {/* Inline add row */}
                      {showAddRow && (
                        <TableRow className="bg-blue-50/50">
                          <TableCell>
                            <Input
                              placeholder="Material code"
                              value={newItem.materialCode}
                              onChange={(e) => setNewItem({ ...newItem, materialCode: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Description (optional)"
                              value={newItem.description}
                              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={newItem.stationId}
                              onValueChange={(v) => setNewItem({ ...newItem, stationId: v })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select station" />
                              </SelectTrigger>
                              <SelectContent>
                                {stations.map((station) => (
                                  <SelectItem key={station.id} value={station.id}>
                                    {station.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Qty"
                              value={newItem.qtyPerUnit}
                              onChange={(e) => setNewItem({ ...newItem, qtyPerUnit: e.target.value })}
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="UoM"
                              value={newItem.unitOfMeasure}
                              onChange={(e) => setNewItem({ ...newItem, unitOfMeasure: e.target.value })}
                              className="h-8 text-sm w-16"
                            />
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={handleAddItem}
                                disabled={
                                  isPending ||
                                  !newItem.materialCode ||
                                  !newItem.stationId ||
                                  !newItem.qtyPerUnit
                                }
                              >
                                {isPending ? 'Adding...' : 'Add'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddRow(false)}
                                disabled={isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
