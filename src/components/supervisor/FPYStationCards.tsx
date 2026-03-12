'use client';

interface StationFPYData {
  stationId: string;
  stationName: string;
  stationType: string;
  sequenceOrder: number;
  fpy: number;
  totalAttempted: number;
  firstPassCount: number;
}

interface FPYStationCardsProps {
  stations: StationFPYData[];
}

function getFPYColor(fpy: number): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  label: string;
} {
  if (fpy >= 95) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      bar: 'bg-green-500',
      label: 'Excellent',
    };
  }
  if (fpy >= 90) {
    return {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      bar: 'bg-amber-500',
      label: 'Needs Attention',
    };
  }
  return {
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    bar: 'bg-red-500',
    label: 'Critical',
  };
}

export function FPYStationCards({ stations }: FPYStationCardsProps) {
  if (stations.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No station data available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stations.map((station) => {
        const colors = getFPYColor(station.fpy);
        const reworkCount = station.totalAttempted - station.firstPassCount;

        return (
          <div
            key={station.stationId}
            className={`rounded-lg border p-4 ${colors.border} ${colors.bg}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900">{station.stationName}</p>
                <p className="text-xs text-gray-500 capitalize">{station.stationType}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${colors.text}`}>
                  {station.fpy}%
                </p>
                <p className={`text-xs font-medium ${colors.text}`}>{colors.label}</p>
              </div>
            </div>

            {/* FPY bar */}
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 mb-2">
              <div
                className={`h-full transition-all ${colors.bar}`}
                style={{ width: `${Math.min(100, station.fpy)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{station.firstPassCount} first pass</span>
              <span>{reworkCount > 0 ? `${reworkCount} rework/fail` : 'No rework'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
