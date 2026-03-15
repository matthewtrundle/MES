'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { searchUnitBySerial, getUnitWithHistory } from '@/lib/actions/units';
import { searchMaterialLot } from '@/lib/actions/materials';
import dynamic from 'next/dynamic';

const TraceabilityGraph = dynamic(
  () => import('./TraceabilityGraph').then(mod => mod.TraceabilityGraph),
  { loading: () => <div className="h-64 animate-pulse rounded bg-slate-100" /> }
);

type SearchResult = {
  type: 'unit' | 'lot';
  data: unknown;
} | null;

// Type for the graph component
type UnitDataForGraph = {
  id: string;
  serialNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  workOrder: {
    orderNumber: string;
    productCode: string;
  };
  executions: Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    result: string | null;
    operation: { sequence: number };
    station: { name: string };
    operator: { name: string };
  }>;
  qualityResults: Array<{
    id: string;
    timestamp: string;
    result: string;
    definition: { name: string; checkType: string };
    operator: { name: string };
  }>;
  materialConsumptions: Array<{
    id: string;
    timestamp: string;
    qtyConsumed: number;
    materialLot: { lotNumber: string; materialCode: string };
    station: { name: string };
    operator: { name: string };
  }>;
  ncrs: Array<{
    id: string;
    createdAt: string;
    defectType: string;
    status: string;
    disposition: string | null;
    station: { name: string };
  }>;
};

interface QuickLookupProps {
  recentUnits: Array<{ id: string; serialNumber: string; status: string; workOrder: { orderNumber: string } }>;
  activeLots: Array<{ id: string; lotNumber: string; materialCode: string; qtyRemaining: number }>;
  partsWithUnits: Array<{ id: string; productCode: string; productName: string | null; orderNumber: string }>;
}

export function TraceabilitySearch({ recentUnits, activeLots, partsWithUnits }: QuickLookupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'serial' | 'lot'>('serial');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [quickTab, setQuickTab] = useState<'units' | 'lots' | 'parts'>('units');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SearchResult>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        if (searchType === 'serial') {
          const unit = await searchUnitBySerial(searchQuery);
          if (unit) {
            const fullUnit = await getUnitWithHistory(unit.id);
            setResult({ type: 'unit', data: fullUnit });
          } else {
            setError('Serial number not found');
          }
        } else {
          const lot = await searchMaterialLot(searchQuery);
          if (lot) {
            setResult({ type: 'lot', data: lot });
          } else {
            setError('Lot number not found');
          }
        }
      } catch {
        setError('Search failed. Please try again.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex gap-2">
              <Button
                variant={searchType === 'serial' ? 'default' : 'outline'}
                onClick={() => setSearchType('serial')}
              >
                Serial Number
              </Button>
              <Button
                variant={searchType === 'lot' ? 'default' : 'outline'}
                onClick={() => setSearchType('lot')}
              >
                Lot Number
              </Button>
            </div>
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder={
                  searchType === 'serial'
                    ? 'Enter serial number...'
                    : 'Enter lot number...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isPending}>
                {isPending ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-red-600">
              {error}
            </div>
          )}

          {/* View Mode Toggle (only for unit results) */}
          {result?.type === 'unit' && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">View:</span>
              <div className="flex rounded-lg border border-slate-200 p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'graph'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Graph View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Lookup */}
      {!result && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700">Quick Lookup</span>
            <div className="flex gap-1">
              {(['units', 'lots', 'parts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setQuickTab(tab)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    quickTab === tab
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'units' ? 'Recent Units' : tab === 'lots' ? 'Active Lots' : 'By Work Order'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {quickTab === 'units' && (
              <div className="space-y-1">
                {recentUnits.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No units found</p>
                ) : recentUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => { setSearchQuery(unit.serialNumber); setSearchType('serial'); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <div>
                      <span className="font-mono font-medium text-slate-900">{unit.serialNumber}</span>
                      <span className="ml-2 text-sm text-slate-500">{unit.workOrder.orderNumber}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      unit.status === 'completed' ? 'bg-green-100 text-green-700' :
                      unit.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      unit.status === 'rework' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{unit.status.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
            {quickTab === 'lots' && (
              <div className="space-y-1">
                {activeLots.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No active lots</p>
                ) : activeLots.map((lot) => (
                  <button
                    key={lot.id}
                    onClick={() => { setSearchQuery(lot.lotNumber); setSearchType('lot'); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <div>
                      <span className="font-mono font-medium text-slate-900">{lot.lotNumber}</span>
                      <span className="ml-2 text-sm text-slate-500">{lot.materialCode}</span>
                    </div>
                    <span className="text-sm text-slate-500">{lot.qtyRemaining} remaining</span>
                  </button>
                ))}
              </div>
            )}
            {quickTab === 'parts' && (
              <div className="space-y-1">
                {partsWithUnits.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No active work orders</p>
                ) : partsWithUnits.map((wo) => (
                  <button
                    key={wo.id}
                    onClick={() => { setSearchQuery(wo.orderNumber); setSearchType('serial'); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <div>
                      <span className="font-medium text-slate-900">{wo.productName}</span>
                      <span className="ml-2 text-sm text-slate-500">{wo.productCode}</span>
                    </div>
                    <span className="text-sm font-mono text-slate-500">{wo.orderNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result?.type === 'unit' && viewMode === 'graph' && (
        <TraceabilityGraph data={result.data as UnitDataForGraph} />
      )}
      {result?.type === 'unit' && viewMode === 'list' && <UnitResult data={result.data} />}
      {result?.type === 'lot' && <LotResult data={result.data} />}
    </div>
  );
}

function UnitResult({ data }: { data: unknown }) {
  const unit = data as {
    id: string;
    serialNumber: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    workOrder: {
      orderNumber: string;
      productCode: string;
    };
    executions: Array<{
      id: string;
      startedAt: string;
      completedAt: string | null;
      result: string | null;
      operation: { sequence: number };
      station: { name: string };
      operator: { name: string };
    }>;
    qualityResults: Array<{
      id: string;
      timestamp: string;
      result: string;
      definition: { name: string; checkType: string };
      operator: { name: string };
    }>;
    materialConsumptions: Array<{
      id: string;
      timestamp: string;
      qtyConsumed: number;
      materialLot: { lotNumber: string; materialCode: string };
      station: { name: string };
      operator: { name: string };
    }>;
    ncrs: Array<{
      id: string;
      createdAt: string;
      defectType: string;
      status: string;
      disposition: string | null;
      station: { name: string };
    }>;
  };

  return (
    <div className="space-y-6">
      {/* Unit Header */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center justify-between">
            <span>{unit.serialNumber}</span>
            <span
              className={`rounded px-3 py-1 text-sm ${
                unit.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : unit.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : unit.status === 'rework'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-700'
              }`}
            >
              {unit.status.replace('_', ' ')}
            </span>
          </h3>
        </div>
        <div className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Work Order</p>
              <p className="font-medium">{unit.workOrder.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Product</p>
              <p className="font-medium">{unit.workOrder.productCode}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="font-medium">
                {new Date(unit.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Timeline */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Operations History</h3>
        </div>
        <div className="p-4">
          {unit.executions.length === 0 ? (
            <p className="text-slate-500">No operations recorded</p>
          ) : (
            <div className="space-y-3">
              {unit.executions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">
                      Step {exec.operation.sequence} - {exec.station.name}
                    </span>
                    <p className="text-sm text-slate-500">
                      {exec.operator.name} • Started{' '}
                      {new Date(exec.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-sm ${
                      exec.result === 'pass'
                        ? 'bg-green-100 text-green-700'
                        : exec.result === 'fail'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {exec.result ?? 'In Progress'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Material Genealogy */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Material Genealogy</h3>
        </div>
        <div className="p-4">
          {unit.materialConsumptions.length === 0 ? (
            <p className="text-slate-500">No materials recorded</p>
          ) : (
            <div className="space-y-3">
              {unit.materialConsumptions.map((mat) => (
                <div
                  key={mat.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">{mat.materialLot.lotNumber}</span>
                    <p className="text-sm text-slate-500">
                      {mat.materialLot.materialCode} • {mat.station.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">Qty: {mat.qtyConsumed}</span>
                    <p className="text-xs text-slate-500">
                      {mat.operator.name} •{' '}
                      {new Date(mat.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quality Checks */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Quality Checks</h3>
        </div>
        <div className="p-4">
          {unit.qualityResults.length === 0 ? (
            <p className="text-slate-500">No quality checks recorded</p>
          ) : (
            <div className="space-y-3">
              {unit.qualityResults.map((qc) => (
                <div
                  key={qc.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">{qc.definition.name}</span>
                    <p className="text-sm text-slate-500">
                      {qc.definition.checkType} • {qc.operator.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        qc.result === 'pass'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {qc.result.toUpperCase()}
                    </span>
                    <p className="text-xs text-slate-500">
                      {new Date(qc.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NCRs */}
      {unit.ncrs.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-red-700">
              Non-Conformances ({unit.ncrs.length})
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {unit.ncrs.map((ncr) => (
                <div
                  key={ncr.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">{ncr.defectType}</span>
                    <p className="text-sm text-slate-500">
                      {ncr.station.name} •{' '}
                      {new Date(ncr.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        ncr.status === 'closed'
                          ? 'bg-slate-100 text-slate-700'
                          : ncr.status === 'dispositioned'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {ncr.status}
                    </span>
                    {ncr.disposition && (
                      <p className="text-xs text-slate-500">
                        Disposition: {ncr.disposition}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LotResult({ data }: { data: unknown }) {
  const lot = data as {
    id: string;
    lotNumber: string;
    materialCode: string;
    description: string | null;
    qtyReceived: number;
    qtyRemaining: number;
    receivedAt: string;
    consumptions: Array<{
      id: string;
      timestamp: string;
      qtyConsumed: number;
      unit: { serialNumber: string };
      station: { name: string };
      operator: { name: string };
    }>;
  };

  return (
    <div className="space-y-6">
      {/* Lot Header */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center justify-between">
            <span>{lot.lotNumber}</span>
            <span
              className={`rounded px-3 py-1 text-sm ${
                lot.qtyRemaining > 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {lot.qtyRemaining > 0 ? 'Available' : 'Depleted'}
            </span>
          </h3>
        </div>
        <div className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Material Code</p>
              <p className="font-medium">{lot.materialCode}</p>
              {lot.description && (
                <p className="text-sm text-slate-500">{lot.description}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500">Quantity</p>
              <p className="font-medium">
                {lot.qtyRemaining} / {lot.qtyReceived}
              </p>
              <p className="text-sm text-slate-500">remaining / received</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Received</p>
              <p className="font-medium">
                {new Date(lot.receivedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consumption History */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Units Using This Lot ({lot.consumptions.length})</h3>
        </div>
        <div className="p-4">
          {lot.consumptions.length === 0 ? (
            <p className="text-slate-500">No consumptions recorded</p>
          ) : (
            <div className="space-y-3">
              {lot.consumptions.map((cons) => (
                <div
                  key={cons.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span className="font-medium">{cons.unit.serialNumber}</span>
                    <p className="text-sm text-slate-500">
                      {cons.station.name} • {cons.operator.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">Qty: {cons.qtyConsumed}</span>
                    <p className="text-xs text-slate-500">
                      {new Date(cons.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
