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
import { updateSupplier } from '@/lib/actions/admin/suppliers';

const QUALIFICATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'disqualified', label: 'Disqualified' },
];

type Supplier = {
  id: string;
  name: string;
  supplierId: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  countryOfOrigin: string | null;
  qualificationStatus: string;
  notes: string | null;
  active: boolean;
  _count: {
    parts: number;
    materialLots: number;
  };
};

interface SupplierTableProps {
  suppliers: Supplier[];
}

export function SupplierTable({ suppliers }: SupplierTableProps) {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredSuppliers = suppliers.filter((s) => {
    if (filterStatus !== 'all' && s.qualificationStatus !== filterStatus) return false;
    return true;
  });

  const getQualificationBadge = (status: string) => {
    switch (status) {
      case 'qualified':
        return <Badge className="bg-green-500">Qualified</Badge>;
      case 'disqualified':
        return <Badge variant="destructive">Disqualified</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplier) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      await updateSupplier(editingSupplier.id, {
        name: formData.get('name') as string,
        supplierId: formData.get('supplierId') as string,
        contactEmail: (formData.get('contactEmail') as string) || undefined,
        contactPhone: (formData.get('contactPhone') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
        countryOfOrigin: (formData.get('countryOfOrigin') as string) || undefined,
        qualificationStatus: formData.get('qualificationStatus') as string,
        notes: (formData.get('notes') as string) || undefined,
        active: formData.get('active') === 'true',
      });
      setEditingSupplier(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Qualification:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {QUALIFICATION_STATUSES.map((qs) => (
                <SelectItem key={qs.value} value={qs.value}>
                  {qs.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-mono font-medium">{supplier.supplierId}</TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      {supplier.contactEmail && <div>{supplier.contactEmail}</div>}
                      {supplier.contactPhone && <div>{supplier.contactPhone}</div>}
                      {!supplier.contactEmail && !supplier.contactPhone && (
                        <span className="text-slate-400">No contact</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {supplier.countryOfOrigin ?? '-'}
                  </TableCell>
                  <TableCell>
                    {getQualificationBadge(supplier.qualificationStatus)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.active ? 'default' : 'secondary'}
                      className={supplier.active ? 'bg-green-500' : ''}
                    >
                      {supplier.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5 text-slate-500">
                      <div>{supplier._count.parts} part{supplier._count.parts !== 1 ? 's' : ''}</div>
                      <div>{supplier._count.materialLots} lot{supplier._count.materialLots !== 1 ? 's' : ''}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSupplier(supplier)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Update supplier information
            </DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-supplierId">Supplier Code</Label>
                    <Input
                      id="edit-supplierId"
                      name="supplierId"
                      defaultValue={editingSupplier.supplierId}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Company Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={editingSupplier.name}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-contactEmail">Contact Email</Label>
                    <Input
                      id="edit-contactEmail"
                      name="contactEmail"
                      type="email"
                      defaultValue={editingSupplier.contactEmail ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-contactPhone">Contact Phone</Label>
                    <Input
                      id="edit-contactPhone"
                      name="contactPhone"
                      defaultValue={editingSupplier.contactPhone ?? ''}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    name="address"
                    defaultValue={editingSupplier.address ?? ''}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-countryOfOrigin">Country</Label>
                    <Input
                      id="edit-countryOfOrigin"
                      name="countryOfOrigin"
                      defaultValue={editingSupplier.countryOfOrigin ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Qualification Status</Label>
                    <Select name="qualificationStatus" defaultValue={editingSupplier.qualificationStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALIFICATION_STATUSES.map((qs) => (
                          <SelectItem key={qs.value} value={qs.value}>
                            {qs.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Input
                    id="edit-notes"
                    name="notes"
                    defaultValue={editingSupplier.notes ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    name="active"
                    defaultValue={editingSupplier.active ? 'true' : 'false'}
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
                  onClick={() => setEditingSupplier(null)}
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
    </div>
  );
}
