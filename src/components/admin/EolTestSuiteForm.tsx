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
import { createEolTestSuite } from '@/lib/actions/eol-testing';

type Routing = {
  id: string;
  name: string;
  productCode: string;
  serialFormat: string | null;
};

type ParameterInput = {
  name: string;
  unit: string;
  minValue: string;
  maxValue: string;
  targetValue: string;
};

const EMPTY_PARAMETER: ParameterInput = {
  name: '',
  unit: '',
  minValue: '',
  maxValue: '',
  targetValue: '',
};

const COMMON_EOL_TESTS = [
  { name: 'Hi-Pot', unit: 'V', min: '1000', max: '1500', target: '1200' },
  { name: 'Continuity', unit: 'Ohm', min: '0', max: '0.5', target: '0.1' },
  { name: 'Inductance', unit: 'mH', min: '0.8', max: '1.2', target: '1.0' },
  { name: 'Resistance', unit: 'Ohm', min: '1.0', max: '3.0', target: '2.0' },
  { name: 'Vibration', unit: 'g', min: '0', max: '2.5', target: '1.0' },
];

interface EolTestSuiteFormProps {
  routings: Routing[];
}

export function EolTestSuiteForm({ routings }: EolTestSuiteFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoutingId, setSelectedRoutingId] = useState('');
  const [parameters, setParameters] = useState<ParameterInput[]>([{ ...EMPTY_PARAMETER }]);

  const addParameter = () => {
    setParameters([...parameters, { ...EMPTY_PARAMETER }]);
  };

  const removeParameter = (index: number) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter((_, i) => i !== index));
    }
  };

  const updateParameter = (index: number, field: keyof ParameterInput, value: string) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const addCommonTests = () => {
    setParameters(
      COMMON_EOL_TESTS.map((t) => ({
        name: t.name,
        unit: t.unit,
        minValue: t.min,
        maxValue: t.max,
        targetValue: t.target,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const validParams = parameters
        .filter((p) => p.name.trim() !== '' && p.unit.trim() !== '')
        .map((p, index) => ({
          name: p.name.trim(),
          unit: p.unit.trim(),
          minValue: p.minValue ? parseFloat(p.minValue) : undefined,
          maxValue: p.maxValue ? parseFloat(p.maxValue) : undefined,
          targetValue: p.targetValue ? parseFloat(p.targetValue) : undefined,
          sequence: index,
        }));

      if (validParams.length === 0) {
        alert('At least one test parameter is required');
        return;
      }

      await createEolTestSuite({
        routingId: selectedRoutingId,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        parameters: validParams,
      });

      setOpen(false);
      setSelectedRoutingId('');
      setParameters([{ ...EMPTY_PARAMETER }]);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create EOL test suite');
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
          Add EOL Test Suite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create EOL Test Suite</DialogTitle>
          <DialogDescription>
            Define end-of-line test parameters that must pass before serial number assignment
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Suite Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., BLDC Motor EOL Suite"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label>Routing / Product</Label>
              <Select value={selectedRoutingId} onValueChange={setSelectedRoutingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a routing" />
                </SelectTrigger>
                <SelectContent>
                  {routings.map((routing) => (
                    <SelectItem key={routing.id} value={routing.id}>
                      {routing.name} ({routing.productCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {routings.length === 0 && (
                <p className="text-xs text-amber-600">No active routings available. Create a routing first.</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Test Parameters</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCommonTests}
                >
                  Load Common EOL Tests
                </Button>
              </div>

              <div className="border rounded-lg divide-y">
                {parameters.map((param, index) => (
                  <div key={index} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Parameter {index + 1}
                      </span>
                      {parameters.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-red-500 hover:text-red-700"
                          onClick={() => removeParameter(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={param.name}
                          onChange={(e) => updateParameter(index, 'name', e.target.value)}
                          placeholder="e.g., Hi-Pot"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input
                          value={param.unit}
                          onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                          placeholder="e.g., V, Ohm, mH"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min</Label>
                        <Input
                          type="number"
                          step="any"
                          value={param.minValue}
                          onChange={(e) => updateParameter(index, 'minValue', e.target.value)}
                          placeholder="Min"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Target</Label>
                        <Input
                          type="number"
                          step="any"
                          value={param.targetValue}
                          onChange={(e) => updateParameter(index, 'targetValue', e.target.value)}
                          placeholder="Target"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max</Label>
                        <Input
                          type="number"
                          step="any"
                          value={param.maxValue}
                          onChange={(e) => updateParameter(index, 'maxValue', e.target.value)}
                          placeholder="Max"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addParameter}
                className="w-full"
              >
                + Add Parameter
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedRoutingId}
            >
              {isSubmitting ? 'Creating...' : 'Create EOL Suite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
