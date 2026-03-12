export default function AdminLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-40 bg-muted animate-pulse rounded" />
      <div className="h-12 bg-muted animate-pulse rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
