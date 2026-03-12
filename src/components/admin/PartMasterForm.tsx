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
import { createPartMaster } from '@/lib/actions/admin/parts';

const PART_CATEGORIES = [
  'Magnetic',
  'Electrical',
  'Electronics',
  'Mechanical',
  'Hardware',
  'Process Materials',
  'Tooling',
  'Packaging',
  'Other',
];

const SERIALIZATION_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'lot', label: 'Lot Tracked' },
  { value: 'unit', label: 'Unit Serialized' },
];

const UNITS_OF_MEASURE = ['EA', 'KG', 'LB', 'M', 'FT', 'L', 'GAL', 'ML', 'PC', 'SET', 'ROLL'];

type Supplier = {
  id: string;
  name: string;
  supplierId: string;
};

interface PartMasterFormProps {
  suppliers: Supplier[];
}

export function PartMasterForm({ suppliers: _suppliers }: PartMasterFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('Mechanical');
  const [serializationType, setSerializationType] = useState('none');
  const [unitOfMeasure, setUnitOfMeasure] = useState('EA');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      await createPartMaster({
        partNumber: formData.get('partNumber') as string,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        category,
        unitOfMeasure,
        serializationType,
        revision: (formData.get('revision') as string) || 'A',
        countryOfOrigin: (formData.get('countryOfOrigin') as string) || undefined,
        reorderPoint: formData.get('reorderPoint') ? parseFloat(formData.get('reorderPoint') as string) : undefined,
        targetStockLevel: formData.get('targetStockLevel') ? parseFloat(formData.get('targetStockLevel') as string) : undefined,
        standardCost: formData.get('standardCost') ? parseFloat(formData.get('standardCost') as string) : undefined,
        hazardous: formData.get('hazardous') === 'on',
        hazardousNotes: (formData.get('hazardousNotes') as string) || undefined,
      });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      setCategory('Mechanical');
      setSerializationType('none');
      setUnitOfMeasure('EA');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create part');
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
          Add Part
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Part</DialogTitle>
          <DialogDescription>
            Create a new part in the master catalog
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part Number</Label>
                <Input
                  id="partNumber"
                  name="partNumber"
                  placeholder="e.g., 510-00001"
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
                  maxLength={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Stator Lamination Stack"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF_MEASURE.map((uom) => (
                      <SelectItem key={uom} value={uom}>
                        {uom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Serialization Type</Label>
              <Select value={serializationType} onValueChange={setSerializationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIALIZATION_TYPES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                How this part is tracked in inventory
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  name="reorderPoint"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Min stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetStockLevel">Target Stock</Label>
                <Input
                  id="targetStockLevel"
                  name="targetStockLevel"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standardCost">Std Cost ($)</Label>
                <Input
                  id="standardCost"
                  name="standardCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryOfOrigin">Country of Origin</Label>
              <Input
                id="countryOfOrigin"
                name="countryOfOrigin"
                placeholder="e.g., US, CN, DE"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hazardous"
                name="hazardous"
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="hazardous" className="text-sm font-normal">
                Hazardous material
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hazardousNotes">Hazardous Notes</Label>
              <Input
                id="hazardousNotes"
                name="hazardousNotes"
                placeholder="SDS reference, handling notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Part'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
