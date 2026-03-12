'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  getInspectionResults,
  dispositionConforming,
  dispositionNonconforming,
  approveUAI,
} from '@/lib/actions/iqc';

type MaterialLotInfo = {
  id: string;
  lotNumber: string;
  materialCode: string;
  description: string | null;
  qtyReceived: number;
  unitOfMeasure: string;
  supplier: string | null;
  supplierRef: {
    name: string;
  } | null;
};

type ResultGroup = {
  ctqDefinition: {
    id: string;
    dimensionName: string;
    nominal: number;
    usl: number;
    lsl: number;
    unitOfMeasure: string;
    safetyCritical: boolean;
  };
  measurements: Array<{
    sampleNumber: number;
    measuredValue: number;
    result: string;
  }>;
};

interface IQCDispositionDialogProps {
  inspectionId: string;
  materialLot: MaterialLotInfo;
  overallResult: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IQCDispositionDialog({
  inspectionId,
  materialLot,
  overallResult,
  open,
  onOpenChange,
}: IQCDispositionDialogProps) {
  const [resultGroups, setResultGroups] = useState<ResultGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disposition form state
  const [disposition, setDisposition] = useState<
    'conforming' | 'rework' | 'uai' | 'scrap'
  >('conforming');
  const [defectType, setDefectType] = useState('');
  const [description, setDescription] = useState('');
  const [dispositionRationale, setDispositionRationale] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [responsibleParty, setResponsibleParty] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [conformingNotes, setConformingNotes] = useState('');

  // UAI approval state
  const [approverNotes, setApproverNotes] = useState('');

  const isUAIApproval = overallResult === 'nonconforming_uai';

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const grouped = await getInspectionResults(inspectionId);
      const groups: ResultGroup[] = Object.values(grouped);
      setResultGroups(groups);

      // Auto-select disposition based on results
      const hasFailures = groups.some((g) =>
        g.measurements.some((m) => m.result === 'fail')
      );
      if (hasFailures) {
        setDisposition('rework');
      }
    } catch {
      setError('Failed to load inspection results');
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    if (open) {
      loadResults();
    }
  }, [open, loadResults]);

  const totalMeasurements = resultGroups.reduce(
    (sum, g) => sum + g.measurements.length,
    0
  );
  const passCount = resultGroups.reduce(
    (sum, g) => sum + g.measurements.filter((m) => m.result === 'pass').length,
    0
  );
  const failCount = totalMeasurements - passCount;

  const failedCtqs = resultGroups.filter((g) =>
    g.measurements.some((m) => m.result === 'fail')
  );

  const handleSubmitDisposition = async () => {
    setSubmitting(true);
    setError(null);

    try {
      if (disposition === 'conforming') {
        await dispositionConforming(inspectionId, conformingNotes || undefined);
      } else {
        if (!defectType.trim()) {
          setError('Defect type is required for nonconforming dispositions');
          setSubmitting(false);
          return;
        }
        if (!dispositionRationale.trim()) {
          setError('Disposition rationale is required');
          setSubmitting(false);
          return;
        }

        await dispositionNonconforming(inspectionId, disposition, {
          defectType,
          description: description || undefined,
          dispositionRationale,
          correctiveAction: correctiveAction || undefined,
          responsibleParty: responsibleParty || undefined,
          actionDueDate: actionDueDate ? new Date(actionDueDate) : undefined,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit disposition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveUAI = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await approveUAI(inspectionId, approverNotes || undefined);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve UAI');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading results...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // UAI Approval view
  if (isUAIApproval) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>UAI Approval Required</DialogTitle>
            <DialogDescription>
              Lot {materialLot.lotNumber} | {materialLot.materialCode} requires
              engineer sign-off for Use-As-Is disposition.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-orange-50 border border-orange-200 rounded-md p-4 text-sm text-orange-800">
            This material lot has been dispositioned as Use-As-Is (UAI). Engineer
            approval is required before the lot can be released for production use.
          </div>

          {/* Show failed CTQs */}
          {failedCtqs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Failed CTQ Dimensions:</p>
              {failedCtqs.map((group) => (
                <div
                  key={group.ctqDefinition.id}
                  className="bg-red-50 border border-red-200 rounded-md p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.ctqDefinition.dimensionName}</span>
                    {group.ctqDefinition.safetyCritical && (
                      <Badge className="bg-red-600 text-white text-[10px]">
                        SAFETY CRITICAL
                      </Badge>
                    )}
                  </div>
                  <div className="text-slate-500 mt-1">
                    Spec: {group.ctqDefinition.lsl} - {group.ctqDefinition.usl}{' '}
                    {group.ctqDefinition.unitOfMeasure} (nom: {group.ctqDefinition.nominal})
                  </div>
                  <div className="mt-1">
                    {group.measurements
                      .filter((m) => m.result === 'fail')
                      .map((m) => (
                        <span key={m.sampleNumber} className="text-red-700 mr-3">
                          Sample #{m.sampleNumber}: {m.measuredValue}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="approver-notes">Approval Notes</Label>
            <Textarea
              id="approver-notes"
              value={approverNotes}
              onChange={(e) => setApproverNotes(e.target.value)}
              placeholder="Document rationale for approving UAI disposition..."
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveUAI}
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? 'Approving...' : 'Approve & Release Lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Disposition form view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Disposition</DialogTitle>
          <DialogDescription>
            Lot {materialLot.lotNumber} | {materialLot.materialCode}
            {materialLot.supplierRef ? ` | ${materialLot.supplierRef.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <div className="text-xl font-bold">{totalMeasurements}</div>
              <p className="text-xs text-slate-500">Measurements</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <div className="text-xl font-bold text-green-600">{passCount}</div>
              <p className="text-xs text-slate-500">Pass</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-2 text-center">
              <div className="text-xl font-bold text-red-600">{failCount}</div>
              <p className="text-xs text-slate-500">Fail</p>
            </CardContent>
          </Card>
        </div>

        {/* Failed CTQ highlights */}
        {failedCtqs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm font-medium text-red-800 mb-2">
              Failed Dimensions ({failedCtqs.length}):
            </p>
            <div className="space-y-1">
              {failedCtqs.map((group) => (
                <div key={group.ctqDefinition.id} className="text-sm text-red-700 flex items-center gap-2">
                  <span>{group.ctqDefinition.dimensionName}</span>
                  {group.ctqDefinition.safetyCritical && (
                    <Badge className="bg-red-600 text-white text-[10px]">SAFETY</Badge>
                  )}
                  <span className="text-red-500">
                    ({group.measurements.filter((m) => m.result === 'fail').length} failed)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disposition selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Disposition Decision</Label>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDisposition('conforming')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                disposition === 'conforming'
                  ? 'border-green-500 bg-green-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    disposition === 'conforming'
                      ? 'border-green-500'
                      : 'border-slate-300'
                  }`}
                >
                  {disposition === 'conforming' && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
                <span className="font-medium text-green-700">Conforming</span>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Material meets specifications. Release to available inventory.
              </p>
            </button>

            <button
              onClick={() => setDisposition('rework')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                disposition === 'rework'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    disposition === 'rework'
                      ? 'border-yellow-500'
                      : 'border-slate-300'
                  }`}
                >
                  {disposition === 'rework' && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  )}
                </div>
                <span className="font-medium text-yellow-700">Nonconforming - Rework</span>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Material requires rework. NCR will be created. Lot stays quarantined.
              </p>
            </button>

            <button
              onClick={() => setDisposition('uai')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                disposition === 'uai'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    disposition === 'uai'
                      ? 'border-orange-500'
                      : 'border-slate-300'
                  }`}
                >
                  {disposition === 'uai' && (
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </div>
                <span className="font-medium text-orange-700">Nonconforming - UAI</span>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Use As Is. Requires engineer approval before release.
              </p>
            </button>

            <button
              onClick={() => setDisposition('scrap')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                disposition === 'scrap'
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    disposition === 'scrap'
                      ? 'border-red-500'
                      : 'border-slate-300'
                  }`}
                >
                  {disposition === 'scrap' && (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </div>
                <span className="font-medium text-red-700">Nonconforming - Scrap</span>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Material is not usable. NCR created. Lot stays quarantined.
              </p>
            </button>
          </div>
        </div>

        {/* Conforming notes */}
        {disposition === 'conforming' && (
          <div>
            <Label htmlFor="conforming-notes">Notes (optional)</Label>
            <Textarea
              id="conforming-notes"
              value={conformingNotes}
              onChange={(e) => setConformingNotes(e.target.value)}
              placeholder="Optional notes for conforming disposition..."
              rows={2}
            />
          </div>
        )}

        {/* Nonconforming fields */}
        {disposition !== 'conforming' && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label htmlFor="defect-type">Defect Type *</Label>
              <Input
                id="defect-type"
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                placeholder="e.g., Dimensional out of spec, Surface defect"
              />
            </div>

            <div>
              <Label htmlFor="ncr-description">Description</Label>
              <Textarea
                id="ncr-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of the nonconformance..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="disposition-rationale">Disposition Rationale *</Label>
              <Textarea
                id="disposition-rationale"
                value={dispositionRationale}
                onChange={(e) => setDispositionRationale(e.target.value)}
                placeholder="Explain why this disposition was chosen..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="corrective-action">Corrective Action</Label>
              <Textarea
                id="corrective-action"
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Corrective actions to be taken..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsible-party">Responsible Party</Label>
                <Input
                  id="responsible-party"
                  value={responsibleParty}
                  onChange={(e) => setResponsibleParty(e.target.value)}
                  placeholder="Person or team responsible"
                />
              </div>
              <div>
                <Label htmlFor="action-due-date">Action Due Date</Label>
                <Input
                  id="action-due-date"
                  type="date"
                  value={actionDueDate}
                  onChange={(e) => setActionDueDate(e.target.value)}
                />
              </div>
            </div>

            {disposition === 'uai' && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-800">
                After submitting, this lot will remain quarantined until an engineer
                approves the Use-As-Is disposition.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitDisposition}
            disabled={submitting}
            className={
              disposition === 'conforming'
                ? 'bg-green-600 hover:bg-green-700'
                : disposition === 'rework'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : disposition === 'uai'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-red-600 hover:bg-red-700'
            }
          >
            {submitting
              ? 'Submitting...'
              : disposition === 'conforming'
                ? 'Release as Conforming'
                : `Submit ${disposition.toUpperCase()} Disposition`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
