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
import { updatePartMaster, searchParts, linkPartSupplier, unlinkPartSupplier } from '@/lib/actions/admin/parts';

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

type PartSupplierInfo = {
  id: string;
  supplierPartNumber: string | null;
  isPreferred: boolean;
  unitCost: number | null;
  leadTimeDays: number | null;
  supplier: {
    id: string;
    name: string;
    supplierId: string;
  };
};

type Part = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  revision: string;
  category: string;
  unitOfMeasure: string;
  countryOfOrigin: string | null;
  reorderPoint: number | null;
  targetStockLevel: number | null;
  standardCost: number | null;
  serializationType: string;
  hazardous: boolean;
  hazardousNotes: string | null;
  status: string;
  suppliers: PartSupplierInfo[];
};

type Supplier = {
  id: string;
  name: string;
  supplierId: string;
};

interface PartMasterTableProps {
  parts: Part[];
  suppliers: Supplier[];
}

export function PartMasterTable({ parts: initialParts, suppliers }: PartMasterTableProps) {
  const [parts, setParts] = useState(initialParts);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [supplierDialogPart, setSupplierDialogPart] = useState<Part | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Supplier link form state
  const [linkSupplierId, setLinkSupplierId] = useState('');
  const [linkSupplierPartNum, setLinkSupplierPartNum] = useState('');
  const [linkUnitCost, setLinkUnitCost] = useState('');
  const [linkLeadTime, setLinkLeadTime] = useState('');
  const [linkIsPreferred, setLinkIsPreferred] = useState(false);

  const filteredParts = parts.filter((p) => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // Reset to initial parts if search is cleared
      setParts(initialParts);
      return;
    }
    try {
      const results = await searchParts(searchQuery);
      setParts(results);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Search failed');
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPart) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      await updatePartMaster(editingPart.id, {
        partNumber: formData.get('partNumber') as string,
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        revision: formData.get('revision') as string,
        category: formData.get('category') as string,
        unitOfMeasure: formData.get('unitOfMeasure') as string,
        serializationType: formData.get('serializationType') as string,
        countryOfOrigin: (formData.get('countryOfOrigin') as string) || undefined,
        reorderPoint: formData.get('reorderPoint') ? parseFloat(formData.get('reorderPoint') as string) : null,
        targetStockLevel: formData.get('targetStockLevel') ? parseFloat(formData.get('targetStockLevel') as string) : null,
        standardCost: formData.get('standardCost') ? parseFloat(formData.get('standardCost') as string) : null,
        status: formData.get('status') as string,
      });
      setEditingPart(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkSupplier = async () => {
    if (!supplierDialogPart || !linkSupplierId) return;

    setIsSubmitting(true);
    try {
      await linkPartSupplier({
        partId: supplierDialogPart.id,
        supplierId: linkSupplierId,
        supplierPartNumber: linkSupplierPartNum || undefined,
        unitCost: linkUnitCost ? parseFloat(linkUnitCost) : undefined,
        leadTimeDays: linkLeadTime ? parseInt(linkLeadTime, 10) : undefined,
        isPreferred: linkIsPreferred,
      });
      setSupplierDialogPart(null);
      setLinkSupplierId('');
      setLinkSupplierPartNum('');
      setLinkUnitCost('');
      setLinkLeadTime('');
      setLinkIsPreferred(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to link supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkSupplier = async (partId: string, supplierId: string) => {
    if (!confirm('Remove this supplier link?')) return;

    try {
      await unlinkPartSupplier(partId, supplierId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to unlink supplier');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Magnetic: 'bg-purple-100 text-purple-800',
      Electrical: 'bg-yellow-100 text-yellow-800',
      Electronics: 'bg-blue-100 text-blue-800',
      Mechanical: 'bg-slate-100 text-slate-800',
      Hardware: 'bg-gray-100 text-gray-800',
      'Process Materials': 'bg-orange-100 text-orange-800',
      Tooling: 'bg-red-100 text-red-800',
      Packaging: 'bg-green-100 text-green-800',
      Other: 'bg-slate-100 text-slate-600',
    };
    return colors[category] ?? 'bg-slate-100 text-slate-600';
  };

  // Suppliers not yet linked to the current part
  const availableSuppliers = suppliers.filter(
    (s) => !supplierDialogPart?.suppliers.some((ps) => ps.supplier.id === s.id)
  );

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Search
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label>Category:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {PART_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="obsolete">Obsolete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rev</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Suppliers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                  No parts found
                </TableCell>
              </TableRow>
            ) : (
              filteredParts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell className="font-mono font-medium">{part.partNumber}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{part.name}</div>
                      {part.description && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{part.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryColor(part.category)}>
                      {part.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{part.revision}</TableCell>
                  <TableCell className="text-slate-500">{part.unitOfMeasure}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {part.serializationType === 'none' ? 'None' : part.serializationType === 'lot' ? 'Lot' : 'Unit'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      {part.suppliers.length === 0 ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        part.suppliers.map((ps) => (
                          <div key={ps.supplier.id} className="flex items-center gap-1">
                            <span>{ps.supplier.name}</span>
                            {ps.isPreferred && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700">
                                Preferred
                              </Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={part.status === 'active' ? 'default' : 'secondary'}
                      className={part.status === 'active' ? 'bg-green-500' : ''}
                    >
                      {part.status === 'active' ? 'Active' : 'Obsolete'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSupplierDialogPart(part)}
                      >
                        Suppliers
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPart(part)}
                      >
                        Edit
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
      <Dialog open={!!editingPart} onOpenChange={() => setEditingPart(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Part</DialogTitle>
            <DialogDescription>
              Update part master record
            </DialogDescription>
          </DialogHeader>
          {editingPart && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-partNumber">Part Number</Label>
                    <Input
                      id="edit-partNumber"
                      name="partNumber"
                      defaultValue={editingPart.partNumber}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-revision">Revision</Label>
                    <Input
                      id="edit-revision"
                      name="revision"
                      defaultValue={editingPart.revision}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingPart.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    name="description"
                    defaultValue={editingPart.description ?? ''}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select name="category" defaultValue={editingPart.category}>
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
                    <Select name="unitOfMeasure" defaultValue={editingPart.unitOfMeasure}>
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
                  <Select name="serializationType" defaultValue={editingPart.serializationType}>
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
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-reorderPoint">Reorder Point</Label>
                    <Input
                      id="edit-reorderPoint"
                      name="reorderPoint"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingPart.reorderPoint ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-targetStockLevel">Target Stock</Label>
                    <Input
                      id="edit-targetStockLevel"
                      name="targetStockLevel"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingPart.targetStockLevel ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-standardCost">Std Cost ($)</Label>
                    <Input
                      id="edit-standardCost"
                      name="standardCost"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editingPart.standardCost ?? ''}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-countryOfOrigin">Country of Origin</Label>
                  <Input
                    id="edit-countryOfOrigin"
                    name="countryOfOrigin"
                    defaultValue={editingPart.countryOfOrigin ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={editingPart.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="obsolete">Obsolete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPart(null)}>
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

      {/* Supplier Link Dialog */}
      <Dialog open={!!supplierDialogPart} onOpenChange={() => setSupplierDialogPart(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Suppliers</DialogTitle>
            <DialogDescription>
              {supplierDialogPart && (
                <>Suppliers for {supplierDialogPart.partNumber} - {supplierDialogPart.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {supplierDialogPart && (
            <div className="space-y-4 py-4">
              {/* Existing suppliers */}
              {supplierDialogPart.suppliers.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Suppliers</Label>
                  <div className="rounded-lg border divide-y">
                    {supplierDialogPart.suppliers.map((ps) => (
                      <div key={ps.supplier.id} className="flex items-center justify-between p-3">
                        <div>
                          <div className="font-medium text-sm">{ps.supplier.name}</div>
                          <div className="text-xs text-slate-500">
                            {ps.supplier.supplierId}
                            {ps.supplierPartNumber && ` | Supplier P/N: ${ps.supplierPartNumber}`}
                            {ps.unitCost != null && ` | $${ps.unitCost.toFixed(2)}`}
                            {ps.leadTimeDays != null && ` | ${ps.leadTimeDays}d lead`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ps.isPreferred && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                              Preferred
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleUnlinkSupplier(supplierDialogPart.id, ps.supplier.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add supplier form */}
              {availableSuppliers.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Add Supplier</Label>
                  <Select value={linkSupplierId} onValueChange={setLinkSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.supplierId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {linkSupplierId && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Part #</Label>
                          <Input
                            value={linkSupplierPartNum}
                            onChange={(e) => setLinkSupplierPartNum(e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Cost ($)</Label>
                          <Input
                            value={linkUnitCost}
                            onChange={(e) => setLinkUnitCost(e.target.value)}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Lead Time (days)</Label>
                          <Input
                            value={linkLeadTime}
                            onChange={(e) => setLinkLeadTime(e.target.value)}
                            type="number"
                            min="0"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={linkIsPreferred}
                              onChange={(e) => setLinkIsPreferred(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            Preferred supplier
                          </label>
                        </div>
                      </div>
                      <Button
                        onClick={handleLinkSupplier}
                        disabled={isSubmitting}
                        size="sm"
                      >
                        {isSubmitting ? 'Linking...' : 'Link Supplier'}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {availableSuppliers.length === 0 && supplierDialogPart.suppliers.length > 0 && (
                <p className="text-xs text-slate-500 text-center pt-2">
                  All available suppliers are already linked to this part.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
