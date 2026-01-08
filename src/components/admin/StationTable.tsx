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
import { updateStation, deleteStation } from '@/lib/actions/admin/stations';
import { STATION_TYPES, type StationType } from '@/lib/types/stations';

type Station = {
  id: string;
  siteId: string;
  name: string;
  stationType: string;
  sequenceOrder: number;
  active: boolean;
  site: { name: string };
  _count: {
    operations: number;
    unitExecutions: number;
    downtimeIntervals: number;
  };
};

type Site = {
  id: string;
  name: string;
};

interface StationTableProps {
  stations: Station[];
  sites: Site[];
}

export function StationTable({ stations, sites }: StationTableProps) {
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [deletingStation, setDeletingStation] = useState<Station | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredStations = stations.filter((s) => {
    if (filterSite !== 'all' && s.siteId !== filterSite) return false;
    if (filterType !== 'all' && s.stationType !== filterType) return false;
    return true;
  });

  const getStationTypeIcon = (type: string) => {
    const stationType = STATION_TYPES.find((t) => t.value === type);
    return stationType?.icon ?? '📍';
  };

  const getStationTypeLabel = (type: string) => {
    const stationType = STATION_TYPES.find((t) => t.value === type);
    return stationType?.label ?? type;
  };

  const getTotalUsage = (station: Station) => {
    return (
      station._count.operations +
      station._count.unitExecutions +
      station._count.downtimeIntervals
    );
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStation) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      await updateStation(editingStation.id, {
        name: formData.get('name') as string,
        stationType: formData.get('stationType') as StationType,
        sequenceOrder: parseInt(formData.get('sequenceOrder') as string, 10),
        active: formData.get('active') === 'true',
      });
      setEditingStation(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStation) return;

    setIsSubmitting(true);
    try {
      await deleteStation(deletingStation.id);
      setDeletingStation(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Site:</Label>
          <Select value={filterSite} onValueChange={setFilterSite}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Type:</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
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
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  No stations found
                </TableCell>
              </TableRow>
            ) : (
              filteredStations.map((station) => (
                <TableRow key={station.id}>
                  <TableCell className="font-mono text-slate-500">
                    #{station.sequenceOrder}
                  </TableCell>
                  <TableCell className="font-medium">{station.name}</TableCell>
                  <TableCell className="text-slate-500">{station.site.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <span>{getStationTypeIcon(station.stationType)}</span>
                      {getStationTypeLabel(station.stationType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={station.active ? 'default' : 'secondary'}
                      className={station.active ? 'bg-green-500' : ''}
                    >
                      {station.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    <div className="text-xs space-y-0.5">
                      <div>{station._count.operations} operations</div>
                      <div>{station._count.unitExecutions} executions</div>
                      <div>{station._count.downtimeIntervals} downtime</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingStation(station)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeletingStation(station)}
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
      <Dialog open={!!editingStation} onOpenChange={() => setEditingStation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Station</DialogTitle>
            <DialogDescription>
              Update the station configuration
            </DialogDescription>
          </DialogHeader>
          {editingStation && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Station Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingStation.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stationType">Station Type</Label>
                  <Select name="stationType" defaultValue={editingStation.stationType}>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sequenceOrder">Sequence Order</Label>
                  <Input
                    id="edit-sequenceOrder"
                    name="sequenceOrder"
                    type="number"
                    min="1"
                    defaultValue={editingStation.sequenceOrder}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Position in the production flow
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-active">Status</Label>
                  <Select
                    name="active"
                    defaultValue={editingStation.active ? 'true' : 'false'}
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
                  onClick={() => setEditingStation(null)}
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
      <Dialog open={!!deletingStation} onOpenChange={() => setDeletingStation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Station</DialogTitle>
            <DialogDescription>
              {deletingStation && getTotalUsage(deletingStation) > 0 ? (
                <>
                  This station has been used in {getTotalUsage(deletingStation)} operation(s),
                  execution(s), or downtime interval(s). It will be deactivated instead of deleted.
                </>
              ) : (
                <>Are you sure you want to delete this station?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingStation(null)}
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
