'use client';

import { Icons } from '@/components/icons';

interface StationBlockProps {
  name: string;
  sequenceOrder: number;
  wipCount: number;
  status: 'running' | 'idle' | 'downtime';
  currentUnit?: string;
  cycleTime?: number;
  estimatedTime?: number;
}

export function StationBlock({
  name,
  sequenceOrder,
  wipCount,
  status,
  currentUnit,
  cycleTime,
  estimatedTime,
}: StationBlockProps) {
  const statusConfig = {
    running: {
      border: 'border-green-500',
      bg: 'bg-green-900/30',
      glow: 'shadow-green-500/20',
      indicator: 'bg-green-500',
      text: 'text-green-400',
      label: 'ACTIVE',
      animate: 'animate-pulse-slow',
    },
    idle: {
      border: 'border-gray-600',
      bg: 'bg-gray-800',
      glow: '',
      indicator: 'bg-gray-500',
      text: 'text-gray-400',
      label: 'IDLE',
      animate: '',
    },
    downtime: {
      border: 'border-red-500',
      bg: 'bg-red-900/30',
      glow: 'shadow-red-500/30',
      indicator: 'bg-red-500',
      text: 'text-red-400',
      label: 'DOWN',
      animate: 'animate-pulse',
    },
  };

  const config = statusConfig[status];

  // Calculate progress percentage for cycle time
  const progressPercent = cycleTime && estimatedTime
    ? Math.min(100, (cycleTime / estimatedTime) * 100)
    : 0;
  const isOvertime = cycleTime && estimatedTime && cycleTime > estimatedTime;

  return (
    <div
      className={`relative min-w-[220px] h-[220px] rounded-2xl border-4 p-6 flex flex-col transition-all ${config.border} ${config.bg} ${config.glow} ${config.animate} shadow-lg`}
    >
      {/* Status Badge */}
      <div className="absolute -top-2 -right-2 flex items-center gap-1.5 rounded-full bg-gray-800 border-2 border-gray-700 px-3 py-1">
        <span className={`h-2.5 w-2.5 rounded-full ${config.indicator} ${status === 'running' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
          {config.label}
        </span>
      </div>

      {/* Station Header */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Station {sequenceOrder}
        </p>
        <h3 className="text-xl font-bold text-white truncate">{name}</h3>
      </div>

      {/* Giant WIP Count */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className={`text-7xl font-black ${status === 'downtime' ? 'text-red-400' : 'text-white'}`}>
            {wipCount}
          </span>
          <p className="text-sm text-gray-400 uppercase tracking-wider mt-1">WIP</p>
        </div>
      </div>

      {/* Current Unit Progress (if applicable) */}
      {currentUnit && (
        <div className="mt-auto pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-sm text-gray-300">{currentUnit}</span>
            {cycleTime !== undefined && estimatedTime && (
              <span className={`text-xs font-medium ${isOvertime ? 'text-amber-400' : 'text-gray-400'}`}>
                {cycleTime}/{estimatedTime}m
              </span>
            )}
          </div>
          {cycleTime !== undefined && estimatedTime && (
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  isOvertime ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Downtime Warning Icon */}
      {status === 'downtime' && (
        <div className="absolute bottom-4 right-4">
          <Icons.warning className="h-8 w-8 text-red-400 animate-bounce" />
        </div>
      )}
    </div>
  );
}
