'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_ROLES, getRoleDisplayName } from '@/lib/auth/roles';
import type { AppRole } from '@/lib/auth/roles';
import { updateUser } from '@/lib/actions/admin/user-management';
import { toast } from 'sonner';

interface Station {
  id: string;
  name: string;
  stationType: string;
}

interface UserToEdit {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedStationId: string | null;
  assignedStation: { id: string; name: string; stationType?: string } | null;
  active: boolean;
}

interface EditUserDialogProps {
  user: UserToEdit | null;
  stations: Station[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, stations, open, onOpenChange }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<AppRole>('operator');
  const [stationId, setStationId] = useState<string>('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role as AppRole);
      setStationId(user.assignedStationId ?? 'none');
      setActive(user.active);
    }
  }, [user]);

  if (!user) return null;

  const hasChanges =
    name !== user.name ||
    role !== user.role ||
    (stationId === 'none' ? null : stationId) !== user.assignedStationId ||
    active !== user.active;

  const changes: { field: string; from: string; to: string }[] = [];
  if (name !== user.name) {
    changes.push({ field: 'Name', from: user.name, to: name });
  }
  if (role !== user.role) {
    changes.push({ field: 'Role', from: getRoleDisplayName(user.role as AppRole), to: getRoleDisplayName(role) });
  }
  if ((stationId === 'none' ? null : stationId) !== user.assignedStationId) {
    const fromStation = user.assignedStation?.name ?? 'None';
    const toStation = stationId === 'none'
      ? 'None'
      : stations.find((s) => s.id === stationId)?.name ?? 'None';
    changes.push({ field: 'Station', from: fromStation, to: toStation });
  }
  if (active !== user.active) {
    changes.push({ field: 'Status', from: user.active ? 'Active' : 'Inactive', to: active ? 'Active' : 'Inactive' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await updateUser(user.id, {
        name,
        role,
        assignedStationId: stationId === 'none' ? null : stationId,
        active,
      });
      toast.success(`User "${name}" updated successfully`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Editing {user.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
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
            <Label htmlFor="edit-station">Station Assignment</Label>
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

          <div className="space-y-2">
            <Label htmlFor="edit-active">Status</Label>
            <Select value={active ? 'active' : 'inactive'} onValueChange={(v) => setActive(v === 'active')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {changes.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">Changes Preview</p>
              <ul className="text-sm text-amber-700 space-y-1">
                {changes.map((c) => (
                  <li key={c.field}>
                    <span className="font-medium">{c.field}:</span>{' '}
                    <span className="line-through text-amber-600">{c.from}</span>
                    {' → '}
                    <span className="font-medium">{c.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !hasChanges || !name}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
