export default function AndonLoading() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col cursor-none select-none overflow-hidden">
      {/* Header skeleton */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-700">
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 bg-gray-700 rounded" />
          <div className="space-y-2">
            <div className="h-6 w-40 bg-gray-700 rounded" />
            <div className="h-4 w-28 bg-gray-800 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-8 animate-pulse">
          <div className="text-right space-y-2">
            <div className="h-4 w-24 bg-gray-800 rounded ml-auto" />
            <div className="h-10 w-32 bg-gray-700 rounded" />
          </div>
          <div className="w-32 h-4 bg-gray-700 rounded-full" />
        </div>

        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-3 w-3 bg-gray-700 rounded-full" />
          <div className="h-4 w-10 bg-gray-700 rounded" />
        </div>
      </header>

      {/* Station blocks skeleton */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="flex gap-6 flex-wrap justify-center animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-48 h-56 bg-gray-800 rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-3"
            >
              <div className="h-5 w-24 bg-gray-700 rounded" />
              <div className="h-16 w-16 bg-gray-700 rounded-full" />
              <div className="h-4 w-20 bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </main>

      {/* Ticker skeleton */}
      <div className="px-8 py-3 border-t border-gray-700 animate-pulse">
        <div className="h-5 w-full bg-gray-800 rounded" />
      </div>

      {/* Alert banner skeleton */}
      <div className="px-8 py-3 border-t border-gray-700 animate-pulse">
        <div className="h-6 w-64 bg-gray-800 rounded" />
      </div>
    </div>
  );
}
