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
import { createStation, getNextSequenceOrder } from '@/lib/actions/admin/stations';
import { STATION_TYPES, type StationType } from '@/lib/types/stations';

type Site = {
  id: string;
  name: string;
};

interface StationFormProps {
  sites: Site[];
}

export function StationForm({ sites }: StationFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSite, setSelectedSite] = useState(sites[0]?.id ?? '');
  const [selectedType, setSelectedType] = useState<StationType>('winding');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const nextOrder = await getNextSequenceOrder(selectedSite);

      await createStation({
        siteId: selectedSite,
        name: formData.get('name') as string,
        stationType: selectedType,
        sequenceOrder: nextOrder,
      });
      setOpen(false);
      // Reset form
      (e.target as HTMLFormElement).reset();
      setSelectedType('winding');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create station');
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
          Add Station
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Station</DialogTitle>
          <DialogDescription>
            Create a new production station
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Station Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Winding Station 1"
                required
              />
              <p className="text-xs text-slate-500">
                Descriptive name for the station
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stationType">Station Type</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as StationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Determines the operations available at this station
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Station'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
