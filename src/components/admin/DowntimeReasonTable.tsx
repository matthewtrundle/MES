'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { updateDowntimeReason, deleteDowntimeReason } from '@/lib/actions/admin/downtime-reasons';
import { LOSS_TYPES, type LossType } from '@/lib/types/downtime-reasons';

type DowntimeReason = {
  id: string;
  siteId: string;
  code: string;
  description: string;
  lossType: string;
  isPlanned: boolean;
  active: boolean;
  site: { name: string };
  _count: { downtimeIntervals: number };
};

type Site = {
  id: string;
  name: string;
};

interface DowntimeReasonTableProps {
  reasons: DowntimeReason[];
  sites: Site[];
}

export function DowntimeReasonTable({ reasons, sites }: DowntimeReasonTableProps) {
  const [editingReason, setEditingReason] = useState<DowntimeReason | null>(null);
  const [deletingReason, setDeletingReason] = useState<DowntimeReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterLossType, setFilterLossType] = useState<string>('all');

  const filteredReasons = reasons.filter(
    (r) => filterLossType === 'all' || r.lossType === filterLossType
  );

  const getLossTypeColor = (lossType: string) => {
    const type = LOSS_TYPES.find((t) => t.value === lossType);
    return type?.color ?? 'bg-slate-500';
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingReason) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      await updateDowntimeReason(editingReason.id, {
        code: formData.get('code') as string,
        description: formData.get('description') as string,
        lossType: formData.get('lossType') as LossType,
        isPlanned: formData.get('isPlanned') === 'true',
        active: formData.get('active') === 'true',
      });
      setEditingReason(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReason) return;

    setIsSubmitting(true);
    try {
      await deleteDowntimeReason(deletingReason.id);
      setDeletingReason(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Filter by Loss Type:</Label>
        <Select value={filterLossType} onValueChange={setFilterLossType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {LOSS_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Loss Type</TableHead>
              <TableHead>Planned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReasons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  No downtime reasons found
                </TableCell>
              </TableRow>
            ) : (
              filteredReasons.map((reason) => (
                <TableRow key={reason.id}>
                  <TableCell className="font-mono font-medium">{reason.code}</TableCell>
                  <TableCell>{reason.description}</TableCell>
                  <TableCell className="text-slate-500">{reason.site.name}</TableCell>
                  <TableCell>
                    <Badge className={`${getLossTypeColor(reason.lossType)} text-white`}>
                      {reason.lossType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {reason.isPlanned ? (
                      <Badge variant="outline" className="border-blue-200 text-blue-700">
                        Planned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500">
                        Unplanned
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={reason.active ? 'default' : 'secondary'}
                      className={reason.active ? 'bg-green-500' : ''}
                    >
                      {reason.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {reason._count.downtimeIntervals} intervals
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingReason(reason)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingReason(reason)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingReason} onOpenChange={() => setEditingReason(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Downtime Reason</DialogTitle>
            <DialogDescription>
              Update the downtime reason configuration
            </DialogDescription>
          </DialogHeader>
          {editingReason && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code</Label>
                  <Input
                    id="edit-code"
                    name="code"
                    defaultValue={editingReason.code}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    name="description"
                    defaultValue={editingReason.description}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lossType">Loss Type</Label>
                  <Select name="lossType" defaultValue={editingReason.lossType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOSS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-isPlanned">Planned Downtime</Label>
                  <Select
                    name="isPlanned"
                    defaultValue={editingReason.isPlanned ? 'true' : 'false'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Unplanned</SelectItem>
                      <SelectItem value="true">Planned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-active">Status</Label>
                  <Select
                    name="active"
                    defaultValue={editingReason.active ? 'true' : 'false'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReason(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingReason} onOpenChange={() => setDeletingReason(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Downtime Reason</DialogTitle>
            <DialogDescription>
              {deletingReason && deletingReason._count.downtimeIntervals > 0 ? (
                <>
                  This reason has been used in {deletingReason._count.downtimeIntervals}{' '}
                  downtime interval(s). It will be deactivated instead of deleted.
                </>
              ) : (
                <>Are you sure you want to delete this downtime reason?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingReason(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
