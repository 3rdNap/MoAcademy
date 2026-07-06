/** Instant skeleton while the dashboard's server data loads. */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-surface-sunken" />
      <div className="mt-2 h-4 w-80 rounded bg-surface-sunken" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-sunken" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
