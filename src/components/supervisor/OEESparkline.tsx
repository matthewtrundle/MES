'use client';

interface OEESparklineProps {
  data: number[];
  labels?: string[];
  color?: 'blue' | 'green' | 'purple' | 'gray';
  className?: string;
}

export function OEESparkline({
  data,
  labels = [],
  color = 'blue',
  className = '',
}: OEESparklineProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-400 ${className}`}>
        No data yet
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  // SVG dimensions
  const width = 100;
  const height = 30;
  const padding = 2;

  // Calculate points for the sparkline
  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return { x, y, value };
  });

  // Create path string
  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create area path (for gradient fill)
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  const colorConfig = {
    blue: {
      stroke: '#3b82f6',
      fill: 'url(#blueGradient)',
      dot: 'fill-blue-500',
    },
    green: {
      stroke: '#22c55e',
      fill: 'url(#greenGradient)',
      dot: 'fill-green-500',
    },
    purple: {
      stroke: '#a855f7',
      fill: 'url(#purpleGradient)',
      dot: 'fill-purple-500',
    },
    gray: {
      stroke: '#6b7280',
      fill: 'url(#grayGradient)',
      dot: 'fill-gray-500',
    },
  };

  const colors = colorConfig[color];

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="greenGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="purpleGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grayGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6b7280" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6b7280" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaD} fill={colors.fill} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="2"
            className={colors.dot}
          />
        )}
      </svg>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{labels[0]}</span>
          <span className="text-[10px] text-gray-400">{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
