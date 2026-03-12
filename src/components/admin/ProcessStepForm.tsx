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
import { createProcessStepDefinition } from '@/lib/actions/admin/process-steps';
import {
  STEP_CATEGORIES,
  DATA_FIELD_TYPES,
  type DataFieldDefinition,
  type DataFieldType,
} from '@/lib/types/process-steps';
import { DataFieldBuilder } from './DataFieldBuilder';

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

interface ProcessStepFormProps {
  stations: Station[];
}

export function ProcessStepForm({ stations }: ProcessStepFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [stationId, setStationId] = useState<string>('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [requiresSignoff, setRequiresSignoff] = useState(false);
  const [triggersQc, setTriggersQc] = useState(false);
  const [dataFields, setDataFields] = useState<DataFieldDefinition[]>([]);

  const resetForm = () => {
    setCategory('');
    setStationId('');
    setIsMandatory(true);
    setRequiresSignoff(false);
    setTriggersQc(false);
    setDataFields([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      await createProcessStepDefinition({
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        category,
        stationId: stationId || undefined,
        sequenceOrder: parseInt(formData.get('sequenceOrder') as string) || 0,
        isMandatory,
        requiresSignoff,
        triggersQc,
        cycleTimeTarget: formData.get('cycleTimeTarget')
          ? parseFloat(formData.get('cycleTimeTarget') as string)
          : undefined,
        dataFields,
      });

      setOpen(false);
      resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create process step');
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
          Add Process Step
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Process Step Definition</DialogTitle>
          <DialogDescription>
            Define a process step with configurable data capture fields
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Step Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Press shaft into bell"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="Brief description of the step"
              />
            </div>

            {/* Category & Station */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Station</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select station (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                        <span className="text-xs text-slate-400 ml-2">
                          ({station.site.name})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sequence & Cycle Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sequenceOrder">Sequence Order</Label>
                <Input
                  id="sequenceOrder"
                  name="sequenceOrder"
                  type="number"
                  defaultValue={0}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cycleTimeTarget">Cycle Time Target (min)</Label>
                <Input
                  id="cycleTimeTarget"
                  name="cycleTimeTarget"
                  type="number"
                  step="0.1"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
              <Label className="text-sm font-semibold">Options</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isMandatory"
                    checked={isMandatory}
                    onCheckedChange={(checked) => setIsMandatory(checked === true)}
                  />
                  <Label htmlFor="isMandatory" className="font-normal">
                    Mandatory
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requiresSignoff"
                    checked={requiresSignoff}
                    onCheckedChange={(checked) => setRequiresSignoff(checked === true)}
                  />
                  <Label htmlFor="requiresSignoff" className="font-normal">
                    Requires Sign-off
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="triggersQc"
                    checked={triggersQc}
                    onCheckedChange={(checked) => setTriggersQc(checked === true)}
                  />
                  <Label htmlFor="triggersQc" className="font-normal">
                    Triggers QC
                  </Label>
                </div>
              </div>
            </div>

            {/* Data Fields Builder */}
            <DataFieldBuilder fields={dataFields} onChange={setDataFields} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !category}>
              {isSubmitting ? 'Creating...' : 'Create Process Step'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
