export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header skeleton */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-200 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-24 bg-slate-100 animate-pulse rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-full" />
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs skeleton */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-20 bg-slate-100 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* KPI grid skeleton */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="h-3 w-16 bg-slate-100 animate-pulse rounded" />
              <div className="h-6 w-12 bg-slate-200 animate-pulse rounded" />
              <div className="h-2 w-20 bg-slate-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column layout skeleton */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-5">
            {/* Production flow */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-4 w-28 bg-slate-200 animate-pulse rounded mb-3" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 w-32 shrink-0 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
            {/* Units table */}
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-4 space-y-5">
            {/* Shift summary */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
                  <div className="h-3 w-10 bg-slate-200 animate-pulse rounded" />
                </div>
              ))}
            </div>
            {/* Quick actions */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-4 w-20 bg-slate-200 animate-pulse rounded mb-3" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
