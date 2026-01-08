'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createQualityCheckDefinition } from '@/lib/actions/admin/quality-checks';
import {
  CHECK_TYPES,
  type CheckType,
  type MeasurementParameters,
  type ChecklistParameters,
  type PassFailParameters,
} from '@/lib/types/quality-checks';

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

interface QualityCheckFormProps {
  stations: Station[];
}

export function QualityCheckForm({ stations }: QualityCheckFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkType, setCheckType] = useState<CheckType>('pass_fail');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);

  const handleStationToggle = (stationId: string) => {
    setSelectedStations((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId]
    );
  };

  const handleChecklistItemChange = (index: number, value: string) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const removeChecklistItem = (index: number) => {
    if (checklistItems.length > 1) {
      setChecklistItems(checklistItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
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
          items: checklistItems.filter((item) => item.trim() !== ''),
          requireAll: formData.get('requireAll') === 'true',
        };
      } else {
        parameters = {
          requireNotes: formData.get('requireNotes') === 'true',
        };
      }

      await createQualityCheckDefinition({
        name: formData.get('name') as string,
        checkType,
        parameters,
        stationIds: selectedStations,
      });

      setOpen(false);
      // Reset form
      (e.target as HTMLFormElement).reset();
      setCheckType('pass_fail');
      setSelectedStations([]);
      setChecklistItems(['']);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create quality check');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Quality Check
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Quality Check Definition</DialogTitle>
          <DialogDescription>
            Create a new quality check to be performed at stations
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Check Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Visual Inspection"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkType">Check Type</Label>
              <Select
                value={checkType}
                onValueChange={(v) => setCheckType(v as CheckType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECK_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                        <span className="text-xs text-slate-400">- {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Check-type specific fields */}
            {checkType === 'pass_fail' && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox id="requireNotes" name="requireNotes" value="true" />
                  <Label htmlFor="requireNotes" className="font-normal">
                    Require notes on failure
                  </Label>
                </div>
              </div>
            )}

            {checkType === 'measurement' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min" className="text-xs">Min Value</Label>
                    <Input
                      id="min"
                      name="min"
                      type="number"
                      step="any"
                      placeholder="Min"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="target" className="text-xs">Target</Label>
                    <Input
                      id="target"
                      name="target"
                      type="number"
                      step="any"
                      placeholder="Target"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="max" className="text-xs">Max Value</Label>
                    <Input
                      id="max"
                      name="max"
                      type="number"
                      step="any"
                      placeholder="Max"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    name="unit"
                    placeholder="e.g., mm, kg, °C"
                    required
                  />
                </div>
              </div>
            )}

            {checkType === 'checklist' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <Label>Checklist Items</Label>
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                    />
                    {checklistItems.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeChecklistItem(index)}
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
                  onClick={addChecklistItem}
                >
                  + Add Item
                </Button>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="requireAll" name="requireAll" value="true" defaultChecked />
                  <Label htmlFor="requireAll" className="font-normal">
                    Require all items to pass
                  </Label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Applicable Stations</Label>
              <p className="text-xs text-slate-500 mb-2">
                Select which stations perform this quality check
              </p>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {stations.map((station) => (
                  <div key={station.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`station-${station.id}`}
                      checked={selectedStations.includes(station.id)}
                      onCheckedChange={() => handleStationToggle(station.id)}
                    />
                    <Label htmlFor={`station-${station.id}`} className="font-normal">
                      {station.name}
                      <span className="text-xs text-slate-400 ml-2">
                        ({station.site.name} - {station.stationType})
                      </span>
                    </Label>
                  </div>
                ))}
                {stations.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    No active stations available
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Quality Check'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
