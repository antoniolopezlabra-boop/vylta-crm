// ══════════════════════════════════════════════════════════════════════
// Loading skeleton de Reportes — Brand Kit VYLTA
// ══════════════════════════════════════════════════════════════════════

export default function ReportesLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shimmer rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-7 w-32 shimmer rounded" />
            <div className="h-4 w-56 shimmer rounded" />
          </div>
        </div>
        <div className="h-9 w-40 shimmer rounded-lg" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-vylta-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-16 shimmer rounded" />
              <div className="h-8 w-8 shimmer rounded-lg" />
            </div>
            <div className="mt-3 h-9 w-24 shimmer rounded-lg" />
            <div className="mt-1 h-3 w-20 shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Charts placeholders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="h-4 w-40 shimmer rounded" />
              <div className="h-3 w-24 shimmer rounded" />
            </div>
            <div className="h-64 shimmer rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
