'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgingChart } from './AgingChart';
import {
  getNCRAgingSummary,
  getNCRBySeverity,
  getNCRTrend,
  getNCRByDefectType,
  getNCRByStation,
  getNCRBySource,
  getNCRDispositionBreakdown,
  getNCRResponseTime,
  type NCRAgingSummary,
  type NCRSeverityCount,
  type NCRTrendPoint,
  type NCRDefectTypeEntry,
  type NCRStationEntry,
  type NCRSourceBreakdown,
  type NCRDispositionEntry,
  type NCRResponseTimeEntry,
} from '@/lib/actions/ncr-analytics';

// ---------------------------------------------------------------------------
// SVG Sub-components
// ---------------------------------------------------------------------------

function SeverityDonut({ data }: { data: NCRSeverityCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 py-8">
        No open NCRs
      </div>
    );
  }

  const colors: Record<string, string> = {
    critical: '#dc2626',
    major: '#f97316',
    minor: '#eab308',
  };

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 60;
  const innerRadius = 38;

  let cumAngle = -Math.PI / 2;
  const arcs = data.map((d) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    return { ...d, path };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc) => (
          <path
            key={arc.severity}
            d={arc.path}
            fill={colors[arc.severity] ?? '#94a3b8'}
            stroke="white"
            strokeWidth={2}
          >
            <title>
              {arc.severity}: {arc.count}
            </title>
          </path>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#1e293b"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
        >
          Open
        </text>
      </svg>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.severity} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: colors[d.severity] ?? '#94a3b8' }}
            />
            <span className="text-sm capitalize text-gray-700">{d.severity}</span>
            <span className="ml-auto text-sm font-semibold text-gray-900">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: NCRTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 py-8">
        No trend data available
      </div>
    );
  }

  const width = 500;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 35, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxCreated = Math.max(...data.map((d) => d.created), 1);
  const maxClosed = Math.max(...data.map((d) => d.closed), 1);
  const maxDaily = Math.max(maxCreated, maxClosed);
  const maxCum = Math.max(...data.map((d) => d.openCumulative), 1);

  const xScale = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * cw;

  // Left y-axis: daily counts
  const yScaleDaily = (v: number) => pad.top + ch - (v / maxDaily) * ch;
  // Right y-axis: cumulative
  const yScaleCum = (v: number) => pad.top + ch - (v / maxCum) * ch;

  // Build paths
  const buildPath = (values: number[], scale: (v: number) => number) =>
    values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${scale(v)}`)
      .join(' ');

  const cumPath = buildPath(
    data.map((d) => d.openCumulative),
    yScaleCum
  );

  // Show every nth label
  const labelInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={pad.left}
          y1={pad.top + ch * (1 - pct)}
          x2={width - pad.right}
          y2={pad.top + ch * (1 - pct)}
          stroke="#f1f5f9"
        />
      ))}

      {/* Cumulative line */}
      <path d={cumPath} fill="none" stroke="#6366f1" strokeWidth={2} opacity={0.7} />

      {/* Created bars (thin) */}
      {data.map((d, i) => {
        const barW = Math.max(2, cw / data.length - 1);
        return (
          <g key={`created-${i}`}>
            {d.created > 0 && (
              <rect
                x={xScale(i) - barW / 2 - 1}
                y={yScaleDaily(d.created)}
                width={barW / 2}
                height={ch - (yScaleDaily(d.created) - pad.top)}
                fill="#ef4444"
                rx={1}
                opacity={0.7}
              >
                <title>{d.date}: {d.created} created</title>
              </rect>
            )}
            {d.closed > 0 && (
              <rect
                x={xScale(i) + 1}
                y={yScaleDaily(d.closed)}
                width={barW / 2}
                height={ch - (yScaleDaily(d.closed) - pad.top)}
                fill="#22c55e"
                rx={1}
                opacity={0.7}
              >
                <title>{d.date}: {d.closed} closed</title>
              </rect>
            )}
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => {
        if (i % labelInterval !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={xScale(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
          >
            {d.date.slice(5)}
          </text>
        );
      })}

      {/* Y-axis label */}
      <text x={pad.left - 8} y={pad.top} textAnchor="end" fontSize="9" fill="#94a3b8">
        {maxDaily}
      </text>
      <text x={pad.left - 8} y={pad.top + ch} textAnchor="end" fontSize="9" fill="#94a3b8">
        0
      </text>

      {/* Legend */}
      <rect x={pad.left + 10} y={4} width={8} height={8} fill="#ef4444" rx={1} opacity={0.7} />
      <text x={pad.left + 22} y={12} fontSize="9" fill="#64748b">Created</text>
      <rect x={pad.left + 70} y={4} width={8} height={8} fill="#22c55e" rx={1} opacity={0.7} />
      <text x={pad.left + 82} y={12} fontSize="9" fill="#64748b">Closed</text>
      <line x1={pad.left + 130} y1={8} x2={pad.left + 145} y2={8} stroke="#6366f1" strokeWidth={2} opacity={0.7} />
      <text x={pad.left + 150} y={12} fontSize="9" fill="#64748b">Open (cumul.)</text>
    </svg>
  );
}

function ParetoChart({ data }: { data: NCRDefectTypeEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 py-8">
        No defect data available
      </div>
    );
  }

  const width = 500;
  const height = 200;
  const pad = { top: 10, right: 20, bottom: 60, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barWidth = Math.min(40, (cw / data.length) * 0.7);
  const barGap = (cw - barWidth * data.length) / (data.length + 1);

  // Cumulative percentage for Pareto line
  const total = data.reduce((s, d) => s + d.count, 0);
  let cumPct = 0;
  const cumPoints = data.map((d) => {
    cumPct += d.count / total;
    return cumPct;
  });

  const xBar = (i: number) => pad.left + barGap + i * (barWidth + barGap) + barWidth / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Bars */}
      {data.map((d, i) => {
        const x = xBar(i) - barWidth / 2;
        const barH = (d.count / maxCount) * ch;
        const y = pad.top + ch - barH;

        return (
          <g key={d.defectType}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill="#3b82f6"
              rx={2}
              opacity={0.8}
            >
              <title>{d.defectType}: {d.count} ({d.percentage}%)</title>
            </rect>
            {/* Count on top */}
            <text
              x={xBar(i)}
              y={y - 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#1e293b"
            >
              {d.count}
            </text>
            {/* Label */}
            <text
              x={xBar(i)}
              y={pad.top + ch + 10}
              textAnchor="end"
              transform={`rotate(-35, ${xBar(i)}, ${pad.top + ch + 10})`}
              fontSize="9"
              fill="#64748b"
            >
              {d.defectType.length > 15 ? d.defectType.slice(0, 14) + '...' : d.defectType}
            </text>
          </g>
        );
      })}

      {/* Pareto line */}
      <path
        d={cumPoints
          .map(
            (pct, i) =>
              `${i === 0 ? 'M' : 'L'} ${xBar(i)} ${pad.top + ch - pct * ch}`
          )
          .join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Pareto dots */}
      {cumPoints.map((pct, i) => (
        <circle
          key={i}
          cx={xBar(i)}
          cy={pad.top + ch - pct * ch}
          r={3}
          fill="white"
          stroke="#f97316"
          strokeWidth={1.5}
        >
          <title>{Math.round(pct * 100)}% cumulative</title>
        </circle>
      ))}

      {/* Right axis for % */}
      <text
        x={width - pad.right + 4}
        y={pad.top}
        fontSize="9"
        fill="#f97316"
      >
        100%
      </text>
      <text
        x={width - pad.right + 4}
        y={pad.top + ch}
        fontSize="9"
        fill="#f97316"
      >
        0%
      </text>

      {/* Axes */}
      <line
        x1={pad.left}
        y1={pad.top + ch}
        x2={width - pad.right}
        y2={pad.top + ch}
        stroke="#cbd5e1"
      />
    </svg>
  );
}

function ResponseTimeTable({ data }: { data: NCRResponseTimeEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 py-8">
        No disposition data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 text-left font-medium text-gray-500">Severity</th>
            <th className="py-2 text-right font-medium text-gray-500">Avg Response</th>
            <th className="py-2 text-right font-medium text-gray-500">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const hours = d.avgHours;
            const display =
              hours < 1
                ? `${Math.round(hours * 60)}m`
                : hours < 24
                  ? `${Math.round(hours * 10) / 10}h`
                  : `${Math.round(hours / 24 * 10) / 10}d`;

            const severityColor =
              d.severity === 'critical'
                ? 'text-red-700 bg-red-50'
                : d.severity === 'major'
                  ? 'text-orange-700 bg-orange-50'
                  : 'text-yellow-700 bg-yellow-50';

            return (
              <tr key={d.severity} className="border-b border-gray-100">
                <td className="py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize ${severityColor}`}
                  >
                    {d.severity}
                  </span>
                </td>
                <td className="py-2 text-right font-mono font-semibold text-gray-900">
                  {display}
                </td>
                <td className="py-2 text-right text-gray-600">{d.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

type TimeRange = 7 | 30 | 90;

export function NCRAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [loading, setLoading] = useState(true);

  const [agingSummary, setAgingSummary] = useState<NCRAgingSummary | null>(null);
  const [severity, setSeverity] = useState<NCRSeverityCount[]>([]);
  const [trend, setTrend] = useState<NCRTrendPoint[]>([]);
  const [defectTypes, setDefectTypes] = useState<NCRDefectTypeEntry[]>([]);
  const [stations, setStations] = useState<NCRStationEntry[]>([]);
  const [source, setSource] = useState<NCRSourceBreakdown[]>([]);
  const [dispositions, setDispositions] = useState<NCRDispositionEntry[]>([]);
  const [responseTime, setResponseTime] = useState<NCRResponseTimeEntry[]>([]);

  const loadData = useCallback(async (range: TimeRange) => {
    setLoading(true);
    try {
      const [agingRes, sevRes, trendRes, defectRes, stationRes, sourceRes, dispRes, rtRes] =
        await Promise.all([
          getNCRAgingSummary(),
          getNCRBySeverity(),
          getNCRTrend(range),
          getNCRByDefectType(range),
          getNCRByStation(range),
          getNCRBySource(range),
          getNCRDispositionBreakdown(range),
          getNCRResponseTime(),
        ]);

      setAgingSummary(agingRes);
      setSeverity(sevRes);
      setTrend(trendRes);
      setDefectTypes(defectRes);
      setStations(stationRes);
      setSource(sourceRes);
      setDispositions(dispRes);
      setResponseTime(rtRes);
    } catch (err) {
      console.error('Failed to load NCR analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(timeRange);
  }, [timeRange, loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {([7, 30, 90] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                timeRange === r
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Top Row: Aging + Severity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Buckets */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              NCR Aging (Open)
            </h3>
            {agingSummary && (
              <div className="text-right">
                <span className="text-2xl font-bold text-gray-900">{agingSummary.totalOpen}</span>
                <p className="text-xs text-gray-500">
                  Avg {agingSummary.averageDaysOpen} days
                </p>
              </div>
            )}
          </div>
          {agingSummary && <AgingChart buckets={agingSummary.buckets} />}
        </div>

        {/* Severity Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Severity Breakdown
          </h3>
          <SeverityDonut data={severity} />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          NCR Trend (Created vs Closed)
        </h3>
        <TrendChart data={trend} />
      </div>

      {/* Pareto Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Defect Type Pareto
        </h3>
        <ParetoChart data={defectTypes} />
      </div>

      {/* Bottom Row: Station / Source / Disposition / Response Time */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Station */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            NCRs by Station
          </h3>
          {stations.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No station data available</p>
          ) : (
            <div className="space-y-2">
              {stations.map((s) => {
                const maxC = Math.max(...stations.map((st) => st.count), 1);
                const pct = (s.count / maxC) * 100;
                return (
                  <div key={s.stationId} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm text-gray-700">
                      {s.stationName}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold text-gray-900">
                      {s.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source + Disposition side by side */}
        <div className="space-y-6">
          {/* Source breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Source Breakdown
            </h3>
            <div className="flex gap-4">
              {source.map((s) => {
                const total = source.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                const label = s.source === 'iqc' ? 'IQC' : 'Production';
                const color = s.source === 'iqc' ? 'bg-purple-500' : 'bg-blue-500';
                return (
                  <div key={s.source} className="flex-1 rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      <span className="text-xs text-gray-500">{label}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{s.count}</p>
                    <p className="text-xs text-gray-400">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disposition */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Disposition Breakdown
            </h3>
            {dispositions.length === 0 ? (
              <p className="text-sm text-gray-400">No dispositions recorded</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dispositions.map((d) => {
                  const colorMap: Record<string, string> = {
                    rework: 'bg-amber-100 text-amber-800 border-amber-200',
                    scrap: 'bg-red-100 text-red-800 border-red-200',
                    use_as_is: 'bg-green-100 text-green-800 border-green-200',
                    defer: 'bg-gray-100 text-gray-800 border-gray-200',
                  };
                  const label = d.disposition.replace(/_/g, ' ');
                  return (
                    <div
                      key={d.disposition}
                      className={`rounded-lg border px-3 py-2 ${colorMap[d.disposition] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      <p className="text-xs font-medium capitalize">{label}</p>
                      <p className="text-lg font-bold">{d.count}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Time */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Average Response Time by Severity
        </h3>
        <ResponseTimeTable data={responseTime} />
      </div>
    </div>
  );
}
