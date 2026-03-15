'use client';

import { useState, useTransition } from 'react';
import { DowntimeInterval, DowntimeReason, User } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { selectDowntimeReason } from '@/lib/actions/downtime';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type DowntimeWithDetails = DowntimeInterval & {
  reason: DowntimeReason | null;
  operator: User;
};

interface DowntimePanelProps {
  downtime: DowntimeWithDetails;
  reasons: DowntimeReason[];
  stationId: string;
}

export function DowntimePanel({ downtime, reasons, stationId }: DowntimePanelProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const elapsedMinutes = Math.round(
    (Date.now() - new Date(downtime.startedAt).getTime()) / 60000
  );

  const handleSelectReason = (reasonId: string) => {
    startTransition(async () => {
      try {
        await selectDowntimeReason(downtime.id, reasonId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to select reason');
      }
    });
  };

  // Group reasons by planned/unplanned
  const plannedReasons = reasons.filter((r) => r.isPlanned);
  const unplannedReasons = reasons.filter((r) => !r.isPlanned);

  return (
    <Card className="mb-4 border-2 border-yellow-400 bg-yellow-50" data-testid="downtime-panel">
      <CardHeader className="bg-yellow-400 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-yellow-900">
            Downtime Active
          </CardTitle>
          <span className="text-2xl font-bold text-yellow-900" data-testid="downtime-elapsed">
            {elapsedMinutes} min
          </span>
        </div>
        <p className="text-sm text-yellow-800">
          Started by {downtime.operator.name} at{' '}
          {new Date(downtime.startedAt).toLocaleTimeString()}
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        {downtime.reason ? (
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-500">Reason Selected</p>
            <p className="text-lg font-bold text-gray-900" data-testid="downtime-selected-reason">
              {downtime.reason.code}: {downtime.reason.description}
            </p>
            <span
              className={`mt-2 inline-block rounded px-2 py-1 text-xs ${
                downtime.reason.isPlanned
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {downtime.reason.isPlanned ? 'Planned' : 'Unplanned'} - {downtime.reason.lossType}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-medium text-yellow-900">Select Downtime Reason:</p>

            {unplannedReasons.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-red-700">Unplanned</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {unplannedReasons.map((reason) => (
                    <Button
                      key={reason.id}
                      data-testid={`downtime-reason-${reason.id}`}
                      variant="outline"
                      className="h-auto border-red-200 py-3 text-left hover:bg-red-50"
                      onClick={() => handleSelectReason(reason.id)}
                      disabled={isPending}
                    >
                      <div>
                        <p className="font-medium">{reason.code}</p>
                        <p className="text-xs text-gray-500">{reason.description}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {plannedReasons.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-blue-700">Planned</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {plannedReasons.map((reason) => (
                    <Button
                      key={reason.id}
                      data-testid={`downtime-reason-${reason.id}`}
                      variant="outline"
                      className="h-auto border-blue-200 py-3 text-left hover:bg-blue-50"
                      onClick={() => handleSelectReason(reason.id)}
                      disabled={isPending}
                    >
                      <div>
                        <p className="font-medium">{reason.code}</p>
                        <p className="text-xs text-gray-500">{reason.description}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
