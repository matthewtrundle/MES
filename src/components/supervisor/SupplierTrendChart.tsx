'use client';

import type { SupplierTrendPoint } from '@/lib/actions/supplier-analytics';

interface SupplierTrendChartProps {
  data: SupplierTrendPoint[];
  className?: string;
}

export function SupplierTrendChart({ data, className = '' }: SupplierTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-gray-400 py-12 ${className}`}>
        No inspection data available for this supplier.
      </div>
    );
  }

  const width = 500;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 40, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minRate = Math.max(0, Math.min(...data.map((d) => d.acceptanceRate)) - 5);
  const maxRate = 100;

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (rate: number) =>
    padding.top + chartH - ((rate - minRate) / (maxRate - minRate)) * chartH;

  // Build path
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.acceptanceRate)}`)
    .join(' ');

  // Area path
  const areaPath =
    linePath +
    ` L ${xScale(data.length - 1)} ${yScale(minRate)} L ${xScale(0)} ${yScale(minRate)} Z`;

  // Y-axis grid lines
  const yTicks = [minRate, 25, 50, 75, 85, 95, 100].filter(
    (v) => v >= minRate && v <= maxRate
  );
  const uniqueYTicks = [...new Set(yTicks)].sort((a, b) => a - b);

  // Reference lines
  const threshold95 = yScale(95);
  const threshold85 = yScale(85);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid lines */}
        {uniqueYTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={yScale(tick)}
              x2={width - padding.right}
              y2={yScale(tick)}
              stroke="#e2e8f0"
              strokeDasharray={tick === 95 || tick === 85 ? '4,4' : undefined}
            />
            <text
              x={padding.left - 8}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {tick}%
            </text>
          </g>
        ))}

        {/* Threshold zones */}
        {95 >= minRate && (
          <rect
            x={padding.left}
            y={padding.top}
            width={chartW}
            height={threshold95 - padding.top}
            fill="#dcfce7"
            opacity={0.3}
          />
        )}
        {85 >= minRate && 95 >= minRate && (
          <rect
            x={padding.left}
            y={threshold95}
            width={chartW}
            height={threshold85 - threshold95}
            fill="#fef9c3"
            opacity={0.3}
          />
        )}

        {/* Area fill */}
        <path d={areaPath} fill="url(#trendGradient)" opacity={0.3} />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const color =
            d.acceptanceRate >= 95
              ? '#22c55e'
              : d.acceptanceRate >= 85
                ? '#eab308'
                : '#ef4444';

          return (
            <g key={i}>
              <circle
                cx={xScale(i)}
                cy={yScale(d.acceptanceRate)}
                r={4}
                fill="white"
                stroke={color}
                strokeWidth={2}
              >
                <title>
                  {d.month}: {d.acceptanceRate}% ({d.conformingInspections}/{d.totalInspections})
                </title>
              </circle>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every label if <= 6 months, otherwise every other
          if (data.length > 6 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {d.month.slice(5)} {/* Show MM only */}
            </text>
          );
        })}

        {/* Axis lines */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
        />
      </svg>
    </div>
  );
}
