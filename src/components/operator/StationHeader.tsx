'use client';

import { Station, Site, User } from '@prisma/client';
import Link from 'next/link';

interface StationHeaderProps {
  station: Station & { site: Site };
  user: User;
  hasActiveDowntime: boolean;
}

export function StationHeader({ station, user, hasActiveDowntime }: StationHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-10 border-b p-4 shadow-sm ${
        hasActiveDowntime ? 'bg-yellow-400' : 'bg-white'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{station.name}</h1>
          <p className="text-sm text-gray-600">{station.site.name}</p>
        </div>

        <div className="flex items-center gap-4">
          {hasActiveDowntime && (
            <span className="animate-pulse rounded bg-yellow-600 px-3 py-1 text-sm font-bold text-white">
              DOWNTIME ACTIVE
            </span>
          )}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
