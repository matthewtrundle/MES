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
import { Checkbox } from '@/components/ui/checkbox';
import { updateCTQDefinition, copyCTQsToNewRevision } from '@/lib/actions/admin/ctq-definitions';

type CTQDefinition = {
  id: string;
  partNumber: string;
  revision: string;
  dimensionName: string;
  nominal: number;
  usl: number;
  lsl: number;
  unitOfMeasure: string;
  measurementTool: string | null;
  methodNote: string | null;
  sampleSizeRule: string;
  sampleSize: number | null;
  safetyCritical: boolean;
  source: string;
  active: boolean;
  _count: { measurements: number };
};

type PartRevision = {
  partNumber: string;
  revision: string;
};

const SAMPLE_SIZE_RULES = [
  { value: 'all', label: 'All' },
  { value: 'fixed_count', label: 'Fixed Count' },
  { value: 'aql', label: 'AQL' },
  { value: 'skip', label: 'Skip' },
];

const UNITS_OF_MEASURE = ['mm', 'in', 'um', 'ohm', 'N', 'kg', 'lb', 'V', 'A', 'mA', 'rpm', 'dB', 'psi', 'bar'];

interface CTQTableProps {
  definitions: CTQDefinition[];
  partRevisions: PartRevision[];
}

export function CTQTable({ definitions, partRevisions }: CTQTableProps) {
  const [editingCTQ, setEditingCTQ] = useState<CTQDefinition | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyPartNumber, setCopyPartNumber] = useState('');
  const [copyFromRevision, setCopyFromRevision] = useState('');
  const [copyToRevision, setCopyToRevision] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterPartNumber, setFilterPartNumber] = useState<string>('all');
  const [editSafetyCritical, setEditSafetyCritical] = useState(false);
  const [editSampleSizeRule, setEditSampleSizeRule] = useState('all');

  const uniquePartNumbers = [...new Set(definitions.map((d) => d.partNumber))].sort();

  const filteredDefinitions = definitions.filter(
    (d) => filterPartNumber === 'all' || d.partNumber === filterPartNumber
  );

  const handleEditOpen = (ctq: CTQDefinition) => {
    setEditingCTQ(ctq);
    setEditSafetyCritical(ctq.safetyCritical);
    setEditSampleSizeRule(ctq.sampleSizeRule);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCTQ) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const nominal = parseFloat(formData.get('nominal') as string);
      const usl = parseFloat(formData.get('usl') as string);
      const lsl = parseFloat(formData.get('lsl') as string);

      await updateCTQDefinition(editingCTQ.id, {
        dimensionName: (formData.get('dimensionName') as string).trim(),
        nominal,
        usl,
        lsl,
        unitOfMeasure: formData.get('unitOfMeasure') as string,
        measurementTool: (formData.get('measurementTool') as string)?.trim() || null,
        methodNote: (formData.get('methodNote') as string)?.trim() || null,
        sampleSizeRule: editSampleSizeRule,
        sampleSize: editSampleSizeRule === 'fixed_count'
          ? parseInt(formData.get('sampleSize') as string, 10)
          : null,
        safetyCritical: editSafetyCritical,
        active: formData.get('active') === 'true',
      });
      setEditingCTQ(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRevision = async () => {
    if (!copyPartNumber || !copyFromRevision || !copyToRevision) return;

    setIsSubmitting(true);
    try {
      await copyCTQsToNewRevision(copyPartNumber, copyFromRevision, copyToRevision);
      setCopyDialogOpen(false);
      setCopyPartNumber('');
      setCopyFromRevision('');
      setCopyToRevision('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to copy revisions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCopyDialog = (partNumber: string, revision: string) => {
    setCopyPartNumber(partNumber);
    setCopyFromRevision(revision);
    setCopyToRevision('');
    setCopyDialogOpen(true);
  };

  const formatTolerance = (ctq: CTQDefinition) => {
    const range = ctq.usl - ctq.lsl;
    return `${ctq.nominal} [${ctq.lsl} - ${ctq.usl}] ${ctq.unitOfMeasure} (range: ${range.toFixed(3)})`;
  };

  // Build a tolerance band visual
  const ToleranceBand = ({ ctq }: { ctq: CTQDefinition }) => {
    const range = ctq.usl - ctq.lsl;
    const nominalPct = range > 0 ? ((ctq.nominal - ctq.lsl) / range) * 100 : 50;

    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="text-xs text-red-500 font-mono w-16 text-right">{ctq.lsl}</span>
        <div className="flex-1 relative h-4 bg-gradient-to-r from-red-100 via-green-100 to-red-100 rounded-full border border-slate-200">
          <div
            className="absolute top-0 h-4 w-1 bg-blue-600 rounded-full"
            style={{ left: `${Math.max(2, Math.min(98, nominalPct))}%`, transform: 'translateX(-50%)' }}
            title={`Nominal: ${ctq.nominal}`}
          />
        </div>
        <span className="text-xs text-red-500 font-mono w-16">{ctq.usl}</span>
        <span className="text-xs text-slate-400 ml-1">{ctq.unitOfMeasure}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Label>Filter by Part:</Label>
          <Select value={filterPartNumber} onValueChange={setFilterPartNumber}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Part Numbers</SelectItem>
              {uniquePartNumbers.map((pn) => (
                <SelectItem key={pn} value={pn}>{pn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {partRevisions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (uniquePartNumbers.length > 0) {
                openCopyDialog(uniquePartNumbers[0], 'A');
              }
            }}
          >
            Copy to New Revision
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part / Rev</TableHead>
              <TableHead>Dimension</TableHead>
              <TableHead>Tolerance Band</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Sampling</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDefinitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  No CTQ definitions found. Add dimensions to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredDefinitions.map((ctq) => (
                <TableRow key={ctq.id}>
                  <TableCell>
                    <div className="font-medium">{ctq.partNumber}</div>
                    <div className="text-xs text-slate-400">Rev {ctq.revision}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ctq.dimensionName}</span>
                      {ctq.safetyCritical && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          SC
                        </Badge>
                      )}
                    </div>
                    {ctq.methodNote && (
                      <div className="text-xs text-slate-400 truncate max-w-[200px]" title={ctq.methodNote}>
                        {ctq.methodNote}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <ToleranceBand ctq={ctq} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {ctq.measurementTool || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {SAMPLE_SIZE_RULES.find((r) => r.value === ctq.sampleSizeRule)?.label || ctq.sampleSizeRule}
                      {ctq.sampleSizeRule === 'fixed_count' && ctq.sampleSize && (
                        <span className="ml-1">({ctq.sampleSize})</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ctq.active ? 'default' : 'secondary'}
                      className={ctq.active ? 'bg-green-500' : ''}
                    >
                      {ctq.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {ctq._count.measurements} results
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOpen(ctq)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCopyDialog(ctq.partNumber, ctq.revision)}
                        title="Copy all dimensions to a new revision"
                      >
                        Copy Rev
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
      <Dialog open={!!editingCTQ} onOpenChange={() => setEditingCTQ(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit CTQ Dimension</DialogTitle>
            <DialogDescription>
              Update the CTQ dimension specification for {editingCTQ?.partNumber} Rev {editingCTQ?.revision}
            </DialogDescription>
          </DialogHeader>
          {editingCTQ && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                {/* Part/Rev (read-only) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Part Number</Label>
                    <div className="text-sm text-slate-600 font-mono p-2 bg-slate-50 rounded">
                      {editingCTQ.partNumber}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Revision</Label>
                    <div className="text-sm text-slate-600 font-mono p-2 bg-slate-50 rounded">
                      {editingCTQ.revision}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dimensionName">Dimension Name</Label>
                  <Input
                    id="edit-dimensionName"
                    name="dimensionName"
                    defaultValue={editingCTQ.dimensionName}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Specification Limits</Label>
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor="edit-lsl" className="text-xs text-red-600">LSL (Lower)</Label>
                      <Input
                        id="edit-lsl"
                        name="lsl"
                        type="number"
                        step="any"
                        defaultValue={editingCTQ.lsl}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-nominal" className="text-xs text-blue-600 font-semibold">Nominal</Label>
                      <Input
                        id="edit-nominal"
                        name="nominal"
                        type="number"
                        step="any"
                        defaultValue={editingCTQ.nominal}
                        required
                        className="border-blue-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-usl" className="text-xs text-red-600">USL (Upper)</Label>
                      <Input
                        id="edit-usl"
                        name="usl"
                        type="number"
                        step="any"
                        defaultValue={editingCTQ.usl}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-unitOfMeasure">Unit of Measure</Label>
                  <Select name="unitOfMeasure" defaultValue={editingCTQ.unitOfMeasure}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS_OF_MEASURE.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-measurementTool">Measurement Tool</Label>
                  <Input
                    id="edit-measurementTool"
                    name="measurementTool"
                    defaultValue={editingCTQ.measurementTool || ''}
                    placeholder="e.g., micrometer, CMM"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-methodNote">Method Note</Label>
                  <Input
                    id="edit-methodNote"
                    name="methodNote"
                    defaultValue={editingCTQ.methodNote || ''}
                    placeholder="Instructions for measurement"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sample Size Rule</Label>
                  <Select value={editSampleSizeRule} onValueChange={setEditSampleSizeRule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLE_SIZE_RULES.map((rule) => (
                        <SelectItem key={rule.value} value={rule.value}>{rule.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editSampleSizeRule === 'fixed_count' && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                    <Label htmlFor="edit-sampleSize">Sample Size</Label>
                    <Input
                      id="edit-sampleSize"
                      name="sampleSize"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={editingCTQ.sampleSize || ''}
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <Checkbox
                    id="edit-safetyCritical"
                    checked={editSafetyCritical}
                    onCheckedChange={(checked) => setEditSafetyCritical(checked === true)}
                  />
                  <Label htmlFor="edit-safetyCritical" className="font-medium text-amber-800">
                    Safety Critical Dimension
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="active" defaultValue={editingCTQ.active ? 'true' : 'false'}>
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
                <Button type="button" variant="outline" onClick={() => setEditingCTQ(null)}>
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

      {/* Copy to New Revision Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy CTQ Dimensions to New Revision</DialogTitle>
            <DialogDescription>
              Copy all active CTQ dimensions from one part revision to another
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="copy-partNumber">Part Number</Label>
              <Select value={copyPartNumber} onValueChange={(v) => {
                setCopyPartNumber(v);
                setCopyFromRevision('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select part number" />
                </SelectTrigger>
                <SelectContent>
                  {uniquePartNumbers.map((pn) => (
                    <SelectItem key={pn} value={pn}>{pn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-fromRevision">From Revision</Label>
              <Select value={copyFromRevision} onValueChange={setCopyFromRevision}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source revision" />
                </SelectTrigger>
                <SelectContent>
                  {partRevisions
                    .filter((pr) => pr.partNumber === copyPartNumber)
                    .map((pr) => (
                      <SelectItem key={pr.revision} value={pr.revision}>Rev {pr.revision}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-toRevision">To Revision</Label>
              <Input
                id="copy-toRevision"
                value={copyToRevision}
                onChange={(e) => setCopyToRevision(e.target.value)}
                placeholder="e.g., B"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCopyRevision}
              disabled={isSubmitting || !copyPartNumber || !copyFromRevision || !copyToRevision}
            >
              {isSubmitting ? 'Copying...' : 'Copy Dimensions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
