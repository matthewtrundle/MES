'use client';

import { Station, Site, User } from '@prisma/client';
import Link from 'next/link';
import { Icons, StatusIndicator } from '@/components/icons';

interface StationHeaderProps {
  station: Station & { site: Site };
  user: User;
  hasActiveDowntime: boolean;
  activeUnitsCount?: number;
}

export function StationHeader({ station, user, hasActiveDowntime, activeUnitsCount = 0 }: StationHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-10 border-b shadow-md ${
        hasActiveDowntime
          ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 border-amber-600'
          : 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700 border-slate-900'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Station Info */}
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-lg ${
              hasActiveDowntime
                ? 'bg-amber-600'
                : 'bg-gradient-to-br from-blue-500 to-blue-600'
            }`}>
              {hasActiveDowntime ? (
                <Icons.warning className="h-7 w-7 text-white" />
              ) : (
                <Icons.station className="h-7 w-7 text-white" />
              )}
            </div>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${
                hasActiveDowntime ? 'text-amber-900' : 'text-white'
              }`}>
                {station.name}
              </h1>
              <p className={`text-sm font-medium ${
                hasActiveDowntime ? 'text-amber-800' : 'text-slate-300'
              }`}>
                {station.site.name}
              </p>
            </div>
          </div>

          {/* Center: Status */}
          <div className="flex items-center gap-6">
            {hasActiveDowntime ? (
              <div className="flex items-center gap-3 rounded-lg bg-amber-600 px-4 py-2 shadow-lg">
                <StatusIndicator status="downtime" size="lg" pulse />
                <span className="text-lg font-bold text-white uppercase tracking-wide">
                  Downtime Active
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-slate-600/50 px-4 py-2">
                  <StatusIndicator status={activeUnitsCount > 0 ? 'running' : 'idle'} size="md" pulse={activeUnitsCount > 0} />
                  <span className="text-white font-medium">
                    {activeUnitsCount > 0 ? 'Active' : 'Ready'}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-600/50 px-4 py-2">
                  <Icons.unit className="h-5 w-5 text-blue-400" />
                  <span className="text-2xl font-bold text-white">{activeUnitsCount}</span>
                  <span className="text-slate-300 text-sm">units</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: User Info */}
          <div className={`flex items-center gap-3 rounded-lg px-4 py-2 ${
            hasActiveDowntime ? 'bg-amber-500/50' : 'bg-slate-600/50'
          }`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              hasActiveDowntime ? 'bg-amber-600' : 'bg-slate-500'
            }`}>
              <Icons.users className={`h-5 w-5 ${hasActiveDowntime ? 'text-amber-100' : 'text-slate-200'}`} />
            </div>
            <div className="text-right">
              <p className={`font-semibold ${hasActiveDowntime ? 'text-amber-900' : 'text-white'}`}>
                {user.name}
              </p>
              <p className={`text-xs uppercase tracking-wide ${
                hasActiveDowntime ? 'text-amber-700' : 'text-slate-400'
              }`}>
                {user.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
