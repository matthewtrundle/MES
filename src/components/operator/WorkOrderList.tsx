'use client';

import { useState } from 'react';
import { WorkOrder, Unit, WorkOrderOperation } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { CreateUnitDialog } from './CreateUnitDialog';
import { Icons } from '@/components/icons';

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

  return (
    <>
      <div className="industrial-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-3 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 shadow-sm">
              <Icons.document className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 tracking-tight">Work Orders</h3>
              <p className="text-xs text-slate-500">{workOrders.length} available</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {workOrders.length === 0 ? (
            <div className="py-8 text-center">
              <Icons.document className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-slate-500 font-medium">No work orders</p>
              <p className="text-sm text-slate-400">No orders assigned to this station</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => {
                const completedCount = wo.units.filter((u) => u.status === 'completed').length;
                const remainingCount = wo.qtyOrdered - completedCount;
                const progressPercent = Math.round((completedCount / wo.qtyOrdered) * 100);
                const isSelected = selectedWO === wo.id;

                return (
                  <div
                    key={wo.id}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !disabled && setSelectedWO(isSelected ? null : wo.id)}
                  >
                    {/* Work Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-slate-800">{wo.orderNumber}</span>
                          {wo.priority > 0 && (
                            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 uppercase">
                              Priority
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 font-medium">{wo.productCode}</p>
                        {wo.productName && (
                          <p className="text-xs text-slate-400">{wo.productName}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-blue-600">{completedCount}</p>
                        <p className="text-sm text-slate-500">of {wo.qtyOrdered}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-slate-700">{progressPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full transition-all duration-500 ${
                            progressPercent >= 100
                              ? 'bg-green-500'
                              : progressPercent >= 50
                                ? 'bg-blue-500'
                                : 'bg-blue-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Remaining Count */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Remaining</span>
                      <span className={`font-bold ${remainingCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {remainingCount > 0 ? `${remainingCount} units` : 'Complete!'}
                      </span>
                    </div>

                    {/* Action Button (when selected) */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <Button
                          className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                          disabled={disabled || remainingCount <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCreateUnit(true);
                          }}
                        >
                          <Icons.plus className="mr-2 h-5 w-5" />
                          {remainingCount > 0 ? 'Start New Unit' : 'All Units Created'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
