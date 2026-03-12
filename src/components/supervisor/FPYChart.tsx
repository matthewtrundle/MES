'use client';

import { useMemo } from 'react';

export interface FPYChartPoint {
  date: string;
  dateLabel: string;
  fpy: number;
  totalFirstPass: number;
  passedFirstPass: number;
}

interface FPYChartProps {
  data: FPYChartPoint[];
  height?: number;
  target?: number;
}

export function FPYChart({ data, height = 280, target = 95 }: FPYChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const chartWidth = 800;
    const chartHeight = height;
    const marginLeft = 50;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = chartWidth - marginLeft - marginRight;
    const plotHeight = chartHeight - marginTop - marginBottom;

    // Y-axis: 0-100%
    const yMin = 0;
    const yMax = 100;

    const xScale = (i: number) =>
      marginLeft + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2);
    const yScale = (v: number) =>
      marginTop + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    const linePath = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.fpy).toFixed(1)}`)
      .join(' ');

    // Fill area under the line
    const areaPath =
      linePath +
      ` L ${xScale(data.length - 1).toFixed(1)} ${yScale(0).toFixed(1)}` +
      ` L ${xScale(0).toFixed(1)} ${yScale(0).toFixed(1)} Z`;

    // Y-axis ticks
    const yTicks = [0, 20, 40, 60, 80, 100].map((val) => ({
      value: val,
      y: yScale(val),
    }));

    // X-axis ticks
    const maxXLabels = 12;
    const step = Math.max(1, Math.ceil(data.length / maxXLabels));
    const xTicks = data
      .map((p, i) => ({ index: i, x: xScale(i), label: p.dateLabel }))
      .filter((_, i) => i % step === 0 || i === data.length - 1);

    return {
      chartWidth,
      chartHeight,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      plotWidth,
      plotHeight,
      xScale,
      yScale,
      linePath,
      areaPath,
      yTicks,
      xTicks,
    };
  }, [data, height]);

  if (!chartData || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No FPY trend data available
      </div>
    );
  }

  const {
    chartWidth,
    chartHeight,
    marginLeft,
    plotWidth,
    plotHeight,
    marginTop,
    xScale,
    yScale,
    linePath,
    areaPath,
    yTicks,
    xTicks,
  } = chartData;

  const targetY = yScale(target);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ minWidth: 400, maxHeight: height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={`grid-${i}`}
            x1={marginLeft}
            x2={marginLeft + plotWidth}
            y1={tick.y}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Target zone (above target is green) */}
        <rect
          x={marginLeft}
          y={yScale(100)}
          width={plotWidth}
          height={yScale(target) - yScale(100)}
          fill="#dcfce7"
          opacity={0.2}
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#fpy-gradient)" opacity={0.4} />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="fpy-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Target line */}
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={targetY}
          y2={targetY}
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
        <text
          x={marginLeft + plotWidth + 4}
          y={targetY + 4}
          fill="#22c55e"
          fontSize={10}
          fontWeight={600}
        >
          {target}%
        </text>

        {/* Warning line at 90% */}
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={yScale(90)}
          y2={yScale(90)}
          stroke="#eab308"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={marginLeft + plotWidth + 4}
          y={yScale(90) + 4}
          fill="#eab308"
          fontSize={9}
        >
          90%
        </text>

        {/* Data line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* Data points */}
        {data.map((p, i) => {
          const cx = xScale(i);
          const cy = yScale(p.fpy);
          const color = p.fpy >= target ? '#22c55e' : p.fpy >= 90 ? '#eab308' : '#ef4444';

          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />
              <title>
                {p.dateLabel}: {p.fpy}% FPY
                {'\n'}{p.passedFirstPass}/{p.totalFirstPass} first-pass
              </title>
            </g>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`ylabel-${i}`}
            x={marginLeft - 8}
            y={tick.y + 4}
            textAnchor="end"
            fill="#6b7280"
            fontSize={10}
          >
            {tick.value}%
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`xlabel-${i}`}
            x={tick.x}
            y={chartHeight - 8}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={10}
          >
            {tick.label}
          </text>
        ))}

        {/* Axes */}
        <line
          x1={marginLeft}
          x2={marginLeft}
          y1={marginTop}
          y2={marginTop + plotHeight}
          stroke="#9ca3af"
          strokeWidth={1}
        />
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={marginTop + plotHeight}
          y2={marginTop + plotHeight}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// SVG-based horizontal bar chart for FPY by station
// ============================================================================

export interface FPYBarData {
  label: string;
  value: number;
  sublabel?: string;
}

interface FPYBarChartProps {
  data: FPYBarData[];
  target?: number;
  height?: number;
}

export function FPYBarChart({ data, target = 95, height: maxHeight }: FPYBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm py-8">
        No station data available
      </div>
    );
  }

  const barHeight = 32;
  const gap = 8;
  const marginLeft = 140;
  const marginRight = 60;
  const marginTop = 10;
  const marginBottom = 10;
  const chartWidth = 800;
  const plotHeight = data.length * (barHeight + gap) - gap;
  const chartHeight = plotHeight + marginTop + marginBottom;
  const plotWidth = chartWidth - marginLeft - marginRight;

  const xScale = (v: number) => (v / 100) * plotWidth;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ minWidth: 400, maxHeight: maxHeight ?? chartHeight }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Target line */}
        <line
          x1={marginLeft + xScale(target)}
          x2={marginLeft + xScale(target)}
          y1={marginTop}
          y2={marginTop + plotHeight}
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* 90% warning line */}
        <line
          x1={marginLeft + xScale(90)}
          x2={marginLeft + xScale(90)}
          y1={marginTop}
          y2={marginTop + plotHeight}
          stroke="#eab308"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />

        {data.map((d, i) => {
          const y = marginTop + i * (barHeight + gap);
          const barWidth = xScale(Math.min(100, d.value));
          const color =
            d.value >= target
              ? '#22c55e'
              : d.value >= 90
                ? '#eab308'
                : '#ef4444';
          const bgColor =
            d.value >= target
              ? '#dcfce7'
              : d.value >= 90
                ? '#fef9c3'
                : '#fee2e2';

          return (
            <g key={i}>
              {/* Station label */}
              <text
                x={marginLeft - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fill="#374151"
                fontSize={12}
                fontWeight={500}
              >
                {d.label}
              </text>

              {/* Bar background */}
              <rect
                x={marginLeft}
                y={y}
                width={plotWidth}
                height={barHeight}
                fill="#f3f4f6"
                rx={4}
              />

              {/* Bar fill */}
              <rect
                x={marginLeft}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={bgColor}
                rx={4}
              />
              <rect
                x={marginLeft}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={4}
                opacity={0.6}
              />

              {/* Value label */}
              <text
                x={marginLeft + barWidth + 8}
                y={y + barHeight / 2 + 5}
                fill={color}
                fontSize={13}
                fontWeight={700}
              >
                {d.value}%
              </text>

              {/* Sublabel */}
              {d.sublabel && (
                <text
                  x={marginLeft + 8}
                  y={y + barHeight / 2 + 4}
                  fill="#6b7280"
                  fontSize={10}
                >
                  {d.sublabel}
                </text>
              )}

              <title>{d.label}: {d.value}% FPY{d.sublabel ? ` (${d.sublabel})` : ''}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
