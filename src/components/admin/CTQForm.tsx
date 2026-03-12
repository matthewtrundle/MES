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
import { createCTQDefinition } from '@/lib/actions/admin/ctq-definitions';

const SAMPLE_SIZE_RULES = [
  { value: 'all', label: 'All', description: 'Inspect every item' },
  { value: 'fixed_count', label: 'Fixed Count', description: 'Inspect a set number' },
  { value: 'aql', label: 'AQL', description: 'Acceptance Quality Level sampling' },
  { value: 'skip', label: 'Skip', description: 'No inspection required' },
];

const UNITS_OF_MEASURE = ['mm', 'in', 'um', 'ohm', 'N', 'kg', 'lb', 'V', 'A', 'mA', 'rpm', 'dB', 'psi', 'bar'];

export function CTQForm() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sampleSizeRule, setSampleSizeRule] = useState('all');
  const [safetyCritical, setSafetyCritical] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const nominal = parseFloat(formData.get('nominal') as string);
      const usl = parseFloat(formData.get('usl') as string);
      const lsl = parseFloat(formData.get('lsl') as string);

      if (isNaN(nominal) || isNaN(usl) || isNaN(lsl)) {
        throw new Error('Nominal, USL, and LSL must be valid numbers');
      }

      await createCTQDefinition({
        partNumber: (formData.get('partNumber') as string).trim(),
        revision: (formData.get('revision') as string).trim() || 'A',
        dimensionName: (formData.get('dimensionName') as string).trim(),
        nominal,
        usl,
        lsl,
        unitOfMeasure: formData.get('unitOfMeasure') as string,
        measurementTool: (formData.get('measurementTool') as string)?.trim() || undefined,
        methodNote: (formData.get('methodNote') as string)?.trim() || undefined,
        sampleSizeRule,
        sampleSize: sampleSizeRule === 'fixed_count'
          ? parseInt(formData.get('sampleSize') as string, 10)
          : undefined,
        safetyCritical,
      });

      setOpen(false);
      setSampleSizeRule('all');
      setSafetyCritical(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create CTQ definition');
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
          Add CTQ Dimension
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add CTQ Dimension</DialogTitle>
          <DialogDescription>
            Define a Critical-to-Quality dimension for incoming quality inspection
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Part Number & Revision */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="partNumber">Part Number</Label>
                <Input
                  id="partNumber"
                  name="partNumber"
                  placeholder="e.g., MTR-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revision">Revision</Label>
                <Input
                  id="revision"
                  name="revision"
                  placeholder="A"
                  defaultValue="A"
                />
              </div>
            </div>

            {/* Dimension Name */}
            <div className="space-y-2">
              <Label htmlFor="dimensionName">Dimension Name</Label>
              <Input
                id="dimensionName"
                name="dimensionName"
                placeholder="e.g., Shaft diameter, Bearing bore ID"
                required
              />
            </div>

            {/* Nominal / USL / LSL */}
            <div className="space-y-2">
              <Label>Specification Limits</Label>
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="lsl" className="text-xs text-red-600">LSL (Lower)</Label>
                  <Input
                    id="lsl"
                    name="lsl"
                    type="number"
                    step="any"
                    placeholder="Lower limit"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nominal" className="text-xs text-blue-600 font-semibold">Nominal (Target)</Label>
                  <Input
                    id="nominal"
                    name="nominal"
                    type="number"
                    step="any"
                    placeholder="Target value"
                    required
                    className="border-blue-300"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="usl" className="text-xs text-red-600">USL (Upper)</Label>
                  <Input
                    id="usl"
                    name="usl"
                    type="number"
                    step="any"
                    placeholder="Upper limit"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Unit of Measure */}
            <div className="space-y-2">
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Select name="unitOfMeasure" defaultValue="mm">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Measurement Tool */}
            <div className="space-y-2">
              <Label htmlFor="measurementTool">Measurement Tool (optional)</Label>
              <Input
                id="measurementTool"
                name="measurementTool"
                placeholder="e.g., micrometer, CMM, ohmmeter"
              />
            </div>

            {/* Method Note */}
            <div className="space-y-2">
              <Label htmlFor="methodNote">Method Note (optional)</Label>
              <Input
                id="methodNote"
                name="methodNote"
                placeholder="Instructions for measurement"
              />
            </div>

            {/* Sample Size Rule */}
            <div className="space-y-2">
              <Label>Sample Size Rule</Label>
              <Select value={sampleSizeRule} onValueChange={setSampleSizeRule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_SIZE_RULES.map((rule) => (
                    <SelectItem key={rule.value} value={rule.value}>
                      <div className="flex items-center gap-2">
                        <span>{rule.label}</span>
                        <span className="text-xs text-slate-400">- {rule.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sample Size (for fixed_count) */}
            {sampleSizeRule === 'fixed_count' && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                <Label htmlFor="sampleSize">Sample Size</Label>
                <Input
                  id="sampleSize"
                  name="sampleSize"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Number of samples to inspect"
                  required
                />
              </div>
            )}

            {/* Safety Critical */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <Checkbox
                id="safetyCritical"
                checked={safetyCritical}
                onCheckedChange={(checked) => setSafetyCritical(checked === true)}
              />
              <div>
                <Label htmlFor="safetyCritical" className="font-medium text-amber-800">
                  Safety Critical Dimension
                </Label>
                <p className="text-xs text-amber-600">
                  Failures on safety-critical dimensions will be flagged for immediate review
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create CTQ Dimension'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
