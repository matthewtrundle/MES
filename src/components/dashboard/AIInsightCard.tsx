'use client';

interface AIInsightCardProps {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  stationName?: string | null;
}

export function AIInsightCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id,
  title,
  description,
  severity,
  stationName,
}: AIInsightCardProps) {
  const severityConfig = {
    critical: {
      border: 'border-l-red-500',
      badge: 'bg-red-100 text-red-700',
      label: 'Critical',
    },
    warning: {
      border: 'border-l-amber-500',
      badge: 'bg-amber-100 text-amber-700',
      label: 'Warning',
    },
    info: {
      border: 'border-l-purple-500',
      badge: 'bg-purple-100 text-purple-700',
      label: 'Info',
    },
  };

  const config =
    severityConfig[severity as keyof typeof severityConfig] ??
    severityConfig.info;

  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-4 ${config.border} bg-white p-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.badge}`}
            >
              {config.label}
            </span>
            {stationName && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {stationName}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800 truncate">
            {title}
          </p>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-700 transition-colors">
          Apply
        </button>
        <button className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          Dismiss
        </button>
      </div>
    </div>
  );
}
