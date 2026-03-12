'use client';

import { Icons } from '@/components/icons';

interface PreviousExecution {
  id: string;
  stationName: string;
  sequence: number;
  result: string | null;
  cycleTimeMinutes: number | null;
  completedAt: string | null;
  operatorName: string;
}

interface PreviousStationsHistoryProps {
  executions: PreviousExecution[];
}

export function PreviousStationsHistory({ executions }: PreviousStationsHistoryProps) {
  if (executions.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icons.history className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Previous Stations</h3>
      </div>
      <div className="space-y-2">
        {executions.map((exec) => (
          <div
            key={exec.id}
            className="flex items-center justify-between text-sm rounded-md bg-white border border-slate-100 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-600">
                {exec.sequence}
              </span>
              <span className="font-medium text-slate-700">{exec.stationName}</span>
            </div>
            <div className="flex items-center gap-3">
              {exec.cycleTimeMinutes != null && (
                <span className="text-xs text-slate-500 font-mono">
                  {Math.round(exec.cycleTimeMinutes)}m
                </span>
              )}
              {exec.result === 'pass' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <Icons.pass className="h-3.5 w-3.5" />
                  Pass
                </span>
              ) : exec.result === 'fail' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                  <Icons.fail className="h-3.5 w-3.5" />
                  Fail
                </span>
              ) : exec.result === 'rework' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Icons.rework className="h-3.5 w-3.5" />
                  Rework
                </span>
              ) : (
                <span className="text-xs text-slate-400">--</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
