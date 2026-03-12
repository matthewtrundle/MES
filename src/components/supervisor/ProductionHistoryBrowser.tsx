'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  searchProductionHistory,
  getProductionSummary,
  type ProductionHistoryFilters,
  type ProductionHistoryResult,
  type ProductionHistoryUnit,
  type ProductionSummary,
} from '@/lib/actions/production-history';

interface StationOption {
  id: string;
  name: string;
}

interface ProductionHistoryBrowserProps {
  initialData: ProductionHistoryResult;
  initialSummary: ProductionSummary;
  stations: StationOption[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    created: 'bg-gray-100 text-gray-800',
    scrapped: 'bg-red-100 text-red-800',
    rework: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ResultBadge({ result, isRework }: { result: string | null; isRework: boolean }) {
  if (!result) return <span className="text-gray-400 text-xs">pending</span>;
  const base = result === 'pass' ? 'text-green-700' : result === 'fail' ? 'text-red-700' : 'text-amber-700';
  return (
    <span className={`text-xs font-medium ${base}`}>
      {result}{isRework ? ' (rework)' : ''}
    </span>
  );
}

export function ProductionHistoryBrowser({
  initialData,
  initialSummary,
  stations,
}: ProductionHistoryBrowserProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<ProductionHistoryResult>(initialData);
  const [summary, setSummary] = useState<ProductionSummary>(initialSummary);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productCode, setProductCode] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [stationId, setStationId] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'serial' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  function doSearch(newPage?: number) {
    const filters: ProductionHistoryFilters = {
      page: newPage ?? page,
      pageSize: 20,
      sortBy,
      sortDir,
    };
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (productCode) filters.productCode = productCode;
    if (workOrderId) filters.workOrderId = workOrderId;
    if (serialNumber) filters.serialNumber = serialNumber;
    if (stationId) filters.stationId = stationId;
    if (status) filters.status = status;

    startTransition(async () => {
      const result = await searchProductionHistory(filters);
      setData(result);
      if (newPage) setPage(newPage);

      // Update summary for date range if specified
      const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = dateTo ? new Date(dateTo) : new Date();
      const summaryResult = await getProductionSummary(from, to);
      setSummary(summaryResult);
    });
  }

  function handleSort(col: 'date' | 'serial' | 'status') {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }

  useEffect(() => {
    doSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  function SortIndicator({ col }: { col: 'date' | 'serial' | 'status' }) {
    if (sortBy !== col) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Units</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalUnits}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">FPY</p>
          <p className={`mt-1 text-2xl font-bold ${summary.fpy >= 95 ? 'text-green-600' : summary.fpy >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
            {summary.fpy}%
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg Cycle</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{summary.avgCycleTime}m</p>
        </div>
        {summary.byStatus.slice(0, 2).map((s) => (
          <div key={s.status} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.status.replace('_', ' ')}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Product</label>
            <input
              type="text"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="e.g. BLDC"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Work Order</label>
            <input
              type="text"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              placeholder="e.g. WO-"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Serial</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. BLDC-"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Station</label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="created">Created</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="scrapped">Scrapped</option>
              <option value="rework">Rework</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => doSearch(1)}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="w-8 px-2 py-3" />
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold hover:text-gray-700"
                  onClick={() => handleSort('serial')}
                >
                  Serial<SortIndicator col="serial" />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Work Order</th>
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th
                  className="cursor-pointer px-4 py-3 text-center font-semibold hover:text-gray-700"
                  onClick={() => handleSort('status')}
                >
                  Status<SortIndicator col="status" />
                </th>
                <th className="px-4 py-3 text-right font-semibold">Ops</th>
                <th
                  className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-gray-700"
                  onClick={() => handleSort('date')}
                >
                  Created<SortIndicator col="date" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No units match the search criteria
                  </td>
                </tr>
              ) : (
                data.data.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    expanded={expandedUnit === unit.id}
                    onToggle={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-600">
              Showing {(data.pagination.page - 1) * data.pagination.pageSize + 1}
              {' - '}
              {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)}
              {' of '}
              {data.pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => doSearch(page - 1)}
                disabled={page <= 1 || isPending}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => doSearch(page + 1)}
                disabled={page >= data.pagination.totalPages || isPending}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UnitRow({
  unit,
  expanded,
  onToggle,
}: {
  unit: ProductionHistoryUnit;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(unit.createdAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      >
        <td className="px-2 py-3 text-center text-gray-400">
          <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>
            &#9654;
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm font-medium text-blue-600">{unit.serialNumber}</span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{unit.workOrder.orderNumber}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{unit.workOrder.productCode}</td>
        <td className="px-4 py-3 text-center">
          <StatusBadge status={unit.status} />
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
          {unit.operations.length}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-600">{dateStr}</td>
      </tr>
      {expanded && unit.operations.length > 0 && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-8 py-3">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-1 text-left font-medium">Station</th>
                  <th className="pb-1 text-center font-medium">Result</th>
                  <th className="pb-1 text-right font-medium">Cycle (min)</th>
                  <th className="pb-1 text-left font-medium">Operator</th>
                  <th className="pb-1 text-right font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unit.operations.map((op, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-1.5 text-gray-700">{op.stationName}</td>
                    <td className="py-1.5 text-center">
                      <ResultBadge result={op.result} isRework={op.isRework} />
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-600">
                      {op.cycleTimeMinutes?.toFixed(1) ?? '—'}
                    </td>
                    <td className="py-1.5 text-gray-600">{op.operatorName}</td>
                    <td className="py-1.5 text-right text-gray-500">
                      {op.completedAt
                        ? new Date(op.completedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'in progress'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
