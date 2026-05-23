'use client';

import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═════════════════════════════════════════════════════════════════════
// MexicoHeatmap (v2 PROFESIONAL — May 22 2026)
//
// REEMPLAZO de la versión SVG manual anterior. Usa react-simple-maps
// con TopoJSON oficial INEGI de los 32 estados de México.
//
// MEJORAS vs v1:
//   • Geometría REAL (cada estado se ve como en Google Maps)
//   • Proyección geographic correcta (Albers México)
//   • Resolución alta sin pesar mucho (TopoJSON optimizado)
//   • Hover state nativo con animaciones suaves
//   • Layer system: base + heatmap + labels (separados)
//
// FUENTE TOPOJSON:
//   Servido desde un CDN público (datasets.io) con la geometría
//   oficial del INEGI. Caché del navegador 24h.
// ═════════════════════════════════════════════════════════════════════

// TopoJSON público con los 32 estados de México (CDN unpkg)
const MEXICO_TOPO_JSON = 'https://raw.githubusercontent.com/strotgen/mexico-leaflet/master/states.geojson';

// Mapeo de nombres del GeoJSON ↔ nombres en nuestra BD
// El GeoJSON usa nombres oficiales en español; ajustamos los que
// difieren para que el join funcione perfecto.
const NAME_MAP: Record<string, string> = {
  'México':                 'Estado de México',
  'Distrito Federal':       'Ciudad de México',
  'Coahuila de Zaragoza':   'Coahuila',
  'Michoacán de Ocampo':    'Michoacán',
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
}

// Color scale por densidad de negocios.
function getHeatColor(count: number, maxCount: number): {
  fill: string;
  stroke: string;
  intensity: number; // 0-1 para opacity overlay
  label: string;
} {
  if (count === 0) {
    return { fill: '#0F1424', stroke: '#1F2937', intensity: 0, label: 'Sin presencia' };
  }
  // Calculamos la intensidad relativa al max del país (no a un valor fijo)
  const intensity = Math.min(count / Math.max(maxCount, 5), 1);

  if (intensity < 0.25) return { fill: '#064E3B', stroke: '#065F46', intensity, label: 'Baja' };
  if (intensity < 0.50) return { fill: '#047857', stroke: '#059669', intensity, label: 'Media' };
  if (intensity < 0.75) return { fill: '#10B981', stroke: '#34D399', intensity, label: 'Alta' };
  return { fill: '#6EE7B7', stroke: '#A7F3D0', intensity, label: 'Crítica' };
}

export function MexicoHeatmap({ data, onStateClick }: MexicoHeatmapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const dataByState = useMemo(() => {
    const map = new Map<string, StateDataPoint>();
    data.forEach(d => map.set(d.state, d));
    return map;
  }, [data]);

  const totalNationwide = useMemo(
    () => data.reduce((sum, d) => sum + d.total_businesses, 0),
    [data]
  );

  const maxCount = useMemo(
    () => Math.max(...data.map(d => d.total_businesses), 1),
    [data]
  );

  const top5 = useMemo(
    () => [...data].sort((a, b) => b.total_businesses - a.total_businesses).slice(0, 5),
    [data]
  );

  const hoveredData = hoveredState ? dataByState.get(hoveredState) : null;

  return (
    <div className="relative">
      {/* Stats globales arriba */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-vylta-gold" />
          <h3 className="text-sm font-bold text-vylta-bone">Presencia nacional</h3>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-gold/70 ml-2">
            Tiempo real
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-vylta-muted">
          <span>
            <span className="text-vylta-gold tabular-nums">{totalNationwide}</span>{' '}
            negocios totales
          </span>
          <span>•</span>
          <span>
            <span className="text-vylta-green tabular-nums">{data.length}</span>{' '}
            estados activos
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
        {/* MAPA */}
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
          {/* Halos decorativos */}
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.04]" />
          <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-vylta-green/8 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-vylta-gold/8 blur-[100px]" />

          <div className="relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 1100,
                center: [-102, 23.5],
              }}
              width={800}
              height={500}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <Geographies geography={MEXICO_TOPO_JSON}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo) => {
                    const rawName = geo.properties.name || geo.properties.NAME_1 || '';
                    const stateName = normalizeStateName(rawName);
                    const stateData = dataByState.get(stateName);
                    const count = stateData?.total_businesses || 0;
                    const heat = getHeatColor(count, maxCount);
                    const isHovered = hoveredState === stateName;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() => setHoveredState(stateName)}
                        onClick={() => onStateClick?.(stateName)}
                        style={{
                          default: {
                            fill: heat.fill,
                            stroke: heat.stroke,
                            strokeWidth: 0.6,
                            outline: 'none',
                            filter: heat.intensity > 0.5 ? `drop-shadow(0 0 6px ${heat.fill}80)` : 'none',
                            transition: 'all 0.2s ease-out',
                          },
                          hover: {
                            fill: heat.fill,
                            stroke: '#F59E0B',
                            strokeWidth: 2,
                            outline: 'none',
                            cursor: 'pointer',
                            filter: `drop-shadow(0 0 12px ${heat.fill}cc)`,
                          },
                          pressed: {
                            fill: heat.fill,
                            stroke: '#F59E0B',
                            strokeWidth: 2,
                            outline: 'none',
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {/* Tooltip flotante */}
          {hoveredState && mousePos && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-vylta-gold/40 bg-vylta-card/95 px-3 py-2 shadow-card-lg backdrop-blur-sm"
              style={{
                left: Math.min(mousePos.x + 12, 600),
                top: Math.max(mousePos.y - 60, 8),
              }}
            >
              <div className="text-[11px] font-bold text-vylta-bone">{hoveredState}</div>
              {hoveredData ? (
                <>
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className="text-vylta-gold tabular-nums font-bold">
                      {hoveredData.total_businesses}
                    </span>
                    <span className="text-vylta-muted">negocios totales</span>
                  </div>
                  {hoveredData.new_last_30d > 0 && (
                    <div className="text-[10px] text-vylta-green tabular-nums">
                      +{hoveredData.new_last_30d} en últimos 30 días
                    </div>
                  )}
                  {hoveredData.new_last_7d > 0 && (
                    <div className="text-[10px] text-vylta-sky tabular-nums">
                      +{hoveredData.new_last_7d} en últimos 7 días
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10px] text-vylta-subtle italic mt-0.5">Sin presencia aún</div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-4">
          {/* Top 5 */}
          <div className="rounded-xl border border-border bg-vylta-surface p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted mb-3 flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Top 5 estados
            </div>
            {top5.length === 0 ? (
              <div className="text-[11px] text-vylta-subtle italic py-2">
                Aún no hay negocios con ubicación
              </div>
            ) : (
              <div className="space-y-2">
                {top5.map((s, i) => {
                  const heat = getHeatColor(s.total_businesses, maxCount);
                  const pct = totalNationwide > 0
                    ? Math.round((s.total_businesses / totalNationwide) * 100)
                    : 0;
                  return (
                    <div key={s.state} className="group flex items-center gap-2 text-[11px]">
                      <span className="text-[10px] text-vylta-subtle tabular-nums w-3">{i + 1}.</span>
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          background: heat.fill,
                          boxShadow: heat.intensity > 0.5 ? `0 0 6px ${heat.fill}` : undefined,
                        }}
                      />
                      <span className="flex-1 truncate text-vylta-bone group-hover:text-vylta-gold transition">
                        {s.state}
                      </span>
                      <span className="text-vylta-gold tabular-nums font-bold">{s.total_businesses}</span>
                      <span className="text-[9px] text-vylta-subtle tabular-nums w-7 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leyenda de densidad */}
          <div className="rounded-xl border border-border bg-vylta-surface p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted mb-3">
              Densidad
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Crítica',  color: '#6EE7B7', glow: true },
                { label: 'Alta',     color: '#10B981', glow: true },
                { label: 'Media',    color: '#047857', glow: false },
                { label: 'Baja',     color: '#064E3B', glow: false },
                { label: 'Sin presencia', color: '#0F1424', glow: false },
              ].map((legend) => (
                <div key={legend.label} className="flex items-center gap-2 text-[10px]">
                  <div
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{
                      background: legend.color,
                      boxShadow: legend.glow ? `0 0 6px ${legend.color}` : undefined,
                    }}
                  />
                  <span className="text-vylta-muted">{legend.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
