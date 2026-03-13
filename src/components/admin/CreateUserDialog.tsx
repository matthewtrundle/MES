'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_ROLES, getRoleDisplayName } from '@/lib/auth/rbac';
import type { AppRole } from '@/lib/auth/rbac';
import { createUser } from '@/lib/actions/admin/user-management';
import { toast } from 'sonner';

interface Station {
  id: string;
  name: string;
  stationType: string;
}

interface Site {
  id: string;
  name: string;
}

interface CreateUserDialogProps {
  stations: Station[];
  sites: Site[];
}

export function CreateUserDialog({ stations, sites }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('operator');
  const [stationId, setStationId] = useState<string>('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  function resetForm() {
    setName('');
    setEmail('');
    setRole('operator');
    setStationId('');
    setSelectedSiteIds([]);
  }

  function toggleSite(siteId: string) {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await createUser({
        name,
        email,
        role,
        assignedStationId: stationId || null,
        siteIds: selectedSiteIds.length > 0 ? selectedSiteIds : undefined,
      });
      toast.success(`User "${name}" created successfully`);
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. They will receive a placeholder account until first login via Clerk.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Full Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.smith@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {getRoleDisplayName(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-station">Station Assignment (optional)</Label>
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No station assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No station assigned</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.stationType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sites.length > 0 && (
            <div className="space-y-2">
              <Label>Site Assignment</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-md border p-2">
                {sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSiteIds.includes(site.id)}
                      onChange={() => toggleSite(site.id)}
                      className="rounded border-slate-300"
                    />
                    {site.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !email}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
