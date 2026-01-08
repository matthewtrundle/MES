'use client';

import { Icons, StatusIndicator, StationStatusBadge } from '@/components/icons';

interface StationData {
  id: string;
  name: string;
  stationType: string;
  sequenceOrder: number;
  wipCount: number;
  isDowntime: boolean;
  activeOperator?: string;
  currentUnit?: string;
  cycleTime?: number;
  estimatedTime?: number;
}

interface ProductionFlowProps {
  stations: StationData[];
  className?: string;
}

export function ProductionFlow({ stations, className = '' }: ProductionFlowProps) {
  const sortedStations = [...stations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const totalWIP = stations.reduce((sum, s) => sum + s.wipCount, 0);
  const activeStations = stations.filter((s) => s.wipCount > 0 && !s.isDowntime).length;
  const downtimeStations = stations.filter((s) => s.isDowntime).length;

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icons.activity className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Production Flow</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <StatusIndicator status="running" size="sm" />
            <span className="text-gray-600">Active: {activeStations}</span>
          </div>
          {downtimeStations > 0 && (
            <div className="flex items-center gap-1.5">
              <StatusIndicator status="downtime" size="sm" />
              <span className="text-amber-600">Downtime: {downtimeStations}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Icons.unit className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">WIP: {totalWIP}</span>
          </div>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="p-6">
        <div className="flex items-stretch gap-2">
          {sortedStations.map((station, index) => (
            <div key={station.id} className="flex flex-1 items-center">
              {/* Station Card */}
              <div
                className={`relative flex-1 rounded-lg border-2 p-4 transition-all ${
                  station.isDowntime
                    ? 'border-amber-400 bg-amber-50'
                    : station.wipCount > 0
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Status indicator */}
                <div className="absolute -right-1 -top-1">
                  <StatusIndicator
                    status={
                      station.isDowntime
                        ? 'downtime'
                        : station.wipCount > 0
                          ? 'running'
                          : 'idle'
                    }
                    size="md"
                    pulse={station.wipCount > 0 && !station.isDowntime}
                  />
                </div>

                {/* Station name */}
                <div className="mb-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Station {station.sequenceOrder}
                  </p>
                  <h4 className="font-semibold text-gray-900">{station.name}</h4>
                </div>

                {/* Station type icon */}
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                  <StationTypeIcon type={station.stationType} />
                  <span className="capitalize">{station.stationType}</span>
                </div>

                {/* WIP Count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icons.unit className="h-4 w-4 text-gray-500" />
                    <span className="text-2xl font-bold text-gray-900">{station.wipCount}</span>
                  </div>

                  {station.isDowntime && (
                    <StationStatusBadge status="downtime" />
                  )}
                </div>

                {/* Current unit info */}
                {station.currentUnit && (
                  <div className="mt-3 rounded border border-gray-200 bg-white p-2">
                    <p className="text-xs text-gray-500">Current Unit</p>
                    <p className="font-mono text-sm font-medium">{station.currentUnit}</p>
                    {station.cycleTime !== undefined && station.estimatedTime && (
                      <div className="mt-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full transition-all ${
                              station.cycleTime > station.estimatedTime
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (station.cycleTime / station.estimatedTime) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {station.cycleTime} / {station.estimatedTime} min
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow between stations */}
              {index < sortedStations.length - 1 && (
                <div className="flex h-full items-center px-2">
                  <Icons.chevronRight className="h-6 w-6 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <StatusIndicator status="running" size="sm" pulse />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusIndicator status="idle" size="sm" />
            <span>Idle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusIndicator status="downtime" size="sm" />
            <span>Downtime</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'winding':
      return <Icons.activity className="h-4 w-4" />;
    case 'assembly':
      return <Icons.wrench className="h-4 w-4" />;
    case 'test':
      return <Icons.gauge className="h-4 w-4" />;
    case 'inspection':
      return <Icons.search className="h-4 w-4" />;
    default:
      return <Icons.station className="h-4 w-4" />;
  }
}

// Compact version for smaller displays
export function ProductionFlowCompact({ stations, className = '' }: ProductionFlowProps) {
  const sortedStations = [...stations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {sortedStations.map((station, index) => (
        <div key={station.id} className="flex items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-bold ${
              station.isDowntime
                ? 'border-amber-400 bg-amber-100 text-amber-700'
                : station.wipCount > 0
                  ? 'border-green-400 bg-green-100 text-green-700'
                  : 'border-gray-200 bg-gray-100 text-gray-500'
            }`}
            title={`${station.name}: ${station.wipCount} WIP`}
          >
            {station.wipCount}
          </div>
          {index < sortedStations.length - 1 && (
            <Icons.arrowRight className="mx-0.5 h-4 w-4 text-gray-300" />
          )}
        </div>
      ))}
    </div>
  );
}
