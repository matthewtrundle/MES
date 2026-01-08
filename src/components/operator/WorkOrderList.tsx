'use client';

import { useState } from 'react';
import { WorkOrder, Unit, WorkOrderOperation } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateUnitDialog } from './CreateUnitDialog';

type WorkOrderWithDetails = WorkOrder & {
  units: Unit[];
  operations: WorkOrderOperation[];
};

interface WorkOrderListProps {
  workOrders: WorkOrderWithDetails[];
  stationId: string;
  disabled?: boolean;
}

export function WorkOrderList({ workOrders, stationId, disabled }: WorkOrderListProps) {
  const [selectedWO, setSelectedWO] = useState<string | null>(null);
  const [showCreateUnit, setShowCreateUnit] = useState(false);

  if (workOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Work Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No work orders at this station</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workOrders.map((wo) => {
            const completedCount = wo.units.filter((u) => u.status === 'completed').length;
            const remainingCount = wo.qtyOrdered - completedCount;
            const operation = wo.operations[0];

            return (
              <div
                key={wo.id}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  selectedWO === wo.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50' : ''}`}
                onClick={() => !disabled && setSelectedWO(wo.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{wo.orderNumber}</p>
                    <p className="text-sm text-gray-600">{wo.productCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {completedCount}/{wo.qtyOrdered}
                    </p>
                    <p className="text-xs text-gray-500">{remainingCount} remaining</p>
                  </div>
                </div>

                {wo.priority > 0 && (
                  <span className="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Priority: {wo.priority}
                  </span>
                )}

                {selectedWO === wo.id && (
                  <div className="mt-3 border-t pt-3">
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={disabled || remainingCount <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreateUnit(true);
                      }}
                    >
                      {remainingCount > 0 ? 'Start New Unit' : 'All Units Created'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {selectedWO && (
        <CreateUnitDialog
          open={showCreateUnit}
          onOpenChange={setShowCreateUnit}
          workOrderId={selectedWO}
          stationId={stationId}
        />
      )}
    </>
  );
}
