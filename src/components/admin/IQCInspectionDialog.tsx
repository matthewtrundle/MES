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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getCTQsForInspection,
  recordMeasurement,
  getInspectionResults,
} from '@/lib/actions/iqc';

function getSampleCount(ctq: { sampleSizeRule: string; sampleSize?: number | null }, lotQty?: number): number {
  switch (ctq.sampleSizeRule) {
    case 'all': return lotQty ?? 1;
    case 'fixed_count': return ctq.sampleSize ?? 1;
    case 'aql': return ctq.sampleSize ?? Math.max(1, Math.min(8, Math.ceil((lotQty ?? 10) * 0.1)));
    case 'skip': return 0;
    default: return 1;
  }
}

type CTQDef = {
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
};

type MeasurementResult = {
  ctqDefinitionId: string;
  sampleNumber: number;
  measuredValue: number;
  result: string;
  notes?: string | null;
};

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

interface IQCInspectionDialogProps {
  inspectionId: string;
  materialLot: MaterialLotInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function IQCInspectionDialog({
  inspectionId,
  materialLot,
  open,
  onOpenChange,
  onComplete,
}: IQCInspectionDialogProps) {
  const [ctqs, setCtqs] = useState<CTQDef[]>([]);
  const [currentCtqIndex, setCurrentCtqIndex] = useState(0);
  const [currentSample, setCurrentSample] = useState(1);
  const [measuredValue, setMeasuredValue] = useState('');
  const [notes, setNotes] = useState('');
  const [allResults, setAllResults] = useState<MeasurementResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ctqDefs, existingResults] = await Promise.all([
        getCTQsForInspection(inspectionId),
        getInspectionResults(inspectionId),
      ]);
      setCtqs(ctqDefs);

      // Flatten existing results
      const flat: MeasurementResult[] = [];
      for (const group of Object.values(existingResults)) {
        for (const m of group.measurements) {
          flat.push({
            ctqDefinitionId: m.ctqDefinitionId,
            sampleNumber: m.sampleNumber,
            measuredValue: m.measuredValue,
            result: m.result,
            notes: m.notes,
          });
        }
      }
      setAllResults(flat);

      // If there are existing results, jump to where we left off
      if (flat.length > 0 && ctqDefs.length > 0) {
        // Find the first CTQ with incomplete samples
        for (let i = 0; i < ctqDefs.length; i++) {
          const sampleCount = getSampleCount(ctqDefs[i], materialLot.qtyReceived);
          const doneForCtq = flat.filter((r) => r.ctqDefinitionId === ctqDefs[i].id).length;
          if (doneForCtq < sampleCount) {
            setCurrentCtqIndex(i);
            setCurrentSample(doneForCtq + 1);
            break;
          }
          // If all CTQs complete, show summary
          if (i === ctqDefs.length - 1) {
            setShowSummary(true);
          }
        }
      }
    } catch {
      setError('Failed to load CTQ definitions');
    } finally {
      setLoading(false);
    }
  }, [inspectionId, materialLot.qtyReceived]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const currentCtq = ctqs[currentCtqIndex];
  const totalCtqs = ctqs.length;
  const sampleCount = currentCtq ? getSampleCount(currentCtq, materialLot.qtyReceived) : 1;

  const numValue = parseFloat(measuredValue);
  const isWithinSpec =
    measuredValue !== '' && !isNaN(numValue) && currentCtq
      ? numValue >= currentCtq.lsl && numValue <= currentCtq.usl
      : null;

  const handleRecordMeasurement = async () => {
    if (measuredValue === '' || isNaN(numValue) || !currentCtq) return;

    setSaving(true);
    setError(null);
    try {
      const result = await recordMeasurement({
        inspectionId,
        ctqDefinitionId: currentCtq.id,
        sampleNumber: currentSample,
        measuredValue: numValue,
        notes: notes || undefined,
      });

      // Add to local results
      setAllResults((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(r.ctqDefinitionId === currentCtq.id && r.sampleNumber === currentSample)
        );
        return [
          ...filtered,
          {
            ctqDefinitionId: currentCtq.id,
            sampleNumber: currentSample,
            measuredValue: numValue,
            result: result.result,
            notes: notes || null,
          },
        ];
      });

      // Clear inputs
      setMeasuredValue('');
      setNotes('');

      // Advance to next sample or CTQ
      if (currentSample < sampleCount) {
        setCurrentSample(currentSample + 1);
      } else if (currentCtqIndex < totalCtqs - 1) {
        setCurrentCtqIndex(currentCtqIndex + 1);
        setCurrentSample(1);
      } else {
        // All done, show summary
        setShowSummary(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record measurement');
    } finally {
      setSaving(false);
    }
  };

  const totalMeasurements = ctqs.reduce(
    (sum, ctq) => sum + getSampleCount(ctq, materialLot.qtyReceived),
    0
  );
  const completedMeasurements = allResults.length;
  const progress = totalMeasurements > 0 ? (completedMeasurements / totalMeasurements) * 100 : 0;

  const passCount = allResults.filter((r) => r.result === 'pass').length;
  const failCount = allResults.filter((r) => r.result === 'fail').length;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading inspection data...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (ctqs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>No CTQ Definitions</DialogTitle>
            <DialogDescription>
              No active CTQ definitions found for material code {materialLot.materialCode}.
              Please configure CTQ definitions before performing inspections.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Summary view after all measurements
  if (showSummary) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspection Summary</DialogTitle>
            <DialogDescription>
              Lot {materialLot.lotNumber} | {materialLot.materialCode}
              {materialLot.supplierRef ? ` | ${materialLot.supplierRef.name}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 my-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold">{allResults.length}</div>
                <p className="text-xs text-slate-500">Total Measurements</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-green-600">{passCount}</div>
                <p className="text-xs text-slate-500">Pass</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-red-600">{failCount}</div>
                <p className="text-xs text-slate-500">Fail</p>
              </CardContent>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">LSL</TableHead>
                <TableHead className="text-right">USL</TableHead>
                <TableHead>Sample</TableHead>
                <TableHead className="text-right">Measured</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ctqs.map((ctq) => {
                const ctqResults = allResults.filter(
                  (r) => r.ctqDefinitionId === ctq.id
                );
                return ctqResults.map((result, idx) => (
                  <TableRow
                    key={`${ctq.id}-${result.sampleNumber}`}
                    className={result.result === 'fail' ? 'bg-red-50' : ''}
                  >
                    {idx === 0 ? (
                      <TableCell rowSpan={ctqResults.length} className="font-medium">
                        <div className="flex items-center gap-2">
                          {ctq.dimensionName}
                          {ctq.safetyCritical && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                              SAFETY CRITICAL
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{ctq.unitOfMeasure}</div>
                      </TableCell>
                    ) : null}
                    {idx === 0 ? (
                      <>
                        <TableCell rowSpan={ctqResults.length} className="text-right font-mono text-sm">
                          {ctq.nominal}
                        </TableCell>
                        <TableCell rowSpan={ctqResults.length} className="text-right font-mono text-sm">
                          {ctq.lsl}
                        </TableCell>
                        <TableCell rowSpan={ctqResults.length} className="text-right font-mono text-sm">
                          {ctq.usl}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="text-sm">#{result.sampleNumber}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {result.measuredValue}
                    </TableCell>
                    <TableCell>
                      {result.result === 'pass' ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">Pass</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200">Fail</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowSummary(false);
                // Go back to last CTQ
                setCurrentCtqIndex(totalCtqs - 1);
                const lastSampleCount = getSampleCount(ctqs[totalCtqs - 1], materialLot.qtyReceived);
                setCurrentSample(lastSampleCount);
              }}
            >
              Back to Measurements
            </Button>
            <Button onClick={() => onComplete()}>
              Proceed to Disposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Measurement entry view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>IQC Inspection</DialogTitle>
          <DialogDescription>
            Lot {materialLot.lotNumber} | {materialLot.materialCode}
            {materialLot.supplierRef ? ` | ${materialLot.supplierRef.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              CTQ {currentCtqIndex + 1} of {totalCtqs}
            </span>
            <span className="text-slate-500">
              {completedMeasurements} / {totalMeasurements} measurements
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* CTQ Info */}
        {currentCtq && (
          <Card className="border-2">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{currentCtq.dimensionName}</h3>
                {currentCtq.safetyCritical && (
                  <Badge className="bg-red-600 text-white">
                    SAFETY CRITICAL
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 block">Nominal</span>
                  <span className="font-mono font-medium">
                    {currentCtq.nominal} {currentCtq.unitOfMeasure}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">LSL</span>
                  <span className="font-mono font-medium text-red-600">
                    {currentCtq.lsl} {currentCtq.unitOfMeasure}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">USL</span>
                  <span className="font-mono font-medium text-red-600">
                    {currentCtq.usl} {currentCtq.unitOfMeasure}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tolerance</span>
                  <span className="font-mono font-medium">
                    +/- {((currentCtq.usl - currentCtq.lsl) / 2).toFixed(4)}
                  </span>
                </div>
              </div>

              {currentCtq.measurementTool && (
                <div className="text-sm">
                  <span className="text-slate-500">Tool: </span>
                  <span className="font-medium">{currentCtq.measurementTool}</span>
                </div>
              )}

              {currentCtq.methodNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  {currentCtq.methodNote}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Measurement Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="measured-value" className="text-base">
              Sample {currentSample} of {sampleCount}
            </Label>
            {measuredValue !== '' && isWithinSpec !== null && (
              <Badge
                className={
                  isWithinSpec
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }
              >
                {isWithinSpec ? 'PASS' : 'FAIL'}
              </Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Input
              id="measured-value"
              type="number"
              step="any"
              placeholder={`Enter measured value (${currentCtq?.unitOfMeasure ?? ''})`}
              value={measuredValue}
              onChange={(e) => setMeasuredValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRecordMeasurement();
              }}
              className={
                measuredValue !== '' && isWithinSpec !== null
                  ? isWithinSpec
                    ? 'border-green-500 ring-green-200'
                    : 'border-red-500 ring-red-200'
                  : ''
              }
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="measurement-notes" className="text-sm text-slate-500">
              Notes (optional)
            </Label>
            <Textarea
              id="measurement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional measurement notes..."
              rows={2}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Completed samples for current CTQ */}
        {allResults.filter((r) => r.ctqDefinitionId === currentCtq?.id).length > 0 && (
          <div className="border rounded-md p-3 bg-slate-50">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              Completed samples for {currentCtq?.dimensionName}
            </p>
            <div className="flex flex-wrap gap-2">
              {allResults
                .filter((r) => r.ctqDefinitionId === currentCtq?.id)
                .map((r) => (
                  <Badge
                    key={`${r.ctqDefinitionId}-${r.sampleNumber}`}
                    className={
                      r.result === 'pass'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }
                  >
                    #{r.sampleNumber}: {r.measuredValue}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentCtqIndex === 0 && currentSample === 1}
                onClick={() => {
                  if (currentSample > 1) {
                    setCurrentSample(currentSample - 1);
                  } else if (currentCtqIndex > 0) {
                    setCurrentCtqIndex(currentCtqIndex - 1);
                    const prevSampleCount = getSampleCount(
                      ctqs[currentCtqIndex - 1],
                      materialLot.qtyReceived
                    );
                    setCurrentSample(prevSampleCount);
                  }
                  setMeasuredValue('');
                  setNotes('');
                }}
              >
                Previous
              </Button>
              {completedMeasurements === totalMeasurements && (
                <Button
                  variant="outline"
                  onClick={() => setShowSummary(true)}
                >
                  View Summary
                </Button>
              )}
            </div>
            <Button
              onClick={handleRecordMeasurement}
              disabled={saving || measuredValue === '' || isNaN(numValue)}
            >
              {saving
                ? 'Saving...'
                : currentSample === sampleCount && currentCtqIndex === totalCtqs - 1
                  ? 'Record & Finish'
                  : 'Record & Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
