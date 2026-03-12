'use client';

import { useMemo } from 'react';

export interface ControlChartProps {
  points: Array<{
    index: number;
    value: number;
    label: string;
    timestamp?: string;
  }>;
  ucl: number;
  cl: number;
  lcl: number;
  usl?: number | null;
  lsl?: number | null;
  height?: number;
  showLabels?: boolean;
}

export function ControlChart({
  points,
  ucl,
  cl,
  lcl,
  usl,
  lsl,
  height = 320,
  showLabels = true,
}: ControlChartProps) {
  const chartData = useMemo(() => {
    if (points.length === 0) return null;

    const values = points.map((p) => p.value);
    const allLimits = [ucl, cl, lcl, ...values];
    if (usl != null) allLimits.push(usl);
    if (lsl != null) allLimits.push(lsl);

    const dataMin = Math.min(...allLimits);
    const dataMax = Math.max(...allLimits);
    const range = dataMax - dataMin || 1;
    const padding = range * 0.1;
    const yMin = dataMin - padding;
    const yMax = dataMax + padding;

    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const chartWidth = 800;
    const chartHeight = height;
    const plotWidth = chartWidth - marginLeft - marginRight;
    const plotHeight = chartHeight - marginTop - marginBottom;

    const xScale = (i: number) =>
      marginLeft + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2);
    const yScale = (v: number) =>
      marginTop + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    // Build polyline path for data points
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(' ');

    // Y-axis ticks
    const yTickCount = 6;
    const yTicks = Array.from({ length: yTickCount }, (_, i) => {
      const val = yMin + ((yMax - yMin) * i) / (yTickCount - 1);
      return { value: val, y: yScale(val) };
    });

    // X-axis ticks (show every Nth label)
    const maxXLabels = 12;
    const step = Math.max(1, Math.ceil(points.length / maxXLabels));
    const xTicks = points
      .filter((_, i) => i % step === 0 || i === points.length - 1)
      .map((p, _, arr) => ({
        index: p.index,
        x: xScale(p.index),
        label: p.label,
      }));

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
      yTicks,
      xTicks,
      yMin,
      yMax,
    };
  }, [points, ucl, cl, lcl, usl, lsl, height]);

  if (!chartData || points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        No data available for control chart
      </div>
    );
  }

  const {
    chartWidth,
    chartHeight,
    marginLeft,
    marginRight,
    marginTop,
    plotWidth,
    plotHeight,
    xScale,
    yScale,
    linePath,
    yTicks,
    xTicks,
  } = chartData;

  const uclY = yScale(ucl);
  const clY = yScale(cl);
  const lclY = yScale(lcl);
  const uslY = usl != null ? yScale(usl) : null;
  const lslY = lsl != null ? yScale(lsl) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ minWidth: 500, maxHeight: height }}
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

        {/* Spec limit zone (fill between USL and LSL) */}
        {uslY !== null && lslY !== null && (
          <rect
            x={marginLeft}
            y={Math.min(uslY, lslY)}
            width={plotWidth}
            height={Math.abs(uslY - lslY)}
            fill="#dcfce7"
            opacity={0.3}
          />
        )}

        {/* Control limit zone (fill between UCL and LCL) */}
        <rect
          x={marginLeft}
          y={Math.min(uclY, lclY)}
          width={plotWidth}
          height={Math.abs(uclY - lclY)}
          fill="#dbeafe"
          opacity={0.3}
        />

        {/* Spec limit lines */}
        {uslY !== null && (
          <>
            <line
              x1={marginLeft}
              x2={marginLeft + plotWidth}
              y1={uslY}
              y2={uslY}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            {showLabels && (
              <text
                x={marginLeft + plotWidth + 4}
                y={uslY + 4}
                fill="#ef4444"
                fontSize={10}
                fontWeight={600}
              >
                USL
              </text>
            )}
          </>
        )}
        {lslY !== null && (
          <>
            <line
              x1={marginLeft}
              x2={marginLeft + plotWidth}
              y1={lslY}
              y2={lslY}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            {showLabels && (
              <text
                x={marginLeft + plotWidth + 4}
                y={lslY + 4}
                fill="#ef4444"
                fontSize={10}
                fontWeight={600}
              >
                LSL
              </text>
            )}
          </>
        )}

        {/* Control limit lines */}
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={uclY}
          y2={uclY}
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={lclY}
          y2={lclY}
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* Center line */}
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={clY}
          y2={clY}
          stroke="#22c55e"
          strokeWidth={1.5}
        />

        {showLabels && (
          <>
            <text x={marginLeft - 4} y={uclY + 4} fill="#3b82f6" fontSize={10} fontWeight={500} textAnchor="end">
              UCL
            </text>
            <text x={marginLeft - 4} y={clY + 4} fill="#22c55e" fontSize={10} fontWeight={500} textAnchor="end">
              CL
            </text>
            <text x={marginLeft - 4} y={lclY + 4} fill="#3b82f6" fontSize={10} fontWeight={500} textAnchor="end">
              LCL
            </text>
          </>
        )}

        {/* Data line */}
        <path d={linePath} fill="none" stroke="#1e40af" strokeWidth={1.5} />

        {/* Data points */}
        {points.map((p, i) => {
          const cx = xScale(i);
          const cy = yScale(p.value);
          const isOutOfControl = p.value > ucl || p.value < lcl;
          const isOutOfSpec =
            (usl != null && p.value > usl) || (lsl != null && p.value < lsl);

          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={isOutOfControl || isOutOfSpec ? 5 : 3.5}
                fill={isOutOfSpec ? '#dc2626' : isOutOfControl ? '#f59e0b' : '#1e40af'}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <title>
                {p.label}: {p.value.toFixed(3)}
                {p.timestamp ? `\n${new Date(p.timestamp).toLocaleString()}` : ''}
                {isOutOfSpec ? '\nOUT OF SPEC' : isOutOfControl ? '\nOUT OF CONTROL' : ''}
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
            {tick.value.toFixed(2)}
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
            fontSize={9}
          >
            {tick.label.length > 10 ? tick.label.slice(-8) : tick.label}
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

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 px-2">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-800" />
          In control
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
          Out of control
        </span>
        {(usl != null || lsl != null) && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-red-600" />
            Out of spec
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-green-500" />
          CL (Mean)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-blue-500" />
          UCL/LCL
        </span>
        {(usl != null || lsl != null) && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-red-500" />
            USL/LSL
          </span>
        )}
      </div>
    </div>
  );
}
