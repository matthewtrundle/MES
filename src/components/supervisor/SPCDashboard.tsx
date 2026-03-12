'use client';

import { useState, useEffect, useCallback } from 'react';
import { ControlChart } from './ControlChart';
import {
  getSPCData,
  getControlChartData,
  detectDrift,
  type SPCDataPoint,
  type ControlChartData,
  type DriftAlert,
} from '@/lib/actions/spc-analytics';

function CpkBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
        N/A
      </span>
    );
  }

  const color =
    value >= 1.33
      ? 'bg-green-100 text-green-700 border-green-200'
      : value >= 1.0
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : 'bg-red-100 text-red-700 border-red-200';

  const label =
    value >= 1.33 ? 'Capable' : value >= 1.0 ? 'Marginal' : 'Not Capable';

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${color}`}>
      {value.toFixed(2)}
      <span className="text-[10px] opacity-70">({label})</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severity === 'critical'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold uppercase ${color}`}>
      {severity}
    </span>
  );
}

export function SPCDashboard() {
  const [spcData, setSpcData] = useState<SPCDataPoint[]>([]);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'quality_check' | 'ctq'>('ctq');
  const [chartData, setChartData] = useState<ControlChartData | null>(null);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [days, setDays] = useState(30);

  // Load SPC summary data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSPCData({ days })
      .then((data) => {
        if (!cancelled) {
          setSpcData(data);
          setLoading(false);
          // Auto-select first definition if none selected
          if (data.length > 0 && !selectedDef) {
            setSelectedDef(data[0].definitionId);
            setSelectedSource(data[0].sourceType);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load control chart data when selection changes
  const loadChartData = useCallback(async () => {
    if (!selectedDef) return;
    setChartLoading(true);
    try {
      const [chart, drift] = await Promise.all([
        getControlChartData(selectedDef, selectedSource, days),
        detectDrift(selectedDef, selectedSource),
      ]);
      setChartData(chart);
      setDriftAlerts(drift);
    } catch {
      setChartData(null);
      setDriftAlerts([]);
    }
    setChartLoading(false);
  }, [selectedDef, selectedSource, days]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  const handleSelectDefinition = (defId: string, source: 'quality_check' | 'ctq') => {
    setSelectedDef(defId);
    setSelectedSource(source);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-48 rounded bg-gray-200" />
        <div className="h-64 rounded bg-gray-200" />
        <div className="h-32 rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quality Check / CTQ</label>
          <select
            value={selectedDef ? `${selectedSource}:${selectedDef}` : ''}
            onChange={(e) => {
              const [src, id] = e.target.value.split(':');
              handleSelectDefinition(id, src as 'quality_check' | 'ctq');
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {spcData.length === 0 && (
              <option value="">No data available</option>
            )}
            {spcData.map((d) => (
              <option key={`${d.sourceType}:${d.definitionId}`} value={`${d.sourceType}:${d.definitionId}`}>
                {d.checkName} ({d.count} samples)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Time Range</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Capability Indices Summary */}
      {spcData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="font-semibold text-gray-900">Process Capability Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/50">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 text-left font-semibold">Check Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Source</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Samples</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Mean</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Sigma</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Cp</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Cpk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spcData.map((d) => (
                  <tr
                    key={`${d.sourceType}:${d.definitionId}`}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedDef === d.definitionId && selectedSource === d.sourceType
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : ''
                    }`}
                    onClick={() => handleSelectDefinition(d.definitionId, d.sourceType)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.checkName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                        d.sourceType === 'ctq' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {d.sourceType === 'ctq' ? 'CTQ' : 'QC'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{d.count}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">{d.mean.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">{d.sigma.toFixed(4)}</td>
                    <td className="px-4 py-3 text-center"><CpkBadge value={d.cp} /></td>
                    <td className="px-4 py-3 text-center"><CpkBadge value={d.cpk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Control Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              Control Chart
              {chartData ? ` - ${chartData.checkName}` : ''}
            </h3>
            {chartData && (
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                <span>Mean: <strong className="text-gray-700">{chartData.mean.toFixed(3)}</strong></span>
                <span>Sigma: <strong className="text-gray-700">{chartData.sigma.toFixed(4)}</strong></span>
                {chartData.cp !== null && (
                  <span>Cp: <CpkBadge value={chartData.cp} /></span>
                )}
                {chartData.cpk !== null && (
                  <span>Cpk: <CpkBadge value={chartData.cpk} /></span>
                )}
              </div>
            )}
          </div>
        </div>

        {chartLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            Loading chart data...
          </div>
        ) : chartData ? (
          <ControlChart
            points={chartData.points}
            ucl={chartData.ucl}
            cl={chartData.mean}
            lcl={chartData.lcl}
            usl={chartData.usl}
            lsl={chartData.lsl}
            height={320}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Select a quality check or CTQ definition to view the control chart
          </div>
        )}
      </div>

      {/* Drift Alerts */}
      {driftAlerts.length > 0 && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-semibold text-amber-800">
              Process Drift Detected ({driftAlerts.length} alert{driftAlerts.length > 1 ? 's' : ''})
            </h3>
          </div>
          <div className="space-y-2">
            {driftAlerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-white border border-amber-200 p-3"
              >
                <SeverityBadge severity={alert.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Rule {alert.rule}: {alert.ruleDescription}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Measurements Table */}
      {chartData && chartData.points.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="font-semibold text-gray-900">
              Recent Measurements ({chartData.points.length} total)
            </h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-gray-200 bg-gray-50/95">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left font-semibold">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Label</th>
                  <th className="px-4 py-2 text-right font-semibold">Value</th>
                  <th className="px-4 py-2 text-right font-semibold">Deviation</th>
                  <th className="px-4 py-2 text-center font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...chartData.points].reverse().slice(0, 50).map((p) => {
                  const deviation = p.value - chartData.mean;
                  const sigmaDeviation = chartData.sigma > 0 ? Math.abs(deviation) / chartData.sigma : 0;
                  const outOfControl = p.value > chartData.ucl || p.value < chartData.lcl;
                  const outOfSpec = (chartData.usl != null && p.value > chartData.usl) ||
                    (chartData.lsl != null && p.value < chartData.lsl);

                  return (
                    <tr key={p.index} className={outOfSpec ? 'bg-red-50' : outOfControl ? 'bg-amber-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-500">{p.index + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-sm text-gray-700">{p.value.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right font-mono text-sm text-gray-500">
                        {deviation >= 0 ? '+' : ''}{deviation.toFixed(4)}
                        <span className="ml-1 text-xs text-gray-400">({sigmaDeviation.toFixed(1)} sigma)</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {outOfSpec ? (
                          <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            OUT OF SPEC
                          </span>
                        ) : outOfControl ? (
                          <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            OOC
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">
                        {p.timestamp ? new Date(p.timestamp).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {spcData.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            No measurement data available for SPC analysis.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            CTQ measurements or quality check measurements are needed.
          </p>
        </div>
      )}
    </div>
  );
}
