import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Icons, UnitStatusBadge } from '@/components/icons';

export async function RecentUnitsSection() {
  const recentUnits = await prisma.unit.findMany({
    take: 15,
    orderBy: { updatedAt: 'desc' },
    include: {
      workOrder: true,
      executions: {
        where: { completedAt: null },
        include: { operator: true, operation: true, station: true },
        take: 1,
      },
    },
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icons.unit className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Recent Units</h3>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/traceability" className="text-sm text-blue-600 hover:underline">
            Search All
          </Link>
          <Link
            href="/station"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Icons.scan className="h-4 w-4" />
            Operator View
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        {recentUnits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Icons.unit className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No units in progress</p>
            <p className="text-xs text-gray-400">Release a work order to begin production</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">Serial</th>
                <th className="px-4 py-2.5 text-left font-semibold">Station</th>
                <th className="px-4 py-2.5 text-left font-semibold">Operator</th>
                <th className="px-4 py-2.5 text-right font-semibold">Time</th>
                <th className="px-4 py-2.5 text-center font-semibold">Progress</th>
                <th className="px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentUnits.map((unit) => {
                const activeExecution = unit.executions?.[0];
                const cycleTime = activeExecution
                  ? Math.round((Date.now() - new Date(activeExecution.startedAt).getTime()) / 60000)
                  : null;
                const estimatedTime = activeExecution?.operation?.estimatedMinutes;
                const progressPercent = cycleTime && estimatedTime
                  ? Math.min(100, (cycleTime / estimatedTime) * 100)
                  : null;
                const isOverTime = cycleTime && estimatedTime && cycleTime > estimatedTime;

                return (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/traceability?serial=${unit.serialNumber}`}
                        className="font-mono font-medium text-blue-600 hover:underline"
                      >
                        {unit.serialNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activeExecution?.station?.name ?? (unit.status === 'completed' ? 'Completed' : '—')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activeExecution?.operator?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cycleTime !== null ? (
                        <span className={`font-mono text-sm ${isOverTime ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                          {cycleTime}m
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {progressPercent !== null ? (
                        <div className="mx-auto w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full transition-all ${isOverTime ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UnitStatusBadge status={unit.status as 'created' | 'in_progress' | 'completed' | 'scrapped' | 'rework'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
