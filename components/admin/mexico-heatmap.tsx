'use client';

import { useMemo, useState } from 'react';
import { MEXICO_SVG_PATHS } from '@/lib/mexico-svg-paths';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// MexicoHeatmap — Mapa de calor de la República Mexicana
//
// Renderiza un SVG vectorial de los 32 estados de México colorizados
// por densidad de negocios suscritos. Estilo CyberSecure: gradientes,
// glows, tooltips al hover.
//
// PROPS:
//   data: array de { state, total_businesses, new_last_30d, new_last_7d }
//
// COMPORTAMIENTO:
//   • Estados sin negocios → gris oscuro casi invisible
//   • 1-3 negocios   → verde oscuro
//   • 4-10 negocios  → verde medio
//   • 11-25 negocios → verde brillante VYLTA
//   • 26+ negocios   → verde con glow + animación sutil
//
//   Hover → tooltip con # de negocios + nuevos en 30d y 7d
//   Click → callback opcional para drill-down
// ═══════════════════════════════════════════════════════════════════════

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

// Devuelve la "intensidad" de color según el conteo.
// Retorna fill, stroke, glow flag.
function getHeatColor(count: number): { fill: string; stroke: string; glow: boolean; label: string } {
  if (count === 0) {
    return { fill: '#1F2937', stroke: '#374151', glow: false, label: 'Sin presencia' };
  }
  if (count <= 3) {
    return { fill: '#065F46', stroke: '#047857', glow: false, label: '1-3 negocios' };
  }
  if (count <= 10) {
    return { fill: '#10B981', stroke: '#34D399', glow: false, label: '4-10 negocios' };
  }
  if (count <= 25) {
    return { fill: '#34D399', stroke: '#6EE7B7', glow: true, label: '11-25 negocios' };
  }
  return { fill: '#6EE7B7', stroke: '#A7F3D0', glow: true, label: '26+ negocios' };
}

export function MexicoHeatmap({ data, onStateClick }: MexicoHeatmapProps) {
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Map: state name → data point para lookup O(1)
  const dataByState = useMemo(() => {
    const map = new Map<string, StateDataPoint>();
    data.forEach(d => map.set(d.state, d));
    return map;
  }, [data]);

  // Total global para % en tooltip
  const totalNationwide = useMemo(
    () => data.reduce((sum, d) => sum + d.total_businesses, 0),
    [data]
  );

  // Top 5 estados (para badge lateral)
  const top5 = useMemo(
    () => [...data].sort((a, b) => b.total_businesses - a.total_businesses).slice(0, 5),
    [data]
  );

  const hoveredState = hoveredIso
    ? MEXICO_SVG_PATHS.find(p => p.iso === hoveredIso)
    : null;
  const hoveredData = hoveredState ? dataByState.get(hoveredState.name) : null;

  return (
    <div className="relative">
      {/* Stats globales arriba */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-vylta-gold" />
          <h3 className="text-sm font-bold text-vylta-bone">Mapa de presencia nacional</h3>
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

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
        {/* SVG del mapa */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-vylta-admin-bg p-4 shadow-card-lg">
          {/* Glow background sutil */}
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.05]" />
          <div className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full bg-vylta-green/10 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-vylta-gold/8 blur-[80px]" />

          <svg
            viewBox="0 0 1000 700"
            className="relative w-full h-auto"
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              });
            }}
            onMouseLeave={() => {
              setHoveredIso(null);
              setMousePos(null);
            }}
          >
            <defs>
              {/* Filtro de glow para estados con muchos negocios */}
              <filter id="glow-state" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Gradiente sutil para todos los estados — da profundidad */}
              <radialGradient id="depth-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                <stop offset="100%" stopColor="black" stopOpacity="0.15" />
              </radialGradient>
            </defs>

            {/* Paths de los 32 estados */}
            <g>
              {MEXICO_SVG_PATHS.map((stateSvg) => {
                const stateData = dataByState.get(stateSvg.name);
                const count = stateData?.total_businesses || 0;
                const heat = getHeatColor(count);
                const isHovered = hoveredIso === stateSvg.iso;

                return (
                  <g key={stateSvg.iso}>
                    <path
                      d={stateSvg.d}
                      fill={heat.fill}
                      stroke={isHovered ? '#F59E0B' : heat.stroke}
                      strokeWidth={isHovered ? 2.5 : 1}
                      filter={heat.glow ? 'url(#glow-state)' : undefined}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        opacity: hoveredIso && !isHovered ? 0.55 : 1,
                      }}
                      onMouseEnter={() => setHoveredIso(stateSvg.iso)}
                      onClick={() => onStateClick?.(stateSvg.name)}
                    />
                    {/* Overlay con gradiente sutil para profundidad */}
                    <path
                      d={stateSvg.d}
                      fill="url(#depth-grad)"
                      pointerEvents="none"
                    />
                    {/* Label del estado si tiene 5+ negocios o está hovered */}
                    {(count >= 5 || isHovered) && (
                      <text
                        x={stateSvg.centroid[0]}
                        y={stateSvg.centroid[1]}
                        textAnchor="middle"
                        fontSize={isHovered ? 11 : 9}
                        fontWeight={isHovered ? 800 : 600}
                        fill={isHovered ? '#FBBF24' : '#F1F5F9'}
                        pointerEvents="none"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tooltip flotante */}
          {hoveredState && hoveredData && mousePos && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-vylta-gold/40 bg-vylta-card/95 px-3 py-2 shadow-card-lg backdrop-blur-sm"
              style={{
                left: mousePos.x + 12,
                top: mousePos.y - 50,
              }}
            >
              <div className="text-[11px] font-bold text-vylta-bone">{hoveredState.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <span className="text-vylta-gold tabular-nums font-bold">{hoveredData.total_businesses}</span>
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
            </div>
          )}

          {/* Tooltip para estados SIN data (solo hover sobre estado vacío) */}
          {hoveredState && !hoveredData && mousePos && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-border bg-vylta-card/95 px-3 py-2 shadow-card-lg backdrop-blur-sm"
              style={{
                left: mousePos.x + 12,
                top: mousePos.y - 50,
              }}
            >
              <div className="text-[11px] font-bold text-vylta-bone">{hoveredState.name}</div>
              <div className="text-[10px] text-vylta-subtle italic">Sin presencia aún</div>
            </div>
          )}
        </div>

        {/* Panel lateral con Top 5 y leyenda */}
        <div className="flex flex-col gap-4">
          {/* Top 5 estados */}
          <div className="rounded-xl border border-border bg-vylta-surface p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted mb-3">
              Top 5 estados
            </div>
            {top5.length === 0 ? (
              <div className="text-[11px] text-vylta-subtle italic py-2">
                Aún no hay negocios registrados con ubicación
              </div>
            ) : (
              <div className="space-y-2">
                {top5.map((s, i) => {
                  const heat = getHeatColor(s.total_businesses);
                  const pct = totalNationwide > 0
                    ? Math.round((s.total_businesses / totalNationwide) * 100)
                    : 0;
                  return (
                    <div
                      key={s.state}
                      className="group flex items-center gap-2 text-[11px]"
                    >
                      <span className="text-[10px] text-vylta-subtle tabular-nums w-3">{i + 1}.</span>
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: heat.fill, boxShadow: heat.glow ? `0 0 6px ${heat.fill}` : undefined }}
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
                { label: '26+ negocios', color: '#6EE7B7', glow: true },
                { label: '11-25 negocios', color: '#34D399', glow: true },
                { label: '4-10 negocios', color: '#10B981', glow: false },
                { label: '1-3 negocios', color: '#065F46', glow: false },
                { label: 'Sin presencia', color: '#1F2937', glow: false },
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
