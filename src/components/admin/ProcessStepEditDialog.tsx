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
import { updateProcessStepDefinition } from '@/lib/actions/admin/process-steps';
import { STEP_CATEGORIES, normalizeDataFields, type DataFieldDefinition } from '@/lib/types/process-steps';
import { DataFieldBuilder } from './DataFieldBuilder';

type StepDefinition = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  stationId: string | null;
  sequenceOrder: number;
  isMandatory: boolean;
  requiresSignoff: boolean;
  triggersQc: boolean;
  cycleTimeTarget: number | null;
  dataFields: unknown;
  active: boolean;
};

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

interface ProcessStepEditDialogProps {
  step: StepDefinition;
  stations: Station[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProcessStepEditDialog({
  step,
  stations,
  open,
  onOpenChange,
}: ProcessStepEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(step.name);
  const [description, setDescription] = useState(step.description ?? '');
  const [category, setCategory] = useState(step.category);
  const [stationId, setStationId] = useState(step.stationId ?? '');
  const [sequenceOrder, setSequenceOrder] = useState(step.sequenceOrder);
  const [isMandatory, setIsMandatory] = useState(step.isMandatory);
  const [requiresSignoff, setRequiresSignoff] = useState(step.requiresSignoff);
  const [triggersQc, setTriggersQc] = useState(step.triggersQc);
  const [cycleTimeTarget, setCycleTimeTarget] = useState(
    step.cycleTimeTarget?.toString() ?? ''
  );
  const [dataFields, setDataFields] = useState<DataFieldDefinition[]>(
    normalizeDataFields(step.dataFields)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateProcessStepDefinition(step.id, {
        name,
        description: description || undefined,
        category,
        stationId: stationId || null,
        sequenceOrder,
        isMandatory,
        requiresSignoff,
        triggersQc,
        cycleTimeTarget: cycleTimeTarget ? parseFloat(cycleTimeTarget) : null,
        dataFields,
      });

      onOpenChange(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update process step');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Process Step</DialogTitle>
          <DialogDescription>
            Update the process step definition and its data capture fields
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Step Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Category & Station */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
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
              </div>
            </div>

            {/* Sequence & Cycle Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sequence Order</Label>
                <Input
                  type="number"
                  value={sequenceOrder}
                  onChange={(e) => setSequenceOrder(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Cycle Time Target (min)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={cycleTimeTarget}
                  onChange={(e) => setCycleTimeTarget(e.target.value)}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
              <Label className="text-sm font-semibold">Options</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-isMandatory"
                    checked={isMandatory}
                    onCheckedChange={(checked) => setIsMandatory(checked === true)}
                  />
                  <Label htmlFor="edit-isMandatory" className="font-normal">
                    Mandatory
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-requiresSignoff"
                    checked={requiresSignoff}
                    onCheckedChange={(checked) => setRequiresSignoff(checked === true)}
                  />
                  <Label htmlFor="edit-requiresSignoff" className="font-normal">
                    Requires Sign-off
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-triggersQc"
                    checked={triggersQc}
                    onCheckedChange={(checked) => setTriggersQc(checked === true)}
                  />
                  <Label htmlFor="edit-triggersQc" className="font-normal">
                    Triggers QC
                  </Label>
                </div>
              </div>
            </div>

            {/* Data Fields Builder */}
            <DataFieldBuilder fields={dataFields} onChange={setDataFields} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
