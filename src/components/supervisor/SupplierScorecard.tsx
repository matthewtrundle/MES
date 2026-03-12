'use client';

import { useState, useEffect, useCallback } from 'react';
import { SupplierTrendChart } from './SupplierTrendChart';
import {
  getSupplierScorecard,
  getSupplierTrend,
  getSupplierComparison,
  type SupplierScorecardEntry,
  type SupplierTrendPoint,
  type SupplierComparisonEntry,
} from '@/lib/actions/supplier-analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rateCell(rate: number, invert = false) {
  const green = invert ? rate < 5 : rate >= 95;
  const yellow = invert ? rate >= 5 && rate < 15 : rate >= 85 && rate < 95;
  const red = invert ? rate >= 15 : rate < 85;

  const bg = green
    ? 'bg-green-50 text-green-800'
    : yellow
      ? 'bg-yellow-50 text-yellow-800'
      : 'bg-red-50 text-red-800';

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${bg}`}>
      {rate}%
    </span>
  );
}

function qualStatusBadge(status: string) {
  const colors: Record<string, string> = {
    qualified: 'bg-green-100 text-green-800 border-green-200',
    conditional: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pending: 'bg-gray-100 text-gray-700 border-gray-200',
    disqualified: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type ViewMode = 'scorecard' | 'comparison';

export function SupplierScorecard() {
  const [loading, setLoading] = useState(true);
  const [scorecards, setScorecards] = useState<SupplierScorecardEntry[]>([]);
  const [comparison, setComparison] = useState<SupplierComparisonEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('scorecard');

  // Trend state
  const [selectedSupplier, setSelectedSupplier] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [trendData, setTrendData] = useState<SupplierTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sc, comp] = await Promise.all([
        getSupplierScorecard(),
        getSupplierComparison(),
      ]);
      setScorecards(sc);
      setComparison(comp);
    } catch (err) {
      console.error('Failed to load supplier data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTrend = async (supplierDbId: string, name: string) => {
    setSelectedSupplier({ id: supplierDbId, name });
    setTrendLoading(true);
    try {
      const data = await getSupplierTrend(supplierDbId);
      setTrendData(data);
    } catch (err) {
      console.error('Failed to load supplier trend:', err);
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setViewMode('scorecard')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'scorecard'
                ? 'bg-slate-800 text-white shadow'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Scorecard
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'comparison'
                ? 'bg-slate-800 text-white shadow'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Comparison
          </button>
        </div>
      </div>

      {/* Scorecard View */}
      {viewMode === 'scorecard' && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Accept Rate
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    NCR Rate
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    On-Time
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Lots Rcvd
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    NCRs
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    POs
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {scorecards.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      No suppliers found. Add suppliers in the Admin panel.
                    </td>
                  </tr>
                ) : (
                  scorecards.map((sc) => (
                    <tr
                      key={sc.supplierDbId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{sc.name}</p>
                          <p className="text-xs text-gray-400">{sc.supplierId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {qualStatusBadge(sc.qualificationStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rateCell(sc.acceptanceRate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rateCell(sc.ncrRate, true)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rateCell(sc.onTimeDeliveryRate)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-700">
                        {sc.totalLotsReceived}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono font-semibold ${
                            sc.ncrCount > 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          {sc.ncrCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-700">
                        {sc.totalPOs}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => loadTrend(sc.supplierDbId, sc.name)}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Supplier Comparison
          </h3>
          {comparison.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No supplier data available</p>
          ) : (
            <div className="space-y-6">
              {/* Acceptance Rate comparison */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-gray-400 uppercase">
                  Acceptance Rate
                </h4>
                <div className="space-y-2">
                  {comparison
                    .sort((a, b) => b.acceptanceRate - a.acceptanceRate)
                    .map((s) => {
                      const color =
                        s.acceptanceRate >= 95
                          ? 'bg-green-500'
                          : s.acceptanceRate >= 85
                            ? 'bg-yellow-500'
                            : 'bg-red-500';
                      return (
                        <div key={s.supplierDbId} className="flex items-center gap-3">
                          <span className="w-32 truncate text-sm text-gray-700">
                            {s.name}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className={`h-full ${color} rounded transition-all`}
                              style={{ width: `${s.acceptanceRate}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-sm font-semibold text-gray-900">
                            {s.acceptanceRate}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* NCR Count comparison */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-gray-400 uppercase">
                  NCR Count
                </h4>
                <div className="space-y-2">
                  {comparison
                    .sort((a, b) => b.ncrCount - a.ncrCount)
                    .map((s) => {
                      const maxNCR = Math.max(...comparison.map((c) => c.ncrCount), 1);
                      const pct = (s.ncrCount / maxNCR) * 100;
                      return (
                        <div key={s.supplierDbId} className="flex items-center gap-3">
                          <span className="w-32 truncate text-sm text-gray-700">
                            {s.name}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-sm font-semibold text-gray-900">
                            {s.ncrCount}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Lead Time comparison */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-gray-400 uppercase">
                  Avg Lead Time (days)
                </h4>
                <div className="space-y-2">
                  {comparison
                    .filter((s) => s.avgLeadTimeDays !== null)
                    .sort((a, b) => (a.avgLeadTimeDays ?? 0) - (b.avgLeadTimeDays ?? 0))
                    .map((s) => {
                      const maxLT = Math.max(
                        ...comparison.map((c) => c.avgLeadTimeDays ?? 0),
                        1
                      );
                      const pct = ((s.avgLeadTimeDays ?? 0) / maxLT) * 100;
                      return (
                        <div key={s.supplierDbId} className="flex items-center gap-3">
                          <span className="w-32 truncate text-sm text-gray-700">
                            {s.name}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-sm font-semibold text-gray-900">
                            {s.avgLeadTimeDays}d
                          </span>
                        </div>
                      );
                    })}
                  {comparison.every((s) => s.avgLeadTimeDays === null) && (
                    <p className="text-sm text-gray-400">No lead time data available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trend Panel */}
      {selectedSupplier && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Acceptance Rate Trend: {selectedSupplier.name}
            </h3>
            <button
              onClick={() => setSelectedSupplier(null)}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
          {trendLoading ? (
            <div className="h-48 animate-pulse rounded bg-gray-100" />
          ) : (
            <SupplierTrendChart data={trendData} />
          )}
        </div>
      )}
    </div>
  );
}
