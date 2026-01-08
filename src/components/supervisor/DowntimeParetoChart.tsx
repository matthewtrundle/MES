'use client';

interface DowntimeStats {
  reasonCode: string;
  reasonDescription: string;
  isPlanned: boolean;
  lossType: string;
  totalMinutes: number;
  count: number;
}

interface DowntimeParetoChartProps {
  data: DowntimeStats[];
}

export function DowntimeParetoChart({ data }: DowntimeParetoChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No downtime data available
      </div>
    );
  }

  const maxMinutes = Math.max(...data.map((d) => d.totalMinutes));
  const totalMinutes = data.reduce((sum, d) => sum + d.totalMinutes, 0);

  // Calculate cumulative percentages for Pareto line
  let cumulative = 0;
  const cumulativePercentages = data.map((d) => {
    cumulative += d.totalMinutes;
    return (cumulative / totalMinutes) * 100;
  });

  return (
    <div className="space-y-4">
      {/* Simple bar chart representation */}
      <div className="flex h-48 items-end gap-2">
        {data.slice(0, 8).map((item, idx) => {
          const height = (item.totalMinutes / maxMinutes) * 100;
          return (
            <div
              key={idx}
              className="relative flex flex-1 flex-col items-center"
            >
              <div
                className={`w-full rounded-t ${item.isPlanned ? 'bg-blue-500' : 'bg-red-500'}`}
                style={{ height: `${height}%` }}
                title={`${item.reasonCode}: ${item.totalMinutes} min`}
              />
              <span className="mt-1 text-xs text-gray-600 truncate w-full text-center">
                {item.reasonCode}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cumulative line visualization */}
      <div className="relative h-2 rounded bg-gray-200">
        {cumulativePercentages.slice(0, 8).map((pct, idx) => (
          <div
            key={idx}
            className="absolute top-0 h-full bg-yellow-400"
            style={{
              left: `${(idx / Math.min(data.length, 8)) * 100}%`,
              width: `${(1 / Math.min(data.length, 8)) * 100}%`,
              opacity: 0.3 + (pct / 100) * 0.7,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-blue-500" />
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span>Unplanned</span>
        </div>
      </div>
    </div>
  );
}
