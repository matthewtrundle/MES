'use client';

import { Icons } from '@/components/icons';

interface InventoryCardProps {
  materialCode: string;
  description: string;
  qtyRemaining: number;
  qtyReceived: number;
  lotCount: number;
  consumptionRate: number; // units per hour
  runwayHours: number | null;
  status: 'good' | 'low' | 'critical';
  className?: string;
}

export function InventoryCard({
  materialCode,
  description,
  qtyRemaining,
  qtyReceived,
  lotCount,
  consumptionRate,
  runwayHours,
  status,
  className = '',
}: InventoryCardProps) {
  const percentRemaining = (qtyRemaining / qtyReceived) * 100;

  const statusConfig = {
    good: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      barColor: 'bg-green-500',
      textColor: 'text-green-700',
      icon: Icons.pass,
    },
    low: {
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      icon: Icons.warning,
    },
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      barColor: 'bg-red-500',
      textColor: 'text-red-700',
      icon: Icons.qualityFail,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{materialCode}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className={`rounded-full p-1.5 ${status === 'good' ? 'bg-green-100' : status === 'low' ? 'bg-amber-100' : 'bg-red-100'}`}>
          <StatusIcon className={`h-4 w-4 ${config.textColor}`} />
        </div>
      </div>

      {/* Stock Level Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Stock Level</span>
          <span className="font-mono font-medium text-gray-900">
            {qtyRemaining.toLocaleString()} / {qtyReceived.toLocaleString()}
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} transition-all duration-500`}
            style={{ width: `${Math.max(0, Math.min(100, percentRemaining))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0%</span>
          <span>{Math.round(percentRemaining)}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-white/50 p-2 text-center">
          <p className="text-xs text-gray-500">Lots</p>
          <p className="font-semibold text-gray-900">{lotCount}</p>
        </div>
        <div className="rounded-lg bg-white/50 p-2 text-center">
          <p className="text-xs text-gray-500">Rate/hr</p>
          <p className="font-mono font-semibold text-gray-900">
            {consumptionRate.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-white/50 p-2 text-center">
          <p className="text-xs text-gray-500">Runway</p>
          <p className={`font-mono font-semibold ${config.textColor}`}>
            {runwayHours === null ? '∞' : runwayHours < 1 ? '<1h' : `${Math.round(runwayHours)}h`}
          </p>
        </div>
      </div>
    </div>
  );
}

// Summary card for inventory overview
interface InventorySummaryProps {
  totalMaterials: number;
  lowStockCount: number;
  criticalCount: number;
  avgRunwayHours: number;
}

export function InventorySummary({
  totalMaterials,
  lowStockCount,
  criticalCount,
  avgRunwayHours,
}: InventorySummaryProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Total Materials</p>
        <p className="text-3xl font-bold text-gray-900">{totalMaterials}</p>
      </div>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-700">In Stock</p>
        <p className="text-3xl font-bold text-green-600">
          {totalMaterials - lowStockCount - criticalCount}
        </p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-700">Low Stock</p>
        <p className="text-3xl font-bold text-amber-600">{lowStockCount}</p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Critical</p>
        <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
      </div>
    </div>
  );
}

// Consumption trend sparkline
interface ConsumptionSparklineProps {
  data: number[];
  labels: string[];
  className?: string;
}

export function ConsumptionSparkline({
  data,
  labels,
  className = '',
}: ConsumptionSparklineProps) {
  if (data.length === 0) {
    return (
      <div className={`text-center text-sm text-gray-400 ${className}`}>
        No consumption data
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const width = 200;
  const height = 40;
  const padding = 4;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - (value / max) * (height - 2 * padding);
    return { x, y, value };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <path
          d={pathD}
          fill="none"
          stroke="#8B9A82"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            fill="#8B9A82"
          />
        )}
      </svg>
      {labels.length > 0 && (
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
