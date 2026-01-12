'use client';

import { type ParetoData, toParetoData } from '@/lib/utils/pareto';

// Re-export for backwards compatibility
export { toParetoData, type ParetoData };

interface ParetoChartProps {
  data: ParetoData[];
  title: string;
  valueLabel?: string;
  color?: 'blue' | 'amber' | 'red' | 'green';
  showRecommendation?: boolean;
  className?: string;
}

export function ParetoChart({
  data,
  title,
  valueLabel = 'Count',
  color = 'blue',
  showRecommendation = true,
  className = '',
}: ParetoChartProps) {
  if (data.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center text-gray-500 py-8">
          No data available
        </div>
      </div>
    );
  }

  const colorConfig = {
    blue: {
      bar: 'bg-blue-500',
      barHover: 'hover:bg-blue-600',
      text: 'text-blue-600',
      line: '#3b82f6',
    },
    amber: {
      bar: 'bg-amber-500',
      barHover: 'hover:bg-amber-600',
      text: 'text-amber-600',
      line: '#f59e0b',
    },
    red: {
      bar: 'bg-red-500',
      barHover: 'hover:bg-red-600',
      text: 'text-red-600',
      line: '#ef4444',
    },
    green: {
      bar: 'bg-green-500',
      barHover: 'hover:bg-green-600',
      text: 'text-green-600',
      line: '#22c55e',
    },
  };

  const colors = colorConfig[color];
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Find items that make up 80% (Pareto principle)
  const eightyPercentIndex = data.findIndex((d) => d.cumulative >= 80);
  const top80Items = eightyPercentIndex >= 0 ? eightyPercentIndex + 1 : data.length;

  // SVG dimensions for cumulative line
  const chartWidth = 100;
  const chartHeight = 100;

  // Generate cumulative line points
  const linePoints = data.map((d, i) => {
    const x = ((i + 0.5) / data.length) * chartWidth;
    const y = chartHeight - (d.cumulative / 100) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        {/* Recommendation */}
        {showRecommendation && top80Items <= 3 && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
            <span className="font-medium text-blue-700">Focus Area:</span>
            <span className="text-blue-600 ml-1">
              Top {top80Items} item{top80Items > 1 ? 's' : ''} account for{' '}
              {data[top80Items - 1]?.cumulative.toFixed(0)}% of total
            </span>
          </div>
        )}

        {/* Chart */}
        <div className="relative">
          {/* Bars */}
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={item.label} className="group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={`font-medium ${index < top80Items ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.label}
                    {index < top80Items && (
                      <span className="ml-1 text-xs text-blue-500">*</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono ${colors.text}`}>
                      {item.value} {valueLabel}
                    </span>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                  {/* Value bar */}
                  <div
                    className={`absolute inset-y-0 left-0 ${colors.bar} ${colors.barHover} transition-all duration-500 rounded-full`}
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                  {/* Cumulative marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-800"
                    style={{ left: `${item.cumulative}%` }}
                    title={`Cumulative: ${item.cumulative.toFixed(0)}%`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Cumulative Line Overlay (SVG) */}
          <div className="absolute inset-0 pointer-events-none">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full opacity-0"
            >
              <polyline
                points={linePoints}
                fill="none"
                stroke={colors.line}
                strokeWidth="2"
                strokeDasharray="4,2"
              />
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded ${colors.bar}`} />
              <span>{valueLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-gray-800" />
              <span>Cumulative %</span>
            </div>
          </div>
          <div>
            <span className="text-blue-500">*</span> = Top 80%
          </div>
        </div>

        {/* 80% Line Reference */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Pareto Principle: 80% of effects from 20% of causes</span>
          <span className="font-medium text-gray-600">
            80% = first {top80Items} item{top80Items > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

