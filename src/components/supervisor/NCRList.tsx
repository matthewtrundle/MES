'use client';

import { useState, useTransition } from 'react';
import { NonconformanceRecord, Unit, WorkOrder, Station } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { dispositionNCR, closeNCR } from '@/lib/actions/quality';
import { useRouter } from 'next/navigation';

type NCRWithDetails = NonconformanceRecord & {
  unit: Unit & {
    workOrder: WorkOrder;
  };
  station: Station;
};

interface NCRListProps {
  ncrs: NCRWithDetails[];
}

export function NCRList({ ncrs }: NCRListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const router = useRouter();

  const handleDisposition = (
    ncrId: string,
    disposition: 'rework' | 'scrap' | 'use_as_is' | 'defer'
  ) => {
    setProcessingId(ncrId);
    startTransition(async () => {
      try {
        await dispositionNCR(ncrId, disposition);
        router.refresh();
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleClose = (ncrId: string) => {
    setProcessingId(ncrId);
    startTransition(async () => {
      try {
        await closeNCR(ncrId);
        router.refresh();
      } finally {
        setProcessingId(null);
      }
    });
  };

  if (ncrs.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-gray-500">No active NCRs</p>
        <p className="text-sm text-gray-400">All non-conformances have been resolved</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ncrs.map((ncr) => {
        const isExpanded = expandedId === ncr.id;
        const isProcessing = processingId === ncr.id;

        return (
          <div
            key={ncr.id}
            className={`rounded-lg border ${
              ncr.status === 'open'
                ? 'border-red-200 bg-red-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}
          >
            {/* Header */}
            <div
              className="flex cursor-pointer items-center justify-between p-4"
              onClick={() => setExpandedId(isExpanded ? null : ncr.id)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ncr.unit.serialNumber}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      ncr.status === 'open'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {ncr.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{ncr.defectType}</p>
                <p className="text-xs text-gray-500">
                  {ncr.station.name} • {new Date(ncr.createdAt).toLocaleString()}
                </p>
              </div>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3">
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Work Order</p>
                    <p className="font-medium">
                      {ncr.unit.workOrder.orderNumber} -{' '}
                      {ncr.unit.workOrder.productCode}
                    </p>
                  </div>
                  {ncr.description && (
                    <div>
                      <p className="text-sm text-gray-500">Description</p>
                      <p className="text-sm">{ncr.description}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {ncr.status === 'open' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Select Disposition:</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        variant="outline"
                        className="border-orange-300 hover:bg-orange-50"
                        onClick={() => handleDisposition(ncr.id, 'rework')}
                        disabled={isProcessing}
                      >
                        Rework
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 hover:bg-red-50"
                        onClick={() => handleDisposition(ncr.id, 'scrap')}
                        disabled={isProcessing}
                      >
                        Scrap
                      </Button>
                      <Button
                        variant="outline"
                        className="border-green-300 hover:bg-green-50"
                        onClick={() => handleDisposition(ncr.id, 'use_as_is')}
                        disabled={isProcessing}
                      >
                        Use As Is
                      </Button>
                      <Button
                        variant="outline"
                        className="border-gray-300 hover:bg-gray-100"
                        onClick={() => handleDisposition(ncr.id, 'defer')}
                        disabled={isProcessing}
                      >
                        Defer
                      </Button>
                    </div>
                  </div>
                )}

                {ncr.status === 'dispositioned' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500">Disposition:</p>
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-sm font-medium text-yellow-700">
                        {ncr.disposition}
                      </span>
                    </div>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleClose(ncr.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Closing...' : 'Close NCR'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
