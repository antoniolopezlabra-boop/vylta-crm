// ══════════════════════════════════════════════════════════════════════
// Loading skeleton de Clientes — Brand Kit VYLTA
// ══════════════════════════════════════════════════════════════════════

export default function ClientesLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shimmer rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-7 w-32 shimmer rounded" />
            <div className="h-4 w-48 shimmer rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 shimmer rounded-lg" />
          <div className="h-9 w-36 shimmer rounded-lg" />
        </div>
      </div>

      {/* Search + filtros */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 shimmer rounded-lg max-w-md" />
        <div className="h-10 w-32 shimmer rounded-lg" />
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        <div className="border-b border-border bg-vylta-card/40 px-5 py-3">
          <div className="flex items-center gap-4">
            <div className="h-3 w-32 shimmer rounded" />
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-3 w-28 shimmer rounded" />
            <div className="h-3 w-20 shimmer rounded" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 shimmer rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-48 shimmer rounded" />
                <div className="h-3 w-32 shimmer rounded" />
              </div>
              <div className="h-3.5 w-24 shimmer rounded" />
              <div className="h-3.5 w-20 shimmer rounded" />
              <div className="h-8 w-8 shimmer rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
