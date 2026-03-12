'use client';

import type { OperatorTrendPoint } from '@/lib/actions/operator-analytics';

interface OperatorTrendChartProps {
  data: OperatorTrendPoint[];
  operatorName: string;
}

export function OperatorTrendChart({ data, operatorName }: OperatorTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No data available
      </div>
    );
  }

  const maxUnits = Math.max(...data.map((d) => d.unitsCompleted), 1);

  // Chart dimensions
  const width = 700;
  const height = 200;
  const padding = { top: 20, right: 60, bottom: 40, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  // Units line points
  const unitPoints = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? i * xStep : chartW / 2);
    const y = padding.top + chartH - (d.unitsCompleted / maxUnits) * chartH;
    return { x, y, ...d };
  });

  // FPY line points (0-100 scale)
  const fpyPoints = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? i * xStep : chartW / 2);
    const y = padding.top + chartH - (d.fpy / 100) * chartH;
    return { x, y, ...d };
  });

  const unitsPath = unitPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fpyPath = fpyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Show every Nth label to avoid overlap
  const labelInterval = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-gray-700">
        Trend: {operatorName}
      </h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + chartH - frac * chartH;
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4,4"
              />
              <text x={padding.left - 4} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="9">
                {Math.round(maxUnits * frac)}
              </text>
            </g>
          );
        })}

        {/* Units line */}
        <path d={unitsPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        {unitPoints.map((p, i) => (
          <circle key={`u-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
        ))}

        {/* FPY line */}
        <path d={fpyPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" strokeLinejoin="round" />
        {fpyPoints.map((p, i) => (
          <circle key={`f-${i}`} cx={p.x} cy={p.y} r="3" fill="#10b981" />
        ))}

        {/* X axis labels */}
        {data.map((d, i) => {
          if (i % labelInterval !== 0 && i !== data.length - 1) return null;
          const x = padding.left + (data.length > 1 ? i * xStep : chartW / 2);
          return (
            <text
              key={`lbl-${i}`}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="9"
            >
              {d.date.slice(5)}
            </text>
          );
        })}

        {/* FPY axis label on right */}
        <text x={width - 4} y={padding.top + 4} textAnchor="end" className="fill-emerald-500" fontSize="9">100%</text>
        <text x={width - 4} y={padding.top + chartH + 4} textAnchor="end" className="fill-emerald-500" fontSize="9">0%</text>

        {/* Legend */}
        <g transform={`translate(${padding.left + 8}, ${padding.top + 4})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke="#3b82f6" strokeWidth="2" />
          <text x="20" y="3" fontSize="9" className="fill-gray-600">Units</text>
          <line x1="60" y1="0" x2="76" y2="0" stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" />
          <text x="80" y="3" fontSize="9" className="fill-gray-600">FPY %</text>
        </g>
      </svg>
    </div>
  );
}
