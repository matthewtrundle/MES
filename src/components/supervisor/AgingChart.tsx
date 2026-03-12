'use client';

import type { AgingBucket } from '@/lib/actions/ncr-analytics';

interface AgingChartProps {
  buckets: AgingBucket[];
  className?: string;
}

const BUCKET_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  '<24h': { bar: '#22c55e', bg: '#f0fdf4', text: '#166534' },
  '1-3 days': { bar: '#eab308', bg: '#fefce8', text: '#854d0e' },
  '3-7 days': { bar: '#f97316', bg: '#fff7ed', text: '#9a3412' },
  '7-14 days': { bar: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
  '14-30 days': { bar: '#dc2626', bg: '#fef2f2', text: '#991b1b' },
  '>30 days': { bar: '#991b1b', bg: '#fef2f2', text: '#7f1d1d' },
};

export function AgingChart({ buckets, className = '' }: AgingChartProps) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const chartWidth = 400;
  const chartHeight = 200;
  const labelWidth = 90;
  const countWidth = 40;
  const barAreaWidth = chartWidth - labelWidth - countWidth - 20;
  const barHeight = 24;
  const barGap = 8;
  const topPadding = 10;

  const totalHeight = topPadding + buckets.length * (barHeight + barGap);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${chartWidth} ${totalHeight}`}
        className="w-full"
        style={{ maxHeight: `${totalHeight}px` }}
      >
        {buckets.map((bucket, i) => {
          const y = topPadding + i * (barHeight + barGap);
          const barWidth = maxCount > 0 ? (bucket.count / maxCount) * barAreaWidth : 0;
          const colors = BUCKET_COLORS[bucket.label] ?? { bar: '#94a3b8', bg: '#f8fafc', text: '#475569' };

          return (
            <g key={bucket.label}>
              {/* Label */}
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2 + 1}
                textAnchor="end"
                className="text-xs"
                fill="#64748b"
                dominantBaseline="middle"
                fontSize="11"
              >
                {bucket.label}
              </text>

              {/* Background bar */}
              <rect
                x={labelWidth}
                y={y}
                width={barAreaWidth}
                height={barHeight}
                rx={4}
                fill="#f1f5f9"
              />

              {/* Data bar */}
              {bucket.count > 0 && (
                <rect
                  x={labelWidth}
                  y={y}
                  width={Math.max(barWidth, 4)}
                  height={barHeight}
                  rx={4}
                  fill={colors.bar}
                  opacity={0.85}
                >
                  <title>
                    {bucket.label}: {bucket.count} NCR{bucket.count !== 1 ? 's' : ''}
                  </title>
                </rect>
              )}

              {/* Count label */}
              <text
                x={labelWidth + barAreaWidth + 8}
                y={y + barHeight / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="600"
                fill={bucket.count > 0 ? colors.text : '#94a3b8'}
              >
                {bucket.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
