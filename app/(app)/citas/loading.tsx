// ══════════════════════════════════════════════════════════════════════
// Loading skeleton de Citas — Brand Kit VYLTA
// ══════════════════════════════════════════════════════════════════════

export default function CitasLoading() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shimmer rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-7 w-24 shimmer rounded" />
            <div className="h-4 w-40 shimmer rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 shimmer rounded-xl" />
          <div className="h-9 w-28 shimmer rounded-lg" />
        </div>
      </div>

      {/* Filtros staff */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-vylta-surface px-2 py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-7 w-20 shimmer rounded-full" />
        ))}
      </div>

      {/* Calendario */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        {/* Header de días */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-vylta-card/30">
          <div className="border-r border-border" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 border-r border-border py-3 last:border-r-0"
            >
              <div className="h-2.5 w-8 shimmer rounded" />
              <div className="h-8 w-8 shimmer rounded-full" />
            </div>
          ))}
        </div>

        {/* Grid de horas vacío */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 shimmer rounded-full" />
            <div className="h-3 w-32 shimmer rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
