'use client';

import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// DashboardInfo (May 23 2026)
//
// Iconito ⓘ que al hacer click despliega una nota explicativa del
// dashboard donde se coloca. Pensado para que socios/co-founders
// no-técnicos (como Hugo) puedan entender que mide cada visual sin
// preguntar.
//
// USO:
//   <DashboardInfo
//     title="MRR — Ingresos recurrentes mensuales"
//     description="..."
//     metrics={[...]}
//   />
//
// CADA dashboard del Control Center debe tener uno. El contenido se
// escribe en lenguaje sencillo, evitando jerga tecnica.
// ═══════════════════════════════════════════════════════════════════════

export interface DashboardInfoMetric {
  /** Nombre corto del dato (e.g. "MRR", "Tasa de retención") */
  label: string;
  /** Que mide en lenguaje sencillo */
  meaning: string;
}

interface DashboardInfoProps {
  /** Título corto del dashboard (e.g. "MRR — Ingresos recurrentes mensuales") */
  title: string;
  /** Descripción general en lenguaje no-técnico (1-2 párrafos) */
  description: string;
  /** Lista opcional de métricas/columnas/elementos visuales que aparecen en el dashboard */
  metrics?: DashboardInfoMetric[];
  /** Por qué importa esta info para la operación del negocio */
  whyMatters?: string;
  /** Tamaño del iconito. Default = 16px */
  size?: number;
  /** Clase extra para el botón */
  className?: string;
}

export function DashboardInfo({
  title,
  description,
  metrics,
  whyMatters,
  size = 16,
  className,
}: DashboardInfoProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full text-vylta-muted/60 transition hover:text-vylta-gold focus:text-vylta-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-vylta-gold/40',
            className
          )}
          aria-label={`Qué es: ${title}`}
        >
          <Info style={{ width: size, height: size }} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-vylta-gold mb-1.5">
              ¿Qué es esto?
            </div>
            <h4 className="text-sm font-bold text-vylta-bone">{title}</h4>
          </div>

          <p className="text-xs leading-relaxed text-vylta-muted">{description}</p>

          {metrics && metrics.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-muted/80 mb-2">
                Datos que verás
              </div>
              <ul className="space-y-2">
                {metrics.map((m) => (
                  <li key={m.label} className="text-xs leading-relaxed">
                    <span className="font-bold text-vylta-bone">{m.label}: </span>
                    <span className="text-vylta-muted">{m.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {whyMatters && (
            <div className="border-t border-border pt-3">
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-green/80 mb-1.5">
                ¿Por qué importa?
              </div>
              <p className="text-xs leading-relaxed text-vylta-muted">{whyMatters}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
