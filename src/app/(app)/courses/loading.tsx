/** Instant skeleton while the course list loads. */
export default function CoursesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-sunken" />
      <div className="mt-2 h-4 w-72 rounded bg-surface-sunken" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
