'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface FPYTrendPoint {
  periodStart: string;
  periodLabel: string;
  fpy: number;
  totalAttempted: number;
  firstPassCount: number;
}

interface FPYTrendChartProps {
  data: FPYTrendPoint[];
  height?: number;
}

export function FPYTrendChart({ data, height = 250 }: FPYTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="periodLabel"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, 'FPY']}
          labelStyle={{ fontWeight: 600, color: '#111827' }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: 13,
          }}
        />
        {/* Target lines */}
        <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '95%', position: 'left', fontSize: 11, fill: '#22c55e' }} />
        <ReferenceLine y={90} stroke="#eab308" strokeDasharray="4 4" label={{ value: '90%', position: 'left', fontSize: 11, fill: '#eab308' }} />
        <Line
          type="monotone"
          dataKey="fpy"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, fill: '#2563eb' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
