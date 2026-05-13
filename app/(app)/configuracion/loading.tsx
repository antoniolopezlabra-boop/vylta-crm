// ══════════════════════════════════════════════════════════════════════
// Loading skeleton de Configuración — Brand Kit VYLTA
// ══════════════════════════════════════════════════════════════════════

export default function ConfiguracionLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shimmer rounded-xl" />
        <div className="space-y-1.5">
          <div className="h-7 w-40 shimmer rounded" />
          <div className="h-4 w-64 shimmer rounded" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border pb-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-24 shimmer rounded" />
          ))}
        </div>
      </div>

      {/* Content card */}
      <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="mb-4 flex items-start gap-3">
          <div className="h-9 w-9 shimmer rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-48 shimmer rounded" />
            <div className="h-3 w-72 shimmer rounded" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-32 shimmer rounded" />
              <div className="h-10 shimmer rounded-lg" />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <div className="h-10 w-36 shimmer rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
