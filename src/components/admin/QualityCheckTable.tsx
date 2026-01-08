'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  updateQualityCheckDefinition,
  deleteQualityCheckDefinition,
} from '@/lib/actions/admin/quality-checks';
import {
  CHECK_TYPES,
  type CheckType,
  type MeasurementParameters,
  type ChecklistParameters,
  type PassFailParameters,
} from '@/lib/types/quality-checks';

type QualityCheckDefinition = {
  id: string;
  name: string;
  checkType: string;
  parameters: unknown;
  stationIds: string[];
  active: boolean;
  _count: { results: number };
};

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

interface QualityCheckTableProps {
  definitions: QualityCheckDefinition[];
  stations: Station[];
}

export function QualityCheckTable({ definitions, stations }: QualityCheckTableProps) {
  const [editingCheck, setEditingCheck] = useState<QualityCheckDefinition | null>(null);
  const [deletingCheck, setDeletingCheck] = useState<QualityCheckDefinition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [editStationIds, setEditStationIds] = useState<string[]>([]);
  const [editChecklistItems, setEditChecklistItems] = useState<string[]>(['']);

  const filteredDefinitions = definitions.filter(
    (d) => filterType === 'all' || d.checkType === filterType
  );

  const getCheckTypeIcon = (type: string) => {
    const checkType = CHECK_TYPES.find((t) => t.value === type);
    return checkType?.icon ?? '❓';
  };

  const getCheckTypeLabel = (type: string) => {
    const checkType = CHECK_TYPES.find((t) => t.value === type);
    return checkType?.label ?? type;
  };

  const getStationNames = (stationIds: string[]) => {
    return stationIds
      .map((id) => stations.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const formatParameters = (checkType: string, parameters: unknown) => {
    const params = parameters as Record<string, unknown>;

    if (checkType === 'measurement') {
      const mp = params as MeasurementParameters;
      const parts = [];
      if (mp.min !== undefined) parts.push(`Min: ${mp.min}`);
      if (mp.target !== undefined) parts.push(`Target: ${mp.target}`);
      if (mp.max !== undefined) parts.push(`Max: ${mp.max}`);
      if (mp.unit) parts.push(`(${mp.unit})`);
      return parts.join(' ');
    }

    if (checkType === 'checklist') {
      const cp = params as ChecklistParameters;
      return `${cp.items?.length ?? 0} items${cp.requireAll ? ' (all required)' : ''}`;
    }

    if (checkType === 'pass_fail') {
      const pp = params as PassFailParameters;
      return pp.requireNotes ? 'Notes required on fail' : 'Simple pass/fail';
    }

    return '-';
  };

  const handleEditOpen = (check: QualityCheckDefinition) => {
    setEditingCheck(check);
    setEditStationIds(check.stationIds);
    if (check.checkType === 'checklist') {
      const params = check.parameters as ChecklistParameters;
      setEditChecklistItems(params.items?.length ? params.items : ['']);
    }
  };

  const handleStationToggle = (stationId: string) => {
    setEditStationIds((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId]
    );
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCheck) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const checkType = editingCheck.checkType as CheckType;
      let parameters: MeasurementParameters | ChecklistParameters | PassFailParameters;

      if (checkType === 'measurement') {
        parameters = {
          min: formData.get('min') ? parseFloat(formData.get('min') as string) : undefined,
          max: formData.get('max') ? parseFloat(formData.get('max') as string) : undefined,
          target: formData.get('target') ? parseFloat(formData.get('target') as string) : undefined,
          unit: formData.get('unit') as string,
        };
      } else if (checkType === 'checklist') {
        parameters = {
          items: editChecklistItems.filter((item) => item.trim() !== ''),
          requireAll: formData.get('requireAll') === 'true',
        };
      } else {
        parameters = {
          requireNotes: formData.get('requireNotes') === 'true',
        };
      }

      await updateQualityCheckDefinition(editingCheck.id, {
        name: formData.get('name') as string,
        parameters,
        stationIds: editStationIds,
        active: formData.get('active') === 'true',
      });
      setEditingCheck(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCheck) return;

    setIsSubmitting(true);
    try {
      await deleteQualityCheckDefinition(deletingCheck.id);
      setDeletingCheck(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Filter by Type:</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CHECK_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <span>{type.icon}</span>
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Stations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDefinitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  No quality check definitions found
                </TableCell>
              </TableRow>
            ) : (
              filteredDefinitions.map((definition) => (
                <TableRow key={definition.id}>
                  <TableCell className="font-medium">{definition.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <span>{getCheckTypeIcon(definition.checkType)}</span>
                      {getCheckTypeLabel(definition.checkType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                    {formatParameters(definition.checkType, definition.parameters)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                    {definition.stationIds.length > 0
                      ? getStationNames(definition.stationIds)
                      : 'No stations assigned'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={definition.active ? 'default' : 'secondary'}
                      className={definition.active ? 'bg-green-500' : ''}
                    >
                      {definition.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {definition._count.results} results
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOpen(definition)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingCheck(definition)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCheck} onOpenChange={() => setEditingCheck(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Quality Check</DialogTitle>
            <DialogDescription>
              Update the quality check configuration
            </DialogDescription>
          </DialogHeader>
          {editingCheck && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Check Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingCheck.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Check Type</Label>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{getCheckTypeIcon(editingCheck.checkType)}</span>
                    {getCheckTypeLabel(editingCheck.checkType)}
                    <span className="text-xs">(cannot be changed)</span>
                  </div>
                </div>

                {/* Type-specific parameter editing */}
                {editingCheck.checkType === 'pass_fail' && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="edit-requireNotes"
                        name="requireNotes"
                        value="true"
                        defaultChecked={(editingCheck.parameters as PassFailParameters).requireNotes}
                      />
                      <Label htmlFor="edit-requireNotes" className="font-normal">
                        Require notes on failure
                      </Label>
                    </div>
                  </div>
                )}

                {editingCheck.checkType === 'measurement' && (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="edit-min" className="text-xs">Min Value</Label>
                        <Input
                          id="edit-min"
                          name="min"
                          type="number"
                          step="any"
                          defaultValue={(editingCheck.parameters as MeasurementParameters).min}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-target" className="text-xs">Target</Label>
                        <Input
                          id="edit-target"
                          name="target"
                          type="number"
                          step="any"
                          defaultValue={(editingCheck.parameters as MeasurementParameters).target}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-max" className="text-xs">Max Value</Label>
                        <Input
                          id="edit-max"
                          name="max"
                          type="number"
                          step="any"
                          defaultValue={(editingCheck.parameters as MeasurementParameters).max}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-unit">Unit</Label>
                      <Input
                        id="edit-unit"
                        name="unit"
                        defaultValue={(editingCheck.parameters as MeasurementParameters).unit}
                        required
                      />
                    </div>
                  </div>
                )}

                {editingCheck.checkType === 'checklist' && (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                    <Label>Checklist Items</Label>
                    {editChecklistItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={item}
                          onChange={(e) => {
                            const newItems = [...editChecklistItems];
                            newItems[index] = e.target.value;
                            setEditChecklistItems(newItems);
                          }}
                          placeholder={`Item ${index + 1}`}
                        />
                        {editChecklistItems.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setEditChecklistItems(editChecklistItems.filter((_, i) => i !== index));
                            }}
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditChecklistItems([...editChecklistItems, ''])}
                    >
                      + Add Item
                    </Button>
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id="edit-requireAll"
                        name="requireAll"
                        value="true"
                        defaultChecked={(editingCheck.parameters as ChecklistParameters).requireAll}
                      />
                      <Label htmlFor="edit-requireAll" className="font-normal">
                        Require all items to pass
                      </Label>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Applicable Stations</Label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {stations.map((station) => (
                      <div key={station.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-station-${station.id}`}
                          checked={editStationIds.includes(station.id)}
                          onCheckedChange={() => handleStationToggle(station.id)}
                        />
                        <Label htmlFor={`edit-station-${station.id}`} className="font-normal">
                          {station.name}
                          <span className="text-xs text-slate-400 ml-2">
                            ({station.site.name})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-active">Status</Label>
                  <Select
                    name="active"
                    defaultValue={editingCheck.active ? 'true' : 'false'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCheck(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingCheck} onOpenChange={() => setDeletingCheck(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quality Check</DialogTitle>
            <DialogDescription>
              {deletingCheck && deletingCheck._count.results > 0 ? (
                <>
                  This quality check has been used in {deletingCheck._count.results} result(s).
                  It will be deactivated instead of deleted.
                </>
              ) : (
                <>Are you sure you want to delete this quality check definition?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingCheck(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
