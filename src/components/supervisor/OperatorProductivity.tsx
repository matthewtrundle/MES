'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getOperatorProductivity,
  getOperatorTrend,
  type OperatorProductivityRow,
  type OperatorTrendPoint,
} from '@/lib/actions/operator-analytics';
import { OperatorTrendChart } from './OperatorTrendChart';

function fpyColor(fpy: number): string {
  if (fpy >= 95) return 'bg-green-100 text-green-800';
  if (fpy >= 85) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

interface OperatorProductivityProps {
  initialData: OperatorProductivityRow[];
}

export function OperatorProductivity({ initialData }: OperatorProductivityProps) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<OperatorProductivityRow[]>(initialData);
  const [selectedOperator, setSelectedOperator] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [trendData, setTrendData] = useState<OperatorTrendPoint[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getOperatorProductivity(days);
      setData(result);
    });
  }, [days]);

  useEffect(() => {
    if (!selectedOperator) return;
    startTransition(async () => {
      const result = await getOperatorTrend(selectedOperator.id, days);
      setTrendData(result);
    });
  }, [selectedOperator, days]);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Operator Performance</h3>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Operator</th>
                <th className="px-4 py-3 text-right font-semibold">Units</th>
                <th className="px-4 py-3 text-right font-semibold">Avg Cycle (min)</th>
                <th className="px-4 py-3 text-center font-semibold">FPY</th>
                <th className="px-4 py-3 text-right font-semibold">Hours Worked</th>
                <th className="px-4 py-3 text-left font-semibold">Top Station</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No operator activity in the selected period
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const isSelected = selectedOperator?.id === row.operatorId;
                  return (
                    <tr
                      key={row.operatorId}
                      onClick={() =>
                        setSelectedOperator(
                          isSelected ? null : { id: row.operatorId, name: row.operatorName }
                        )
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{row.operatorName}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {row.unitsProcessed}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {row.avgCycleTime}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${fpyColor(row.fpy)}`}
                        >
                          {row.fpy}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {row.totalHoursWorked}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.mostActiveStation ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend Chart */}
      {selectedOperator && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <OperatorTrendChart data={trendData} operatorName={selectedOperator.name} />
        </div>
      )}
    </div>
  );
}
