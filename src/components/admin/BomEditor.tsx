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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  getBomForRouting,
  createBomItem,
  deleteBomItem,
  createBomRevision,
  getBomHistory,
} from '@/lib/actions/bom';
import { ASSEMBLY_GROUP_LABELS } from '@/lib/types/assembly-groups';

type Routing = {
  id: string;
  name: string;
  productCode: string;
  revision: string;
  effectiveDate: Date | null;
  supersededById: string | null;
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
  assemblyGroup: string | null;
  sortOrder: number;
  active: boolean;
  station: { id: string; name: string; sequenceOrder: number };
};

type RevisionEntry = {
  id: string;
  revision: string;
  effectiveDate: Date | null;
  active: boolean;
  productCode: string;
  name: string;
  createdAt: Date;
  isCurrent: boolean;
};

const ASSEMBLY_GROUP_OPTIONS = [
  { value: 'stator', label: 'Stator' },
  { value: 'rotor', label: 'Rotor' },
  { value: 'wire_harness', label: 'Wire Harness' },
  { value: 'base', label: 'Base' },
  { value: 'final_assembly', label: 'Final Assembly' },
];

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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [revisionHistory, setRevisionHistory] = useState<RevisionEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    materialCode: '',
    description: '',
    stationId: '',
    qtyPerUnit: '',
    unitOfMeasure: 'EA',
    assemblyGroup: '',
  });

  const selectedRouting = routings.find((r) => r.id === selectedRoutingId);

  // When viewing history, we may be looking at a non-current routing
  const effectiveRoutingId = viewingHistoryId || selectedRoutingId;
  const isViewingOldRevision = viewingHistoryId !== null && viewingHistoryId !== selectedRoutingId;

  useEffect(() => {
    if (effectiveRoutingId) {
      setIsLoadingBom(true);
      getBomForRouting(effectiveRoutingId)
        .then((items) => {
          setBomItems(items as BomItem[]);
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
  }, [effectiveRoutingId]);

  // Load revision history when a routing is selected
  useEffect(() => {
    if (selectedRoutingId) {
      getBomHistory(selectedRoutingId)
        .then(setRevisionHistory)
        .catch(() => setRevisionHistory([]));
    } else {
      setRevisionHistory([]);
    }
    setViewingHistoryId(null);
    setShowHistory(false);
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
          assemblyGroup: newItem.assemblyGroup
            ? (newItem.assemblyGroup as 'stator' | 'rotor' | 'wire_harness' | 'base' | 'final_assembly')
            : undefined,
        });

        toast.success('BOM item added');
        setShowAddRow(false);
        setNewItem({
          materialCode: '',
          description: '',
          stationId: '',
          qtyPerUnit: '',
          unitOfMeasure: 'EA',
          assemblyGroup: '',
        });

        // Reload BOM items
        const items = await getBomForRouting(selectedRoutingId);
        setBomItems(items as BomItem[]);
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

        if (effectiveRoutingId) {
          const items = await getBomForRouting(effectiveRoutingId);
          setBomItems(items as BomItem[]);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove BOM item');
      }
    });
  };

  const handleCreateRevision = () => {
    if (!selectedRoutingId) return;

    startTransition(async () => {
      try {
        const newRouting = await createBomRevision(selectedRoutingId);
        toast.success(`Created revision ${newRouting.revision}`);
        router.refresh();
        // The page will re-render with updated routings list
        // Select the new routing
        setSelectedRoutingId(newRouting.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create revision');
      }
    });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Group items by assemblyGroup
  const groupedItems: Record<string, BomItem[]> = {};
  for (const item of bomItems) {
    const group = item.assemblyGroup || 'ungrouped';
    if (!groupedItems[group]) groupedItems[group] = [];
    groupedItems[group].push(item);
  }

  // Sort groups: defined groups first in order, then ungrouped last
  const groupOrder = ['stator', 'rotor', 'wire_harness', 'base', 'final_assembly', 'ungrouped'];
  const sortedGroups = Object.keys(groupedItems).sort(
    (a, b) => (groupOrder.indexOf(a) === -1 ? 999 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) === -1 ? 999 : groupOrder.indexOf(b))
  );

  const hasGroups = sortedGroups.length > 1 || (sortedGroups.length === 1 && sortedGroups[0] !== 'ungrouped');

  // Find the revision entry for the currently viewed routing
  const viewingRevision = viewingHistoryId
    ? revisionHistory.find((r) => r.id === viewingHistoryId)
    : null;

  const renderBomTable = (items: BomItem[], showGroupCol: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material Code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Station</TableHead>
          {showGroupCol && <TableHead>Group</TableHead>}
          <TableHead className="text-right">Qty Per Unit</TableHead>
          <TableHead>UoM</TableHead>
          <TableHead>Active</TableHead>
          {!isViewingOldRevision && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && !showAddRow ? (
          <TableRow>
            <TableCell colSpan={showGroupCol ? 8 : 7} className="text-center text-slate-500 py-8">
              No materials in this group.
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono font-medium">{item.materialCode}</TableCell>
              <TableCell className="text-slate-500">{item.description || '-'}</TableCell>
              <TableCell>{item.station.name}</TableCell>
              {showGroupCol && (
                <TableCell>
                  {item.assemblyGroup ? (
                    <Badge variant="outline" className="text-xs">
                      {ASSEMBLY_GROUP_LABELS[item.assemblyGroup] || item.assemblyGroup}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right font-mono">{item.qtyPerUnit}</TableCell>
              <TableCell>{item.unitOfMeasure}</TableCell>
              <TableCell>
                <Badge className={item.active ? 'bg-green-500' : 'bg-slate-400'}>
                  {item.active ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              {!isViewingOldRevision && (
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
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{routing.name}</span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    Rev {routing.revision}
                  </Badge>
                </div>
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
                  <div className="flex items-center gap-2">
                    <CardTitle>{selectedRouting.name} - BOM</CardTitle>
                    <Badge variant="secondary" className="font-mono">
                      Rev {viewingRevision ? viewingRevision.revision : selectedRouting.revision}
                    </Badge>
                    {isViewingOldRevision && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        Historical (read-only)
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {bomItems.length} material{bomItems.length !== 1 ? 's' : ''} defined
                    {selectedRouting.effectiveDate && (
                      <> &middot; Effective {new Date(selectedRouting.effectiveDate).toLocaleDateString()}</>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Revision history toggle */}
                  {revisionHistory.length > 1 && (
                    <Select
                      value={viewingHistoryId || selectedRoutingId || ''}
                      onValueChange={(v) => {
                        if (v === selectedRoutingId) {
                          setViewingHistoryId(null);
                        } else {
                          setViewingHistoryId(v);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[160px] h-9 text-sm">
                        <SelectValue placeholder="Revision history" />
                      </SelectTrigger>
                      <SelectContent>
                        {revisionHistory.map((rev) => (
                          <SelectItem key={rev.id} value={rev.id}>
                            Rev {rev.revision}
                            {rev.isCurrent ? ' (current)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {!isViewingOldRevision && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateRevision}
                        disabled={isPending}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        New Revision
                      </Button>
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
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBom ? (
                <div className="text-center text-slate-500 py-8">Loading BOM items...</div>
              ) : hasGroups ? (
                /* Grouped view with collapsible sections */
                <div className="space-y-4">
                  {sortedGroups.map((group) => {
                    const items = groupedItems[group];
                    const label = group === 'ungrouped'
                      ? 'Ungrouped'
                      : ASSEMBLY_GROUP_LABELS[group] || group;
                    const isCollapsed = collapsedGroups.has(group);

                    return (
                      <Collapsible key={group} open={!isCollapsed} onOpenChange={() => toggleGroup(group)}>
                        <div className="rounded-lg border">
                          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-semibold text-sm text-slate-800">{label}</span>
                              <Badge variant="outline" className="text-xs">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t">
                              {renderBomTable(items, false)}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}

                  {/* Add row outside groups */}
                  {showAddRow && (
                    <div className="rounded-lg border">
                      <div className="px-4 py-2 bg-blue-50/50 text-sm font-medium text-blue-800">
                        New Material
                      </div>
                      <div className="border-t">
                        <Table>
                          <TableBody>
                            {renderAddRow()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Flat view (no groups) */
                <div className="rounded-lg border">
                  {renderBomTable(bomItems, false)}

                  {/* Inline add row */}
                  {showAddRow && (
                    <div className="border-t">
                      <Table>
                        <TableBody>
                          {renderAddRow()}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  function renderAddRow() {
    return (
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
              <SelectValue placeholder="Station" />
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
          <Select
            value={newItem.assemblyGroup}
            onValueChange={(v) => setNewItem({ ...newItem, assemblyGroup: v === '_none' ? '' : v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Ungrouped</SelectItem>
              {ASSEMBLY_GROUP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
    );
  }
}
