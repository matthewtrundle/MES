'use client';

import { Icons } from '@/components/icons';

interface EventData {
  id: string;
  eventType: string;
  createdAt: Date;
  stationId: string | null;
  unitId: string | null;
  operatorId: string | null;
  payload: Record<string, unknown>;
  station?: { name: string } | null;
  unit?: { serialNumber: string } | null;
  operator?: { name: string } | null;
}

interface EventStreamProps {
  events: EventData[];
  className?: string;
}

// Event type configurations for styling
const eventConfig: Record<string, {
  icon: keyof typeof Icons;
  color: string;
  bgColor: string;
  label: string;
}> = {
  operation_started: {
    icon: 'station',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Operation Started',
  },
  operation_completed: {
    icon: 'pass',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Operation Completed',
  },
  operation_failed: {
    icon: 'qualityFail',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Operation Failed',
  },
  quality_check_recorded: {
    icon: 'gauge',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Quality Check',
  },
  downtime_started: {
    icon: 'clock',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Downtime Started',
  },
  downtime_ended: {
    icon: 'clock',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Downtime Ended',
  },
  downtime_reason_selected: {
    icon: 'warning',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Downtime Reason',
  },
  ncr_created: {
    icon: 'qualityFail',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'NCR Created',
  },
  ncr_dispositioned: {
    icon: 'pass',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'NCR Dispositioned',
  },
  unit_created: {
    icon: 'unit',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Unit Created',
  },
  unit_serial_assigned: {
    icon: 'unit',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Serial Assigned',
  },
  work_order_released: {
    icon: 'station',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Work Order Released',
  },
  material_lot_consumed: {
    icon: 'chart',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Material Consumed',
  },
  scrap_recorded: {
    icon: 'qualityFail',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Scrap Recorded',
  },
  rework_created: {
    icon: 'warning',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Rework Started',
  },
  rework_completed: {
    icon: 'pass',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Rework Completed',
  },
};

const defaultConfig = {
  icon: 'station' as keyof typeof Icons,
  color: 'text-gray-600',
  bgColor: 'bg-gray-100',
  label: 'Event',
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

function EventCard({ event, isNew }: { event: EventData; isNew?: boolean }) {
  const config = eventConfig[event.eventType] ?? defaultConfig;
  const IconComponent = Icons[config.icon];

  // Extract details from payload
  const details: string[] = [];
  if (event.unit?.serialNumber) {
    details.push(`Unit: ${event.unit.serialNumber}`);
  }
  if (event.station?.name) {
    details.push(`Station: ${event.station.name}`);
  }
  if (event.operator?.name) {
    details.push(`By: ${event.operator.name}`);
  }

  // Add payload-specific details
  const payload = event.payload as Record<string, unknown>;
  if (payload.result) {
    details.push(`Result: ${payload.result}`);
  }
  if (payload.reason) {
    details.push(`Reason: ${payload.reason}`);
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-all ${
        isNew ? 'animate-slide-in border-blue-300 shadow-md' : ''
      }`}
    >
      <div className={`rounded-lg p-2 ${config.bgColor}`}>
        <IconComponent className={`h-5 w-5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium ${config.color}`}>{config.label}</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>
        {details.length > 0 && (
          <p className="mt-1 text-sm text-gray-600 truncate">
            {details.join(' • ')}
          </p>
        )}
        <p className="mt-0.5 text-xs text-gray-400 font-mono">
          {new Date(event.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

export function EventStream({ events, className = '' }: EventStreamProps) {
  if (events.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Icons.clock className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">No events recorded yet</p>
        <p className="text-sm text-gray-400">Start the simulation to see activity</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {events.map((event, index) => (
        <EventCard
          key={event.id}
          event={event}
          isNew={index === 0}
        />
      ))}
    </div>
  );
}

// Timeline view component for unit journey
interface TimelineEvent {
  id: string;
  eventType: string;
  createdAt: Date;
  stationName?: string;
}

interface EventTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function EventTimeline({ events, className = '' }: EventTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {events.map((event, index) => {
          const config = eventConfig[event.eventType] ?? defaultConfig;
          const IconComponent = Icons[config.icon];
          const isFirst = index === 0;
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="relative flex items-start gap-4 pl-10">
              {/* Timeline dot */}
              <div
                className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow-sm ${config.bgColor} flex items-center justify-center`}
              >
                <IconComponent className={`h-3 w-3 ${config.color}`} />
              </div>

              <div className={`flex-1 ${isFirst ? 'font-medium' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {event.stationName && (
                  <p className="text-xs text-gray-500">{event.stationName}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
