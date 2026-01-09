'use client';

import { useEffect, useState } from 'react';

interface OEEGaugeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'excellent' | 'good' | 'warning' | 'critical';
  color?: 'blue' | 'green' | 'purple' | 'auto';
  showBenchmark?: boolean;
  className?: string;
}

export function OEEGauge({
  value,
  size = 'md',
  status = 'good',
  color = 'auto',
  showBenchmark = false,
  className = '',
}: OEEGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  // Animate the value on mount
  useEffect(() => {
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    const startValue = animatedValue;
    const endValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;

      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  // Size configurations
  const sizeConfig = {
    sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' },
    md: { width: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-sm' },
    lg: { width: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-sm' },
    xl: { width: 220, strokeWidth: 14, fontSize: 'text-5xl', labelSize: 'text-base' },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  // Determine color based on status or explicit color
  const getColor = () => {
    if (color !== 'auto') {
      const colors = {
        blue: { stroke: 'stroke-blue-500', text: 'text-blue-600' },
        green: { stroke: 'stroke-green-500', text: 'text-green-600' },
        purple: { stroke: 'stroke-purple-500', text: 'text-purple-600' },
      };
      return colors[color];
    }

    const statusColors = {
      excellent: { stroke: 'stroke-green-500', text: 'text-green-600' },
      good: { stroke: 'stroke-blue-500', text: 'text-blue-600' },
      warning: { stroke: 'stroke-amber-500', text: 'text-amber-600' },
      critical: { stroke: 'stroke-red-500', text: 'text-red-600' },
    };
    return statusColors[status];
  };

  const colorClasses = getColor();

  // Benchmark position (85% = world-class OEE)
  const benchmarkAngle = (85 / 100) * 360 - 90;
  const benchmarkX = config.width / 2 + radius * Math.cos((benchmarkAngle * Math.PI) / 180);
  const benchmarkY = config.width / 2 + radius * Math.sin((benchmarkAngle * Math.PI) / 180);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={config.width}
        height={config.width}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-gray-200"
        />

        {/* Progress circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-300 ${colorClasses.stroke}`}
        />

        {/* Benchmark marker (at 85%) */}
        {showBenchmark && (
          <g className="transform rotate-90" style={{ transformOrigin: 'center' }}>
            <circle
              cx={benchmarkX}
              cy={benchmarkY}
              r={4}
              className="fill-blue-600"
            />
            <line
              x1={config.width / 2}
              y1={config.width / 2}
              x2={benchmarkX}
              y2={benchmarkY}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3,3"
              className="text-blue-400"
            />
          </g>
        )}
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-black ${config.fontSize} ${colorClasses.text}`}>
          {Math.round(animatedValue)}
        </span>
        <span className={`${config.labelSize} text-gray-400 -mt-1`}>%</span>
      </div>
    </div>
  );
}
