export function WorkOrderBarSkeleton() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 bg-slate-100 animate-pulse rounded" />
            <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 bg-slate-100 animate-pulse rounded" />
            <div className="h-2 w-32 bg-slate-100 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* lg card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3 lg:col-span-2">
          <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 w-20 bg-gray-200 animate-pulse rounded" />
          <div className="h-3 w-24 bg-gray-100 animate-pulse rounded" />
        </div>
        {/* md cards */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`md-${i}`} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 lg:col-span-2">
            <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
            <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            <div className="h-3 w-24 bg-gray-100 animate-pulse rounded" />
          </div>
        ))}
        {/* sm cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`sm-${i}`} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-100 animate-pulse rounded-lg" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 bg-gray-100 animate-pulse rounded" />
                <div className="h-6 w-12 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductionFlowSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="h-5 w-32 bg-gray-200 animate-pulse rounded mb-4" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 w-44 shrink-0 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function AIRecommendationsSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <div className="h-4 w-36 bg-purple-100 animate-pulse rounded" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 border-l-4 border-l-purple-300 p-3 space-y-2">
            <div className="h-3 w-16 bg-purple-100 animate-pulse rounded-full" />
            <div className="h-4 w-full bg-gray-100 animate-pulse rounded" />
            <div className="h-3 w-3/4 bg-gray-100 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertsSidebarSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-gray-200 p-2.5">
            <div className="h-7 w-7 bg-gray-100 animate-pulse rounded-md" />
            <div className="flex-1 space-y-1">
              <div className="h-3.5 w-20 bg-gray-100 animate-pulse rounded" />
              <div className="h-2.5 w-16 bg-gray-100 animate-pulse rounded" />
            </div>
            <div className="h-5 w-6 bg-gray-200 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChartsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
            <div className="h-7 w-12 bg-gray-200 animate-pulse rounded" />
            <div className="h-10 w-full bg-gray-50 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentUnitsSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="h-5 w-28 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}

export function ShiftSummarySkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="h-5 w-28 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-24 bg-gray-100 animate-pulse rounded" />
            <div className="h-4 w-12 bg-gray-200 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
