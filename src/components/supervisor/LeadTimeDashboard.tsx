'use client';

import { Icons } from '@/components/icons';
import type {
  SupplierLeadTimeData,
  PartLeadTimeData,
  MonthlyLeadTimeTrend,
} from '@/lib/actions/lead-time-analytics';

interface LeadTimeDashboardProps {
  supplierData: SupplierLeadTimeData[];
  partData: PartLeadTimeData[];
  trendData: MonthlyLeadTimeTrend[];
}

// ── Color helpers ────────────────────────────────────────────────────

function getLeadTimeColor(actual: number, expected: number): string {
  if (expected === 0) return 'text-gray-600';
  const diff = actual - expected;
  if (diff <= 0) return 'text-green-600';
  if (diff <= 5) return 'text-amber-600';
  return 'text-red-600';
}

function getOnTimeColor(rate: number): string {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 75) return 'text-amber-600';
  return 'text-red-600';
}

// ── Sparkline Component ──────────────────────────────────────────────

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return <span className="text-xs text-gray-400">--</span>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((val, i) => {
    const x = padding + i * stepX;
    const y = padding + usableHeight - ((val - min) / range) * usableHeight;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={polyline}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((val, i) => {
        const x = padding + i * stepX;
        const y = padding + usableHeight - ((val - min) / range) * usableHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            fill={i === data.length - 1 ? '#3b82f6' : '#93c5fd'}
          />
        );
      })}
    </svg>
  );
}

// ── Monthly Trend Bar Chart ──────────────────────────────────────────

function MonthlyTrendChart({ data }: { data: MonthlyLeadTimeTrend[] }) {
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.avgLeadTimeDays), 1);
  const barWidth = data.length > 0 ? Math.min(innerWidth / data.length - 8, 50) : 40;
  const barGap = data.length > 0 ? (innerWidth - barWidth * data.length) / (data.length + 1) : 0;

  // Y-axis gridlines
  const yTicks = 4;
  const yStep = Math.ceil(maxValue / yTicks);

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-2xl" preserveAspectRatio="xMidYMid meet">
      {/* Y-axis gridlines and labels */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const value = i * yStep;
        const y = padding.top + innerHeight - (value / (yStep * yTicks)) * innerHeight;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + innerWidth}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-gray-500"
              fontSize="11"
            >
              {value}d
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? (d.avgLeadTimeDays / (yStep * yTicks)) * innerHeight : 0;
        const x = padding.left + barGap + i * (barWidth + barGap);
        const y = padding.top + innerHeight - barHeight;

        return (
          <g key={d.month}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="3"
              className={d.poCount === 0 ? 'fill-gray-200' : 'fill-blue-500'}
            />
            {/* Value label */}
            {d.poCount > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-gray-700"
                fontSize="10"
                fontWeight="600"
              >
                {d.avgLeadTimeDays}
              </text>
            )}
            {/* Month label */}
            <text
              x={x + barWidth / 2}
              y={padding.top + innerHeight + 16}
              textAnchor="middle"
              className="fill-gray-500"
              fontSize="10"
            >
              {d.month.split(' ')[0]}
            </text>
            {/* PO count */}
            <text
              x={x + barWidth / 2}
              y={padding.top + innerHeight + 30}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="9"
            >
              {d.poCount} PO{d.poCount !== 1 ? 's' : ''}
            </text>
          </g>
        );
      })}

      {/* Y-axis label */}
      <text
        x={12}
        y={padding.top + innerHeight / 2}
        textAnchor="middle"
        className="fill-gray-500"
        fontSize="11"
        transform={`rotate(-90, 12, ${padding.top + innerHeight / 2})`}
      >
        Avg Lead Time (days)
      </text>
    </svg>
  );
}

// ── Main Dashboard Component ─────────────────────────────────────────

export function LeadTimeDashboard({ supplierData, partData, trendData }: LeadTimeDashboardProps) {
  // Calculate summary metrics
  const totalPOs = supplierData.reduce((sum, s) => sum + s.totalPOs, 0);
  const overallAvgLeadTime = totalPOs > 0
    ? Math.round(
        supplierData.reduce((sum, s) => sum + s.avgActualLeadTimeDays * s.totalPOs, 0) / totalPOs * 10
      ) / 10
    : 0;
  const overallOnTimeRate = totalPOs > 0
    ? Math.round(
        supplierData.reduce((sum, s) => sum + s.onTimeRate * s.totalPOs, 0) / totalPOs
      )
    : 100;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Icons.clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Lead Time</p>
              <p className="text-3xl font-bold text-gray-900">{overallAvgLeadTime}<span className="text-base font-normal text-gray-500"> days</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Icons.pass className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">On-Time Delivery</p>
              <p className={`text-3xl font-bold ${getOnTimeColor(overallOnTimeRate)}`}>{overallOnTimeRate}<span className="text-base font-normal text-gray-500">%</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2">
              <Icons.chart className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">POs Tracked</p>
              <p className="text-3xl font-bold text-gray-900">{totalPOs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Supplier Lead Time Performance</h3>
        </div>
        {supplierData.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <Icons.clock className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">No fully received POs to analyze</p>
            <p className="text-sm">Lead time data will appear once purchase orders are received.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">On-Time %</th>
                  <th className="px-4 py-3 text-right">Total POs</th>
                  <th className="px-4 py-3 text-center">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplierData.map((supplier) => (
                  <tr key={supplier.supplierId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{supplier.supplierName}</p>
                        <p className="text-xs text-gray-500">{supplier.supplierCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {supplier.avgExpectedLeadTimeDays > 0
                        ? `${supplier.avgExpectedLeadTimeDays}d`
                        : '--'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${getLeadTimeColor(supplier.avgActualLeadTimeDays, supplier.avgExpectedLeadTimeDays)}`}>
                        {supplier.avgActualLeadTimeDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        supplier.onTimeRate >= 90
                          ? 'bg-green-100 text-green-700'
                          : supplier.onTimeRate >= 75
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {supplier.onTimeRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {supplier.totalPOs}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Sparkline data={supplier.recentTrend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Trend Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-900">Monthly Lead Time Trend</h3>
        {trendData.every(d => d.poCount === 0) ? (
          <div className="py-8 text-center text-gray-500">
            <Icons.chart className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">No trend data available</p>
          </div>
        ) : (
          <MonthlyTrendChart data={trendData} />
        )}
      </div>

      {/* Part Lead Time Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Lead Time by Part Number</h3>
        </div>
        {partData.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Icons.material className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">No part-level data available</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {partData.slice(0, 15).map((part) => (
              <div key={part.partNumber} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{part.partNumber}</p>
                  <p className="text-sm text-gray-500">{part.partName}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{part.avgLeadTimeDays}d</p>
                    <p className="text-xs text-gray-500">avg lead time</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">{part.orderCount}</p>
                    <p className="text-xs text-gray-500">orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">
                      Last: {new Date(part.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
