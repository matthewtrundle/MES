'use client';

import { useState, useTransition } from 'react';
import { QualityCheckDefinition, Prisma } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { recordQualityCheck } from '@/lib/actions/quality';
import { useRouter } from 'next/navigation';

interface QualityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  qualityChecks: QualityCheckDefinition[];
}

export function QualityCheckDialog({
  open,
  onOpenChange,
  unitId,
  qualityChecks,
}: QualityCheckDialogProps) {
  const [selectedCheck, setSelectedCheck] = useState<QualityCheckDefinition | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (result: 'pass' | 'fail') => {
    if (!selectedCheck) return;

    setError(null);
    startTransition(async () => {
      try {
        await recordQualityCheck({
          unitId,
          definitionId: selectedCheck.id,
          result,
          values: values as Prisma.InputJsonValue,
        });
        onOpenChange(false);
        setSelectedCheck(null);
        setValues({});
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record check');
      }
    });
  };

  const params = selectedCheck?.parameters as {
    minValue?: number;
    maxValue?: number;
    nominal?: number;
    unit?: string;
    criteria?: string[];
  } | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quality Check</DialogTitle>
        </DialogHeader>

        {!selectedCheck ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-gray-600">Select a quality check to perform:</p>
            {qualityChecks.map((check) => (
              <Button
                key={check.id}
                variant="outline"
                className="h-auto w-full justify-start py-3 text-left"
                onClick={() => setSelectedCheck(check)}
              >
                <div>
                  <p className="font-medium">{check.name}</p>
                  <p className="text-xs text-gray-500">{check.checkType}</p>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="font-medium">{selectedCheck.name}</p>
              <p className="text-sm text-gray-500">{selectedCheck.checkType}</p>
            </div>

            {selectedCheck.checkType === 'measurement' && params && (
              <div className="space-y-2">
                <Label>Measured Value ({params.unit || 'units'})</Label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
                  placeholder={`Nominal: ${params.nominal}`}
                  value={(values.measured as number) || ''}
                  onChange={(e) =>
                    setValues({ ...values, measured: parseFloat(e.target.value) })
                  }
                  disabled={isPending}
                />
                <p className="text-sm text-gray-500">
                  Range: {params.minValue} - {params.maxValue} {params.unit}
                </p>
              </div>
            )}

            {selectedCheck.checkType === 'pass_fail' && params?.criteria && (
              <div className="space-y-2">
                <Label>Criteria</Label>
                {params.criteria.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`criterion-${idx}`}
                      className="h-5 w-5"
                      checked={!!(values as Record<string, boolean>)[`criterion_${idx}`]}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [`criterion_${idx}`]: e.target.checked,
                        })
                      }
                      disabled={isPending}
                    />
                    <label htmlFor={`criterion-${idx}`} className="text-sm">
                      {criterion}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCheck(null);
                  setValues({});
                }}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleSubmit('fail')}
                disabled={isPending}
              >
                FAIL
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleSubmit('pass')}
                disabled={isPending}
              >
                PASS
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
