'use client';

import { useState, useTransition } from 'react';
import { Unit, WorkOrder, UnitOperationExecution, WorkOrderOperation, User, QualityCheckDefinition } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { completeOperation } from '@/lib/actions/units';
import { useRouter } from 'next/navigation';
import { QualityCheckDialog } from './QualityCheckDialog';
import { MaterialConsumptionDialog } from './MaterialConsumptionDialog';

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
      <Card className={`border-2 ${disabled ? 'opacity-50' : 'border-blue-500'}`}>
        <CardHeader className="bg-blue-50 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{unit.serialNumber}</CardTitle>
            <span
              className={`rounded px-2 py-1 text-sm font-medium ${
                unit.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : unit.status === 'rework'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {unit.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{unit.workOrder.orderNumber} - {unit.workOrder.productCode}</span>
            {activeExecution && (
              <span className="font-medium">
                {elapsedMinutes} min elapsed
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {activeExecution ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Current Operation</p>
                <p className="font-medium">
                  Step {activeExecution.operation.sequence}
                  {activeExecution.operation.estimatedMinutes && (
                    <span className="ml-2 text-sm text-gray-500">
                      (Est. {activeExecution.operation.estimatedMinutes} min)
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  Started by {activeExecution.operator.name}
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16"
                  onClick={() => setShowMaterial(true)}
                  disabled={disabled || isPending}
                >
                  Record Material
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16"
                  onClick={() => setShowQuality(true)}
                  disabled={disabled || isPending || qualityChecks.length === 0}
                >
                  Quality Check
                </Button>
              </div>

              {/* Complete Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-20 text-lg"
                  onClick={() => handleComplete('fail')}
                  disabled={disabled || isPending}
                >
                  {isPending ? 'Processing...' : 'FAIL'}
                </Button>
                <Button
                  size="lg"
                  className="h-20 bg-green-600 text-lg hover:bg-green-700"
                  onClick={() => handleComplete('pass')}
                  disabled={disabled || isPending}
                >
                  {isPending ? 'Processing...' : 'PASS'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500">
              No active operation. Start an operation to continue.
            </p>
          )}
        </CardContent>
      </Card>

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
