'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { MapPin, Search, Maximize2, X, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════
// MexicoHeatmap (v5 — Realtime pulse INSERT + UPDATE May 23 2026)
//
// CAMBIOS EN v5:
//   • Antes solo escuchaba INSERT en business_profiles.
//   • Problema: el wizard de onboarding crea el row en el Paso 1 (negocio)
//     y luego hace UPSERT en el Paso 2 (ubicacion). Como ya existe el row,
//     el evento que dispara Postgres es UPDATE, no INSERT. Por eso el
//     pulse nunca aparecia para usuarios nuevos del wizard.
//   • Solucion: escuchar ambos eventos con `event: '*'` y detectar si el
//     `state` cambio efectivamente (de NULL/vacio a un valor real, o de
//     un valor a otro distinto). Asi cubrimos:
//       a. Negocios nuevos que se crean con state directo (INSERT con state)
//       b. Negocios que se crean sin state y luego se actualizan (UPDATE
//          del Paso 2 del wizard)
//       c. Usuarios existentes que cambian su ubicacion desde Mi Negocio
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
  /** Callback opcional cuando llega un nuevo negocio vía realtime — útil para invalidar caches */
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

export function MexicoHeatmap({ data, onStateClick, onNewBusiness }: MexicoHeatmapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // ⚡ PULSE STATES: Set de nombres de estados que están parpadeando ahora
  const [pulsingStates, setPulsingStates] = useState<Set<string>>(new Set());
  // Mantenemos un ref para que el subscriber siempre acceda a la versión más reciente
  const onNewBusinessRef = useRef(onNewBusiness);
  useEffect(() => { onNewBusinessRef.current = onNewBusiness; }, [onNewBusiness]);

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

  // ═══════════════════════════════════════════════════════════════════════
  // SUPABASE REALTIME (v5): detectar nuevos negocios Y cambios de ubicacion
  //
  // ANTES (v4): solo escuchaba INSERT. Eso fallaba para el wizard de
  // onboarding porque crea el row en Paso 1 y hace UPSERT (=UPDATE) en
  // Paso 2 con la ubicacion. El evento que llegaba era UPDATE, no INSERT,
  // asi que el pulse nunca aparecia.
  //
  // AHORA (v5): escucha `event: '*'` (INSERT + UPDATE + DELETE).
  // Filtramos en el handler:
  //   - INSERT con state lleno  → pulse + toast "Nuevo negocio en X"
  //   - UPDATE donde state cambio de NULL/vacio a un valor  → mismo pulse
  //   - UPDATE donde state cambio de un valor X a un valor Y  → pulse en Y
  //   - DELETE  → ignorar (no es relevante para el dashboard live)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-heatmap-state-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_profiles',
        },
        (payload) => {
          // Solo nos interesan eventos INSERT y UPDATE
          if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;

          const newRow = payload.new as { state?: string; business_name?: string };
          const oldRow = payload.old as { state?: string };

          // Si el row nuevo no tiene state, no hay nada que mostrar en el mapa
          if (!newRow.state) return;

          // En UPDATE solo disparar pulse si el state cambio efectivamente.
          // Esto evita pulses cuando se actualizan otros campos (logo, telefono)
          // sin cambiar la ubicacion.
          if (payload.eventType === 'UPDATE') {
            const oldState = oldRow?.state || null;
            const newState = newRow.state || null;
            if (oldState === newState) return;
          }

          const stateName = normalizeStateName(newRow.state);

          // Añadir a pulsingStates
          setPulsingStates((prev) => {
            const next = new Set(prev);
            next.add(stateName);
            return next;
          });

          // Toast notification — diferenciamos lenguaje segun tipo de evento
          const isNew = payload.eventType === 'INSERT' || !oldRow?.state;
          toast.success(
            isNew
              ? `✨ Nuevo negocio en ${stateName}`
              : `📍 Negocio actualizado en ${stateName}`,
            {
              description: newRow.business_name || (isNew ? 'Se acaba de registrar un negocio' : 'Se actualizó la ubicación'),
              duration: 8000,
            }
          );

          // Trigger callback para invalidar caches del dashboard
          onNewBusinessRef.current?.();

          // Quitar el pulse después de 10 segundos
          setTimeout(() => {
            setPulsingStates((prev) => {
              const next = new Set(prev);
              next.delete(stateName);
              return next;
            });
          }, 10_000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        pulsingStates={pulsingStates}
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
                pulsingStates={pulsingStates}
              />
            </div>
          </div>
        </div>
      )}

      {/* CSS de la animación pulse — inline para no depender de tailwind config */}
      <style jsx global>{`
        @keyframes vylta-state-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 6px #FBBF24) drop-shadow(0 0 12px #F59E0B);
          }
          50% {
            filter: drop-shadow(0 0 16px #FBBF24) drop-shadow(0 0 30px #F59E0B);
          }
        }
        .state-pulse path {
          animation: vylta-state-pulse 0.8s ease-in-out infinite;
        }
      `}</style>
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
  pulsingStates,
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
  pulsingStates: Set<string>;
}) {
  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-vylta-gold" />
          <h3 className={cn('font-bold text-vylta-bone', isExpanded ? 'text-xl' : 'text-base')}>
            Presencia nacional
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-vylta-gold/80 ml-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-vylta-gold/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vylta-gold" />
            </span>
            Tiempo real
          </span>
          {pulsingStates.size > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-vylta-gold animate-pulse">
              <Sparkles className="h-3.5 w-3.5" />
              {pulsingStates.size} nuevo{pulsingStates.size > 1 ? 's' : ''}
            </span>
          )}
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
                    const isPulsing = pulsingStates.has(stateName);

                    return (
                      <g key={geo.rsmKey} className={isPulsing ? 'state-pulse' : ''}>
                        <Geography
                          geography={geo}
                          onMouseEnter={() => setHoveredState(stateName)}
                          onClick={() => onStateClick?.(stateName)}
                          style={{
                            default: {
                              fill: isPulsing ? '#FBBF24' : heat.fill,
                              stroke: isPulsing ? '#F59E0B' : heat.stroke,
                              strokeWidth: isPulsing ? 2.5 : 0.6,
                              outline: 'none',
                              filter: !isPulsing && heat.glow
                                ? `drop-shadow(0 0 8px ${heat.fill}90)`
                                : 'none',
                              transition: 'all 0.2s ease-out',
                            },
                            hover: {
                              fill: isPulsing ? '#FBBF24' : heat.fill,
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
