'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getStockVsReorder,
  getInventoryTurns,
  getInventoryValuation,
  getExpiringInventory,
  type StockVsReorderRow,
  type InventoryTurnRow,
  type InventoryValuationResult,
  type ExpiringLot,
} from '@/lib/actions/inventory-reports';

type TabId = 'stock' | 'valuation' | 'turnover' | 'expiring';

interface InventoryReportsProps {
  initialStockData: StockVsReorderRow[];
}

const statusColors: Record<string, string> = {
  'OK': 'bg-green-100 text-green-800',
  'Low': 'bg-yellow-100 text-yellow-800',
  'Critical': 'bg-red-100 text-red-800',
  'Out of Stock': 'bg-gray-200 text-gray-800',
};

export function InventoryReports({ initialStockData }: InventoryReportsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('stock');
  const [isPending, startTransition] = useTransition();

  // Data state
  const [stockData, setStockData] = useState<StockVsReorderRow[]>(initialStockData);
  const [valuationData, setValuationData] = useState<InventoryValuationResult | null>(null);
  const [turnoverData, setTurnoverData] = useState<InventoryTurnRow[]>([]);
  const [expiringData, setExpiringData] = useState<ExpiringLot[]>([]);
  const [turnoverDays, setTurnoverDays] = useState(90);
  const [expiringDays, setExpiringDays] = useState(30);

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'stock' && stockData.length === 0) {
      startTransition(async () => {
        setStockData(await getStockVsReorder());
      });
    } else if (activeTab === 'valuation' && !valuationData) {
      startTransition(async () => {
        setValuationData(await getInventoryValuation());
      });
    } else if (activeTab === 'turnover') {
      startTransition(async () => {
        setTurnoverData(await getInventoryTurns(turnoverDays));
      });
    } else if (activeTab === 'expiring') {
      startTransition(async () => {
        setExpiringData(await getExpiringInventory(expiringDays));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, turnoverDays, expiringDays]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'stock', label: 'Stock Levels' },
    { id: 'valuation', label: 'Valuation' },
    { id: 'turnover', label: 'Turnover' },
    { id: 'expiring', label: 'Expiring' },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!isPending && activeTab === 'stock' && <StockLevelsTab data={stockData} />}
      {!isPending && activeTab === 'valuation' && valuationData && <ValuationTab data={valuationData} />}
      {!isPending && activeTab === 'turnover' && (
        <TurnoverTab data={turnoverData} days={turnoverDays} onDaysChange={setTurnoverDays} />
      )}
      {!isPending && activeTab === 'expiring' && (
        <ExpiringTab data={expiringData} days={expiringDays} onDaysChange={setExpiringDays} />
      )}
    </div>
  );
}

function StockLevelsTab({ data }: { data: StockVsReorderRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr className="text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 text-left font-semibold">Material</th>
              <th className="px-4 py-3 text-right font-semibold">Current Stock</th>
              <th className="px-4 py-3 text-right font-semibold">Reorder Point</th>
              <th className="px-4 py-3 text-right font-semibold">Target</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Lots</th>
              <th className="px-4 py-3 text-center font-semibold">Fill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No inventory data available
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const fillPct = row.targetStock
                  ? Math.min(100, (row.currentStock / row.targetStock) * 100)
                  : null;
                return (
                  <tr key={row.materialCode} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-gray-900">{row.materialCode}</p>
                      {row.description && (
                        <p className="text-xs text-gray-500">{row.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                      {row.currentStock} {row.unitOfMeasure}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-500">
                      {row.reorderPoint ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-500">
                      {row.targetStock ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                      {row.lotCount}
                    </td>
                    <td className="px-4 py-3">
                      {fillPct != null ? (
                        <div className="mx-auto w-20">
                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                fillPct >= 80 ? 'bg-green-400' : fillPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-center text-[10px] text-gray-400">
                            {Math.round(fillPct)}%
                          </p>
                        </div>
                      ) : (
                        <div className="text-center text-gray-300">—</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValuationTab({ data }: { data: InventoryValuationResult }) {
  const categoryColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];

  return (
    <div className="space-y-6">
      {/* Total valuation and categories */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Total Inventory Value</p>
          <p className="mt-2 text-3xl font-bold text-blue-900">
            ${data.totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-sm text-blue-600">{data.items.length} materials on hand</p>
        </div>
        {data.byCategory.slice(0, 3).map((cat, i) => (
          <div key={cat.category} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${categoryColors[i] ?? 'bg-gray-400'}`} />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {cat.category.replace('_', ' ')}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              ${cat.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm text-gray-500">{cat.count} items</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Material</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Qty On Hand</th>
                <th className="px-4 py-3 text-right font-semibold">Std Cost</th>
                <th className="px-4 py-3 text-right font-semibold">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((item) => (
                <tr key={item.materialCode} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm font-medium text-gray-900">{item.materialCode}</p>
                    <p className="text-xs text-gray-500">{item.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.category.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{item.qtyOnHand}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                    ${item.standardCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">
                    ${item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TurnoverTab({
  data,
  days,
  onDaysChange,
}: {
  data: InventoryTurnRow[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Inventory Turns (annualized from {days}-day data)
        </h3>
        <div className="flex items-center gap-2">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Material</th>
                <th className="px-4 py-3 text-right font-semibold">Consumed</th>
                <th className="px-4 py-3 text-right font-semibold">Avg On Hand</th>
                <th className="px-4 py-3 text-right font-semibold">Turns/Year</th>
                <th className="px-4 py-3 text-center font-semibold">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No turnover data available
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  let rating = 'Slow';
                  let ratingColor = 'bg-red-100 text-red-700';
                  if (row.turns >= 12) {
                    rating = 'Fast';
                    ratingColor = 'bg-green-100 text-green-700';
                  } else if (row.turns >= 4) {
                    rating = 'Normal';
                    ratingColor = 'bg-blue-100 text-blue-700';
                  } else if (row.turns >= 1) {
                    rating = 'Slow';
                    ratingColor = 'bg-yellow-100 text-yellow-700';
                  } else {
                    rating = 'Dead';
                    ratingColor = 'bg-red-100 text-red-700';
                  }

                  return (
                    <tr key={row.materialCode} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-medium text-gray-900">{row.materialCode}</p>
                        {row.description && <p className="text-xs text-gray-500">{row.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{row.totalConsumed}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{row.avgOnHand}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">{row.turns}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ratingColor}`}>
                          {rating}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpiringTab({
  data,
  days,
  onDaysChange,
}: {
  data: ExpiringLot[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Lots Expiring Within {days} Days
        </h3>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Lot Number</th>
                <th className="px-4 py-3 text-left font-semibold">Material</th>
                <th className="px-4 py-3 text-right font-semibold">Qty Remaining</th>
                <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                <th className="px-4 py-3 text-right font-semibold">Expires</th>
                <th className="px-4 py-3 text-center font-semibold">Days Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No lots expiring within {days} days
                  </td>
                </tr>
              ) : (
                data.map((lot) => {
                  const urgent = lot.daysUntilExpiry <= 7;
                  const expired = lot.daysUntilExpiry <= 0;
                  return (
                    <tr
                      key={lot.lotNumber}
                      className={`${expired ? 'bg-red-50' : urgent ? 'bg-amber-50' : ''} hover:bg-gray-50`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">
                        {lot.lotNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm text-gray-700">{lot.materialCode}</p>
                        {lot.description && <p className="text-xs text-gray-500">{lot.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                        {lot.qtyRemaining}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lot.supplier ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {new Date(lot.expiresAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            expired
                              ? 'bg-red-200 text-red-800'
                              : urgent
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {expired ? 'EXPIRED' : `${lot.daysUntilExpiry}d`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
