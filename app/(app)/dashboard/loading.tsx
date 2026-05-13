// ══════════════════════════════════════════════════════════════════════
// Loading skeleton del Dashboard — Brand Kit VYLTA
//
// Next.js renderiza este componente AUTOMÁTICAMENTE mientras page.tsx
// está cargando datos del server. Esto hace que la pantalla 'cambie'
// al instante en vez de quedarse congelada en la ruta anterior.
//
// La estructura espeja al dashboard real para que la transición se
// sienta natural (no se desplazan elementos cuando los datos llegan).
// ══════════════════════════════════════════════════════════════════════

export default function DashboardLoading() {
  return (
    <div className="space-y-7 animate-fade-in">
      {/* Hero card skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-vylta-surface shadow-card-lg">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-vylta-green/10 blur-[100px]" />
        </div>
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div className="space-y-3 flex-1">
            <div className="h-3 w-32 shimmer rounded" />
            <div className="h-9 w-64 shimmer rounded-lg" />
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="h-5 w-24 shimmer rounded" />
              <div className="h-5 w-32 shimmer rounded" />
              <div className="h-5 w-28 shimmer rounded" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="h-9 w-24 shimmer rounded-lg" />
            <div className="h-9 w-28 shimmer rounded-lg" />
          </div>
        </div>
      </div>

      {/* Section: HOY */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-12 shimmer rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Section: ESTA SEMANA */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-20 shimmer rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Grid principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
        <aside className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </aside>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-16 shimmer rounded" />
        <div className="h-8 w-8 shimmer rounded-lg" />
      </div>
      <div className="mt-3 h-9 w-20 shimmer rounded-lg" />
      <div className="mt-1 h-3 w-24 shimmer rounded" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-vylta-card/40 px-5 py-3">
        <div className="h-3.5 w-32 shimmer rounded" />
        <div className="h-3 w-24 shimmer rounded" />
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-12 w-14 shimmer rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 shimmer rounded" />
              <div className="h-3 w-32 shimmer rounded" />
            </div>
            <div className="h-4 w-16 shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-7 w-7 shimmer rounded-lg" />
        <div className="h-3.5 w-32 shimmer rounded" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 shimmer rounded" />
              <div className="h-2.5 w-1/2 shimmer rounded" />
            </div>
            <div className="h-8 w-8 shimmer rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
