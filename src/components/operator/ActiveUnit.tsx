'use client';

import { useState, useTransition } from 'react';
import { Unit, WorkOrder, UnitOperationExecution, WorkOrderOperation, User, QualityCheckDefinition } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { completeOperation } from '@/lib/actions/units';
import { useRouter } from 'next/navigation';
import { QualityCheckDialog } from './QualityCheckDialog';
import { MaterialConsumptionDialog } from './MaterialConsumptionDialog';
import { Icons, StatusIndicator, UnitStatusBadge } from '@/components/icons';

type UnitWithDetails = Unit & {
  workOrder: WorkOrder;
  executions: (UnitOperationExecution & {
    operation: WorkOrderOperation;
    operator: User;
  })[];
};

interface ActiveUnitProps {
  unit: UnitWithDetails;
  stationId: string;
  qualityChecks: QualityCheckDefinition[];
  disabled?: boolean;
}

export function ActiveUnit({ unit, stationId, qualityChecks, disabled }: ActiveUnitProps) {
  const [isPending, startTransition] = useTransition();
  const [showQuality, setShowQuality] = useState(false);
  const [showMaterial, setShowMaterial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const activeExecution = unit.executions[0];
  const elapsedMinutes = activeExecution
    ? Math.round((Date.now() - new Date(activeExecution.startedAt).getTime()) / 60000)
    : 0;
  const estimatedMinutes = activeExecution?.operation?.estimatedMinutes;
  const isOverTime = estimatedMinutes && elapsedMinutes > estimatedMinutes;

  const handleComplete = (result: 'pass' | 'fail') => {
    if (!activeExecution) return;

    setError(null);
    startTransition(async () => {
      try {
        await completeOperation(activeExecution.id, result);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete operation');
      }
    });
  };

  return (
    <>
      <div className={`industrial-card overflow-hidden ${disabled ? 'opacity-50' : ''}`}>
        {/* Unit Header */}
        <div className={`px-5 py-4 ${
          unit.status === 'rework'
            ? 'bg-gradient-to-r from-orange-500 to-orange-600'
            : 'bg-gradient-to-r from-blue-500 to-blue-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <Icons.unit className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{unit.serialNumber}</h2>
                <p className="text-sm text-white/80">
                  {unit.workOrder.orderNumber} • {unit.workOrder.productCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusIndicator
                status={unit.status === 'rework' ? 'downtime' : 'running'}
                size="lg"
                pulse
              />
              <UnitStatusBadge status={unit.status as 'in_progress' | 'rework'} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeExecution ? (
            <div className="space-y-5">
              {/* Operation Info */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
                      <Icons.activity className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current Operation</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    Started by <span className="font-medium text-slate-700">{activeExecution.operator.name}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-800">
                      Step {activeExecution.operation.sequence}
                    </p>
                    {estimatedMinutes && (
                      <p className="text-sm text-slate-500">
                        Estimated: {estimatedMinutes} min
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold font-mono ${
                      isOverTime ? 'text-amber-600' : 'text-slate-700'
                    }`}>
                      {elapsedMinutes}<span className="text-lg">m</span>
                    </p>
                    {isOverTime && (
                      <p className="text-xs text-amber-600 font-medium">Over estimated time</p>
                    )}
                  </div>
                </div>

                {/* Progress bar for time */}
                {estimatedMinutes && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full transition-all ${
                          isOverTime ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, (elapsedMinutes / estimatedMinutes) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                  <Icons.warning className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 text-base border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => setShowMaterial(true)}
                  disabled={disabled || isPending}
                >
                  <Icons.material className="mr-2 h-5 w-5" />
                  Record Material
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 text-base border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => setShowQuality(true)}
                  disabled={disabled || isPending || qualityChecks.length === 0}
                >
                  <Icons.qualityPass className="mr-2 h-5 w-5" />
                  Quality Check
                </Button>
              </div>

              {/* Pass/Fail Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  size="lg"
                  className="h-24 text-xl font-bold bg-red-600 hover:bg-red-700 shadow-lg"
                  onClick={() => handleComplete('fail')}
                  disabled={disabled || isPending}
                >
                  {isPending ? (
                    <Icons.clock className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Icons.fail className="mr-3 h-7 w-7" />
                      FAIL
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  className="h-24 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg"
                  onClick={() => handleComplete('pass')}
                  disabled={disabled || isPending}
                >
                  {isPending ? (
                    <Icons.clock className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Icons.pass className="mr-3 h-7 w-7" />
                      PASS
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Icons.clock className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-700">No active operation</p>
              <p className="text-sm text-slate-500">Start an operation to continue</p>
            </div>
          )}
        </div>
      </div>

      <QualityCheckDialog
        open={showQuality}
        onOpenChange={setShowQuality}
        unitId={unit.id}
        qualityChecks={qualityChecks}
      />

      <MaterialConsumptionDialog
        open={showMaterial}
        onOpenChange={setShowMaterial}
        unitId={unit.id}
        stationId={stationId}
      />
    </>
  );
}
