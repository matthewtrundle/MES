'use client';

import { DowntimeInterval, DowntimeReason, Station, User } from '@prisma/client';

type IntervalWithDetails = DowntimeInterval & {
  reason: DowntimeReason | null;
  station: Station;
  operator: User;
};

interface DowntimeTableProps {
  intervals: IntervalWithDetails[];
}

export function DowntimeTable({ intervals }: DowntimeTableProps) {
  if (intervals.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        No downtime events recorded
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Date/Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Station
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Reason
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Operator
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {intervals.map((interval) => {
            const duration =
              interval.endedAt
                ? Math.round(
                    (new Date(interval.endedAt).getTime() -
                      new Date(interval.startedAt).getTime()) /
                      60000
                  )
                : null;

            return (
              <tr key={interval.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <div>
                    {new Date(interval.startedAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(interval.startedAt).toLocaleTimeString()}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                  {interval.station.name}
                </td>
                <td className="px-4 py-3 text-sm">
                  {interval.reason ? (
                    <div>
                      <span className="font-medium">
                        {interval.reason.code}
                      </span>
                      <p className="text-xs text-gray-500">
                        {interval.reason.description}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400">No reason</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {interval.reason && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        interval.reason.isPlanned
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {interval.reason.isPlanned ? 'Planned' : 'Unplanned'}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                  {duration !== null ? (
                    `${duration} min`
                  ) : (
                    <span className="text-yellow-600">Active</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {interval.operator.name}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
