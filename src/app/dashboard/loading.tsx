export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header skeleton */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-44 bg-gray-200 animate-pulse rounded" />
                <div className="h-3 w-32 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
              <div className="h-8 w-20 bg-gray-100 animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
      </header>

      {/* Work order hero skeleton */}
      <div className="border-b border-blue-100 bg-blue-50/50">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 rounded-xl bg-blue-100 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-20 bg-blue-100 animate-pulse rounded" />
              <div className="h-7 w-36 bg-blue-200 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* KPI grid skeleton - 6 cards matching actual layout */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
              <div className="h-3 w-24 bg-gray-100 animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Production flow skeleton */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 w-40 shrink-0 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Bottom section skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
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
        </div>
      </main>
    </div>
  );
}
