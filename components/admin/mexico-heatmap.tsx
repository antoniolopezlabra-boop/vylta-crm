'use client';

import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { MapPin, Search, Maximize2, X, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// MexicoHeatmap (v7 — Auto-refresh via TanStack Query polling, May 23 2026)
//
// CAMBIOS EN v7:
//   • Removida la subscripcion de Supabase Realtime a business_profiles.
//   • Razon: el WAL polling de Realtime consumia ~557K queries en 24h y
//     estaba saturando el Disk IO Budget del plan Free de Supabase.
//   • El dashboard ahora usa polling cada 60s via TanStack Query
//     (refetchInterval en useAdminDashboard). Tradeoff: hasta 60s de
//     delay para ver un nuevo registro/eliminacion, pero cero consumo
//     de WAL.
//   • Removidos: pulses dorado/rojo, toasts "✨ Nuevo negocio en X",
//     contadores addedCount/removedCount, prop onNewBusiness.
//   • Mantenido: TODO el render visual del mapa, top 5, leyenda, expand.
//   • Cambiado indicador del header: "Tiempo real" → "Auto-refresh 60s"
//     para reflejar la realidad sin engañar al admin.
//
// HISTORIAL DE VERSIONES:
//   • v6 (May 23 2026): INSERT + UPDATE + DELETE realtime con pulses
//     diferenciados (dorado/rojo) y toasts personalizados. DEPRECATED.
//   • v5 (May 22 2026): INSERT + UPDATE realtime. DEPRECATED.
// ═══════════════════════════════════════════════════════════════════════

const MEXICO_TOPO_JSON = 'https://raw.githubusercontent.com/strotgen/mexico-leaflet/master/states.geojson';

const NAME_MAP: Record<string, string> = {
  'México':                          'Estado de México',
  'Distrito Federal':                'Ciudad de México',
  'Coahuila de Zaragoza':            'Coahuila',
  'Michoacán de Ocampo':             'Michoacán',
  'Veracruz de Ignacio de la Llave': 'Veracruz',
};

function normalizeStateName(name: string): string {
  return NAME_MAP[name] || name;
}

export interface StateDataPoint {
  state: string;
  total_businesses: number;
  new_last_30d: number;
  new_last_7d: number;
}

interface MexicoHeatmapProps {
  data: StateDataPoint[];
  onStateClick?: (stateName: string) => void;
  /**
   * @deprecated v7 (May 23 2026): removida la suscripcion realtime.
   * El refresh ahora viene de TanStack Query polling cada 60s.
   * Se mantiene el prop como no-op para compatibilidad con app/admin/page.tsx
   * mientras se hace el cleanup ahi.
   */
  onNewBusiness?: () => void;
}

// Esquema semaforizado solicitado por Antonio: gris/verde/amarillo/naranja/rojo
function getHeatColor(count: number): {
  fill: string;
  stroke: string;
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  glow: boolean;
} {
  if (count === 0) {
    return { fill: '#1F2937', stroke: '#374151', level: 0, label: 'Sin presencia', glow: false };
  }
  if (count <= 5) {
    return { fill: '#10B981', stroke: '#34D399', level: 1, label: 'Primeros (1-5)', glow: false };
  }
  if (count <= 15) {
    return { fill: '#F59E0B', stroke: '#FBBF24', level: 2, label: 'Crecimiento (6-15)', glow: true };
  }
  if (count <= 50) {
    return { fill: '#F97316', stroke: '#FB923C', level: 3, label: 'Carga alta (16-50)', glow: true };
  }
  return { fill: '#EF4444', stroke: '#F87171', level: 4, label: 'Saturado (50+)', glow: true };
}

const LEGEND: { label: string; color: string; glow: boolean; range: string }[] = [
  { label: 'Saturado',      color: '#EF4444', glow: true,  range: '50+' },
  { label: 'Carga alta',    color: '#F97316', glow: true,  range: '16-50' },
  { label: 'Crecimiento',   color: '#F59E0B', glow: true,  range: '6-15' },
  { label: 'Primeros',      color: '#10B981', glow: false, range: '1-5' },
  { label: 'Sin presencia', color: '#1F2937', glow: false, range: '0' },
];

export function MexicoHeatmap({ data, onStateClick }: MexicoHeatmapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const dataByState = useMemo(() => {
    const map = new Map<string, StateDataPoint>();
    data.forEach(d => map.set(d.state, d));
    return map;
  }, [data]);

  const totalNationwide = useMemo(
    () => data.reduce((sum, d) => sum + d.total_businesses, 0),
    [data]
  );

  const top5 = useMemo(
    () => [...data].sort((a, b) => b.total_businesses - a.total_businesses).slice(0, 5),
    [data]
  );

  // ESC para cerrar modal
  useEffect(() => {
    if (!isExpanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const hoveredData = hoveredState ? dataByState.get(hoveredState) : null;

  return (
    <>
      <MapContent
        isExpanded={false}
        data={data}
        dataByState={dataByState}
        totalNationwide={totalNationwide}
        top5={top5}
        hoveredState={hoveredState}
        setHoveredState={setHoveredState}
        mousePos={mousePos}
        setMousePos={setMousePos}
        hoveredData={hoveredData}
        onStateClick={onStateClick}
        onExpand={() => setIsExpanded(true)}
      />

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-[1400px] w-full max-h-[95vh] overflow-y-auto rounded-2xl border border-vylta-gold/30 bg-vylta-admin-bg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-vylta-card/80 text-vylta-muted transition hover:border-vylta-rose/40 hover:bg-vylta-rose/10 hover:text-vylta-rose"
              title="Cerrar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-8">
              <MapContent
                isExpanded={true}
                data={data}
                dataByState={dataByState}
                totalNationwide={totalNationwide}
                top5={top5}
                hoveredState={hoveredState}
                setHoveredState={setHoveredState}
                mousePos={mousePos}
                setMousePos={setMousePos}
                hoveredData={hoveredData}
                onStateClick={onStateClick}
                onExpand={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MapContent({
  isExpanded,
  data,
  dataByState,
  totalNationwide,
  top5,
  hoveredState,
  setHoveredState,
  mousePos,
  setMousePos,
  hoveredData,
  onStateClick,
  onExpand,
}: {
  isExpanded: boolean;
  data: StateDataPoint[];
  dataByState: Map<string, StateDataPoint>;
  totalNationwide: number;
  top5: StateDataPoint[];
  hoveredState: string | null;
  setHoveredState: (s: string | null) => void;
  mousePos: { x: number; y: number } | null;
  setMousePos: (p: { x: number; y: number } | null) => void;
  hoveredData: StateDataPoint | undefined | null;
  onStateClick?: (s: string) => void;
  onExpand: () => void;
}) {
  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="h-5 w-5 text-vylta-gold" />
          <h3 className={cn('font-bold text-vylta-bone', isExpanded ? 'text-xl' : 'text-base')}>
            Presencia nacional
          </h3>
          {/* v7: indicador honesto del modo de actualizacion */}
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-vylta-gold/70 ml-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vylta-gold/60" />
            </span>
            Auto-refresh 60s
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-vylta-muted">
          <span>
            <span className="text-vylta-gold tabular-nums text-base">{totalNationwide}</span>{' '}
            negocios
          </span>
          <span>•</span>
          <span>
            <span className="text-vylta-green tabular-nums text-base">{data.length}</span>{' '}
            de 32 estados
          </span>
          {!isExpanded && (
            <button
              onClick={onExpand}
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-vylta-gold/30 bg-vylta-gold/5 px-2.5 py-1.5 text-xs font-bold text-vylta-gold transition hover:bg-vylta-gold/10"
              title="Vista ampliada"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expandir
            </button>
          )}
        </div>
      </div>

      <div className={cn('grid gap-4', isExpanded ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-[1fr_260px]')}>
        <div
          className="relative overflow-hidden rounded-xl border border-border bg-vylta-admin-bg shadow-card-lg"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            setMousePos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseLeave={() => {
            setHoveredState(null);
            setMousePos(null);
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.04]" />
          <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-vylta-gold/8 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-vylta-rose/6 blur-[100px]" />

          <div className="relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: isExpanded ? 1500 : 1050,
                center: [-102, 23.5],
              }}
              width={800}
              height={isExpanded ? 600 : 420}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <Geographies geography={MEXICO_TOPO_JSON}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo) => {
                    const rawName =
                      geo.properties.state_name ||
                      geo.properties.name ||
                      geo.properties.NAME_1 ||
                      '';
                    const stateName = normalizeStateName(rawName);
                    const stateData = dataByState.get(stateName);
                    const count = stateData?.total_businesses || 0;
                    const heat = getHeatColor(count);

                    return (
                      <g key={geo.rsmKey}>
                        <Geography
                          geography={geo}
                          onMouseEnter={() => setHoveredState(stateName)}
                          onClick={() => onStateClick?.(stateName)}
                          style={{
                            default: {
                              fill: heat.fill,
                              stroke: heat.stroke,
                              strokeWidth: 0.6,
                              outline: 'none',
                              filter: heat.glow
                                ? `drop-shadow(0 0 8px ${heat.fill}90)`
                                : 'none',
                              transition: 'all 0.2s ease-out',
                            },
                            hover: {
                              fill: heat.fill,
                              stroke: '#FBBF24',
                              strokeWidth: 2.2,
                              outline: 'none',
                              cursor: 'pointer',
                              filter: `drop-shadow(0 0 14px ${heat.fill}cc)`,
                            },
                            pressed: {
                              fill: heat.fill,
                              stroke: '#FBBF24',
                              strokeWidth: 2.2,
                              outline: 'none',
                            },
                          }}
                        />
                      </g>
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {hoveredState && mousePos && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-vylta-gold/40 bg-vylta-card/95 px-4 py-3 shadow-card-lg backdrop-blur-sm"
              style={{
                left: Math.min(mousePos.x + 14, isExpanded ? 900 : 600),
                top: Math.max(mousePos.y - 70, 8),
              }}
            >
              <div className="text-sm font-bold text-vylta-bone">{hoveredState}</div>
              {hoveredData ? (
                <>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-vylta-gold tabular-nums font-bold text-lg">
                      {hoveredData.total_businesses}
                    </span>
                    <span className="text-xs text-vylta-muted">negocios</span>
                  </div>
                  {hoveredData.new_last_30d > 0 && (
                    <div className="text-xs text-vylta-green tabular-nums mt-1">
                      +{hoveredData.new_last_30d} en últimos 30 días
                    </div>
                  )}
                  {hoveredData.new_last_7d > 0 && (
                    <div className="text-xs text-vylta-sky tabular-nums">
                      +{hoveredData.new_last_7d} en últimos 7 días
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-vylta-subtle italic mt-1">Sin presencia aún</div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-vylta-surface p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-vylta-gold" />
              <h4 className="text-sm font-bold text-vylta-bone">Top 5 estados</h4>
            </div>
            {top5.length === 0 ? (
              <div className="text-sm text-vylta-subtle italic py-4 text-center">
                Aún no hay negocios con ubicación
              </div>
            ) : (
              <div className="space-y-2.5">
                {top5.map((s, i) => {
                  const heat = getHeatColor(s.total_businesses);
                  const pct = totalNationwide > 0
                    ? Math.round((s.total_businesses / totalNationwide) * 100)
                    : 0;
                  return (
                    <div key={s.state} className="group flex items-center gap-2.5">
                      <span className="text-xs text-vylta-subtle tabular-nums w-4">{i + 1}.</span>
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{
                          background: heat.fill,
                          boxShadow: heat.glow ? `0 0 8px ${heat.fill}` : undefined,
                        }}
                      />
                      <span className="flex-1 truncate text-sm text-vylta-bone group-hover:text-vylta-gold transition font-medium">
                        {s.state}
                      </span>
                      <span className="text-vylta-gold tabular-nums font-bold text-sm">{s.total_businesses}</span>
                      <span className="text-xs text-vylta-subtle tabular-nums w-9 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-vylta-surface p-5">
            <div className="text-sm font-bold text-vylta-bone mb-4">
              Densidad por estado
            </div>
            <div className="space-y-2">
              {LEGEND.map((legend) => (
                <div key={legend.label} className="flex items-center gap-2.5">
                  <div
                    className="h-3.5 w-3.5 rounded shrink-0"
                    style={{
                      background: legend.color,
                      boxShadow: legend.glow ? `0 0 8px ${legend.color}` : undefined,
                    }}
                  />
                  <span className="flex-1 text-sm text-vylta-bone">{legend.label}</span>
                  <span className="text-xs text-vylta-muted tabular-nums font-bold">
                    {legend.range}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isExpanded && (
            <div className="rounded-xl border border-border bg-vylta-surface p-5">
              <div className="text-sm font-bold text-vylta-bone mb-3">
                Todos los estados con presencia
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-1.5">
                {[...data]
                  .sort((a, b) => b.total_businesses - a.total_businesses)
                  .map((s) => {
                    const heat = getHeatColor(s.total_businesses);
                    return (
                      <div key={s.state} className="flex items-center gap-2.5 text-sm">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: heat.fill }}
                        />
                        <span className="flex-1 text-vylta-bone">{s.state}</span>
                        <span className="text-vylta-gold tabular-nums font-bold">{s.total_businesses}</span>
                      </div>
                    );
                  })
                }
                {data.length === 0 && (
                  <div className="text-sm text-vylta-subtle italic text-center py-4">
                    Sin datos aún
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
