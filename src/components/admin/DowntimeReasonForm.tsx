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
import { createDowntimeReason } from '@/lib/actions/admin/downtime-reasons';
import { LOSS_TYPES, type LossType } from '@/lib/types/downtime-reasons';

type Site = {
  id: string;
  name: string;
};

interface DowntimeReasonFormProps {
  sites: Site[];
}

export function DowntimeReasonForm({ sites }: DowntimeReasonFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSite, setSelectedSite] = useState(sites[0]?.id ?? '');
  const [selectedLossType, setSelectedLossType] = useState<LossType>('equipment');
  const [isPlanned, setIsPlanned] = useState('false');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      await createDowntimeReason({
        siteId: selectedSite,
        code: formData.get('code') as string,
        description: formData.get('description') as string,
        lossType: selectedLossType,
        isPlanned: isPlanned === 'true',
      });
      setOpen(false);
      // Reset form
      (e.target as HTMLFormElement).reset();
      setSelectedLossType('equipment');
      setIsPlanned('false');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create downtime reason');
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
          Add Reason
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Downtime Reason</DialogTitle>
          <DialogDescription>
            Create a new reason code for tracking downtime
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
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="e.g., MAINT-01"
                className="font-mono"
                required
              />
              <p className="text-xs text-slate-500">
                Short identifier (e.g., MAINT-01, SETUP, BREAK)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="e.g., Scheduled maintenance"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lossType">Loss Type</Label>
              <Select
                value={selectedLossType}
                onValueChange={(v) => setSelectedLossType(v as LossType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${type.color}`} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Category for OEE and Pareto analysis
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isPlanned">Planned Downtime?</Label>
              <Select value={isPlanned} onValueChange={setIsPlanned}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No - Unplanned</SelectItem>
                  <SelectItem value="true">Yes - Planned</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Planned downtime (breaks, maintenance) is reported separately
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Reason'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
