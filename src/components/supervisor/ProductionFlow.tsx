'use client';

import Link from 'next/link';
import { Icons, StatusIndicator, StationStatusBadge } from '@/components/icons';

interface UnitAtStation {
  serialNumber: string;
  cycleTime: number;
  estimatedTime?: number;
  operatorName?: string;
}

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
  lastActivity?: Date | null;
  // Enhanced data
  allUnits?: UnitAtStation[];
  throughputPerHour?: number;
}

function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return 'No activity';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface ProductionFlowProps {
  stations: StationData[];
  className?: string;
  uptimePercent?: number;
  avgCycleTime?: number;
  bottleneckStationId?: string | null;
  bottleneckStationName?: string | null;
}

export function ProductionFlow({ stations, className = '', uptimePercent, avgCycleTime, bottleneckStationId, bottleneckStationName }: ProductionFlowProps) {
  const sortedStations = [...stations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const totalWIP = stations.reduce((sum, s) => sum + s.wipCount, 0);
  const activeStations = stations.filter((s) => s.wipCount > 0 && !s.isDowntime).length;
  const downtimeStations = stations.filter((s) => s.isDowntime).length;

  return (
    <div className={`industrial-card industrial-texture ${className}`}>
      {/* Header with industrial gradient */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-3 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 shadow-sm">
            <Icons.activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 tracking-tight">Production Flow</h3>
            <p className="text-xs text-slate-500">Manufacturing Line Status</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {/* Bottleneck Indicator - Critical for demo "aha" moment */}
          {bottleneckStationName && (
            <div className="metric-badge bg-red-50 border border-red-300 animate-pulse">
              <Icons.warning className="h-4 w-4 text-red-600" />
              <span className="ml-1.5 text-red-700 font-semibold text-xs">Constraint:</span>
              <span className="ml-1 text-red-800 font-bold">{bottleneckStationName}</span>
            </div>
          )}
          {uptimePercent !== undefined && (
            <div className={`metric-badge ${uptimePercent >= 90 ? 'bg-green-50 border border-green-200' : uptimePercent >= 70 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
              <Icons.timer className="h-4 w-4 text-slate-600" />
              <span className={`ml-1.5 font-semibold ${uptimePercent >= 90 ? 'text-green-700' : uptimePercent >= 70 ? 'text-amber-700' : 'text-red-700'}`}>{uptimePercent}%</span>
              <span className="ml-1 text-xs text-slate-500">Uptime</span>
            </div>
          )}
          <div className="metric-badge bg-green-50 border border-green-200">
            <StatusIndicator status="running" size="sm" />
            <span className="ml-1.5 text-green-700 font-medium">{activeStations}</span>
            <span className="ml-1 text-xs text-slate-500">Active</span>
          </div>
          {downtimeStations > 0 && (
            <div className="metric-badge bg-amber-50 border border-amber-200">
              <StatusIndicator status="downtime" size="sm" />
              <span className="ml-1.5 text-amber-700 font-medium">{downtimeStations}</span>
              <span className="ml-1 text-xs text-slate-500">Down</span>
            </div>
          )}
          <div className="metric-badge bg-slate-100 border border-slate-200">
            <Icons.unit className="h-4 w-4 text-slate-600" />
            <span className="ml-1.5 text-slate-700 font-medium">{totalWIP}</span>
            <span className="ml-1 text-xs text-slate-500">WIP</span>
          </div>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="p-4">
        <div className="flex items-stretch gap-1.5">
          {sortedStations.map((station, index) => (
            <div key={station.id} className="flex flex-1 items-stretch min-w-0">
              {/* Station Card - Compact version */}
              <Link
                href={`/dashboard/station/${station.id}`}
                className={`relative flex-1 min-h-[140px] rounded-lg p-3 transition-all cursor-pointer hover:scale-[1.01] ${
                  station.id === bottleneckStationId
                    ? 'ring-2 ring-red-400 ring-offset-1 bg-red-50 border-red-300 shadow-lg'
                    : station.isDowntime
                      ? 'station-downtime hover:border-amber-500'
                      : station.wipCount > 0
                        ? 'station-active hover:border-green-500'
                        : 'station-idle hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                {/* Constraint badge on bottleneck station */}
                {station.id === bottleneckStationId && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide shadow-md">
                      <Icons.warning className="h-2.5 w-2.5" />
                      Constraint
                    </span>
                  </div>
                )}
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
                    size="sm"
                    pulse={station.wipCount > 0 && !station.isDowntime}
                  />
                </div>

                {/* Station name - compact */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 flex-shrink-0">
                      {station.sequenceOrder}
                    </span>
                    <h4 className="font-semibold text-gray-900 text-sm truncate">{station.name}</h4>
                  </div>
                </div>

                {/* Last activity - simplified */}
                <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-500">
                  <Icons.clock className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{formatTimeAgo(station.lastActivity)}</span>
                </div>

                {/* WIP Count - compact */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icons.unit className="h-4 w-4 text-slate-500" />
                    <div>
                      <span className="text-xl font-bold text-slate-900">{station.wipCount}</span>
                      <span className="text-[9px] uppercase tracking-wide text-slate-500 font-medium ml-1">units</span>
                    </div>
                  </div>
                </div>

                {/* Operator or status badge */}
                <div className="mt-auto">
                  {station.isDowntime ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      <Icons.warning className="h-3 w-3" />
                      Down
                    </span>
                  ) : station.activeOperator ? (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 truncate">
                      <Icons.users className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium truncate">{station.activeOperator}</span>
                    </div>
                  ) : null}
                </div>

                {/* Active unit display - simplified for space */}
                {station.allUnits && station.allUnits.length > 0 ? (
                  <div className="mt-1 space-y-1 border-t border-gray-100 pt-1">
                    {station.allUnits.slice(0, 2).map((unit, unitIndex) => (
                      <div key={unit.serialNumber} className="flex items-center gap-1.5 text-[10px]">
                        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${unitIndex === 0 ? 'bg-green-500 live-indicator' : 'bg-gray-300'}`} />
                        <span className="font-mono font-medium text-slate-700 truncate">{unit.serialNumber}</span>
                        <span className="text-slate-400 ml-auto">{unit.cycleTime}m</span>
                      </div>
                    ))}
                    {station.allUnits.length > 2 && (
                      <p className="text-[9px] text-slate-400">+{station.allUnits.length - 2} more</p>
                    )}
                  </div>
                ) : station.currentUnit ? (
                  <div className="mt-1 border-t border-gray-100 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 live-indicator flex-shrink-0" />
                      <span className="font-mono font-medium text-slate-700 truncate">{station.currentUnit}</span>
                      {station.cycleTime !== undefined && (
                        <span className="text-slate-400 ml-auto">{station.cycleTime}m</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </Link>

              {/* Flow arrow - minimal */}
              {index < sortedStations.length - 1 && (
                <div className="flex items-center">
                  <Icons.chevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
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
