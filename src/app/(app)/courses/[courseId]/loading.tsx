export default function CourseLoading() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="mb-5 h-28 rounded-xl bg-surface-sunken" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Nav */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-surface-sunken" />
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="h-32 rounded-xl bg-surface-sunken" />
          <div className="h-24 rounded-xl bg-surface-sunken" />
          <div className="h-24 rounded-xl bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}
