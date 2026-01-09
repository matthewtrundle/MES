'use client';

import { Icons } from '@/components/icons';

interface DowntimeInfo {
  id: string;
  station: { name: string };
  reason?: { description: string } | null;
  startedAt: Date;
}

interface AlertBannerProps {
  activeDowntime: DowntimeInfo[];
  openNCRs: number;
}

export function AlertBanner({ activeDowntime, openNCRs }: AlertBannerProps) {
  const hasDowntime = activeDowntime.length > 0;
  const hasNCRs = openNCRs > 0;
  const hasIssues = hasDowntime || hasNCRs;

  // Calculate total downtime minutes
  const downtimeMinutes = activeDowntime.reduce((sum, dt) => {
    return sum + Math.round((Date.now() - new Date(dt.startedAt).getTime()) / 60000);
  }, 0);

  if (!hasIssues) {
    // All Clear - Green Banner
    return (
      <div className="bg-green-900/50 border-t-4 border-green-500 px-8 py-4">
        <div className="flex items-center justify-center gap-4">
          <Icons.pass className="h-8 w-8 text-green-400" />
          <span className="text-2xl font-bold text-green-400 uppercase tracking-wider">
            All Systems Operational
          </span>
          <Icons.pass className="h-8 w-8 text-green-400" />
        </div>
      </div>
    );
  }

  // Critical - Downtime (Red Flashing)
  if (hasDowntime) {
    return (
      <div className="bg-red-900/70 border-t-4 border-red-500 px-8 py-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icons.warning className="h-10 w-10 text-red-400" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                  {activeDowntime.length}
                </span>
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-black text-red-400 uppercase tracking-wider">
                Active Downtime
              </h3>
              <p className="text-lg text-red-300">
                {activeDowntime.map((dt) => dt.station.name).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            {/* Downtime details */}
            <div className="text-right">
              {activeDowntime.map((dt) => {
                const minutes = Math.round((Date.now() - new Date(dt.startedAt).getTime()) / 60000);
                return (
                  <div key={dt.id} className="text-red-300">
                    <span className="font-semibold">{dt.station.name}:</span>{' '}
                    <span className="font-mono font-bold text-red-400">{minutes} min</span>
                    {dt.reason && (
                      <span className="text-red-400/70"> - {dt.reason.description}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total downtime */}
            <div className="text-center bg-red-800/50 rounded-lg px-6 py-2">
              <p className="text-sm text-red-300 uppercase tracking-wider">Total Downtime</p>
              <p className="text-4xl font-black text-red-400">{downtimeMinutes}</p>
              <p className="text-sm text-red-300">minutes</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Warning - NCRs Only (Amber)
  return (
    <div className="bg-amber-900/50 border-t-4 border-amber-500 px-8 py-4">
      <div className="flex items-center justify-center gap-6">
        <Icons.qualityFail className="h-8 w-8 text-amber-400" />
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-amber-400 uppercase tracking-wider">
            Quality Alert
          </span>
          <span className="text-xl text-amber-300">
            {openNCRs} Open NCR{openNCRs !== 1 ? 's' : ''} Require Attention
          </span>
        </div>
        <Icons.qualityFail className="h-8 w-8 text-amber-400" />
      </div>
    </div>
  );
}
