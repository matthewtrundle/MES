import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons } from '@/components/icons';

export async function DowntimeAlertBanner() {
  const activeDowntime = await prisma.downtimeInterval.findMany({
    where: { endedAt: null },
    include: { station: true, reason: true },
  });

  if (activeDowntime.length === 0) return null;

  const maxMinutes = Math.max(
    ...activeDowntime.map((dt) =>
      Math.round((Date.now() - new Date(dt.startedAt).getTime()) / 60000)
    )
  );
  const isCritical = maxMinutes >= 30;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className={`p-4 ${isCritical ? 'alert-critical' : 'alert-warning'}`}>
        <div className="flex items-start gap-3">
          <Icons.warning
            className={`mt-0.5 h-5 w-5 animate-pulse ${
              isCritical ? 'text-red-600' : 'text-amber-600'
            }`}
          />
          <div className="flex-1">
            <h3
              className={`font-semibold ${
                isCritical ? 'text-red-800' : 'text-amber-800'
              }`}
            >
              Active Downtime ({activeDowntime.length})
            </h3>
            <div className="mt-2 space-y-1">
              {activeDowntime.map((dt) => {
                const minutes = Math.round(
                  (Date.now() - new Date(dt.startedAt).getTime()) / 60000
                );
                return (
                  <div
                    key={dt.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className={
                        isCritical ? 'text-red-700' : 'text-amber-700'
                      }
                    >
                      {dt.station.name}:{' '}
                      <span className="font-medium">
                        {dt.reason?.description ?? 'Awaiting reason'}
                      </span>
                    </span>
                    <span
                      className={`text-lg font-black font-mono ${
                        isCritical ? 'text-red-800' : 'text-amber-800'
                      }`}
                    >
                      {minutes} min
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <Link
            href="/dashboard/downtime"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isCritical
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            Investigate
          </Link>
        </div>
      </div>
    </div>
  );
}
