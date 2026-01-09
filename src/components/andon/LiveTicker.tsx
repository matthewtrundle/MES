'use client';

import { Icons } from '@/components/icons';

interface EventInfo {
  id: string;
  eventType: string;
  createdAt: Date;
  station?: { name: string } | null;
  unit?: { serialNumber: string } | null;
  payload: unknown;
}

interface LiveTickerProps {
  events: EventInfo[];
}

function formatEventMessage(event: EventInfo): string {
  const stationName = event.station?.name ?? 'Unknown';
  const serialNumber = event.unit?.serialNumber ?? '';

  switch (event.eventType) {
    case 'operation_completed':
      return `${serialNumber} completed at ${stationName}`;
    case 'operation_started':
      return `${serialNumber} started at ${stationName}`;
    case 'unit_created':
      return `New unit ${serialNumber} created`;
    case 'downtime_started':
      return `Downtime started at ${stationName}`;
    case 'downtime_ended':
      return `Downtime ended at ${stationName}`;
    case 'quality_check_recorded':
      return `Quality check at ${stationName}`;
    case 'ncr_created':
      return `NCR created for ${serialNumber}`;
    default:
      return `${event.eventType.replace(/_/g, ' ')}`;
  }
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'operation_completed':
      return <Icons.pass className="h-4 w-4 text-green-400" />;
    case 'operation_started':
      return <Icons.running className="h-4 w-4 text-blue-400" />;
    case 'unit_created':
      return <Icons.unit className="h-4 w-4 text-purple-400" />;
    case 'downtime_started':
      return <Icons.warning className="h-4 w-4 text-red-400" />;
    case 'downtime_ended':
      return <Icons.pass className="h-4 w-4 text-green-400" />;
    case 'quality_check_recorded':
      return <Icons.gauge className="h-4 w-4 text-blue-400" />;
    case 'ncr_created':
      return <Icons.qualityFail className="h-4 w-4 text-amber-400" />;
    default:
      return <Icons.activity className="h-4 w-4 text-gray-400" />;
  }
}

export function LiveTicker({ events }: LiveTickerProps) {
  if (events.length === 0) {
    return null;
  }

  // Double the events for seamless looping
  const tickerItems = [...events, ...events];

  return (
    <div className="bg-gray-800 border-y border-gray-700 overflow-hidden">
      <div className="flex items-center">
        {/* Fixed label */}
        <div className="flex-shrink-0 bg-gray-700 px-4 py-2 flex items-center gap-2 border-r border-gray-600 z-10">
          <Icons.activity className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Live Feed
          </span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker flex items-center gap-8 whitespace-nowrap py-2 px-4">
            {tickerItems.map((event, index) => (
              <div
                key={`${event.id}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                {getEventIcon(event.eventType)}
                <span className="text-gray-300">{formatEventMessage(event)}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </span>
                <span className="text-gray-600 mx-4">|</span>
              </div>
            ))}
          </div>
        </div>

        {/* Clock */}
        <div className="flex-shrink-0 bg-gray-700 px-4 py-2 flex items-center gap-2 border-l border-gray-600 z-10">
          <Icons.clock className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-sm text-gray-300">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
