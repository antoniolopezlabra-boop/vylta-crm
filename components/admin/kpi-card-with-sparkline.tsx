'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// KpiCardWithSparkline — Card ejecutivo que combina:
//   • KPI numerico grande
//   • Delta vs periodo anterior (+/-/=)
//   • Mini sparkline (mini area chart) abajo
//
// Reemplaza la combinacion redundante de:
//   KpiCard (numero grande) + ChartCard (grafica grande separada)
//
// Asi consolidamos informacion sin duplicar visualmente datos.
// ═══════════════════════════════════════════════════════════════════════

type Accent = 'green' | 'blue' | 'gold' | 'luxury' | 'rose';

const COLOR_MAP: Record<Accent, { text: string; halo: string; chart: string }> = {
  green:  { text: 'text-vylta-green',  halo: '#10B981', chart: '#10B981' },
  blue:   { text: 'text-vylta-sky',    halo: '#0EA5E9', chart: '#0EA5E9' },
  gold:   { text: 'text-vylta-gold',   halo: '#F59E0B', chart: '#F59E0B' },
  luxury: { text: 'text-vylta-luxury', halo: '#A78BFA', chart: '#A78BFA' },
  rose:   { text: 'text-vylta-rose',   halo: '#EF4444', chart: '#EF4444' },
};

interface KpiCardWithSparklineProps {
  label: string;
  value: number | string;
  hint: string;
  Icon: any;
  accent: Accent;
  href?: string;
  /** Serie temporal para el sparkline. Cada punto representa un periodo. */
  series?: { label: string; value: number }[];
  /** Subtitulo opcional debajo del valor principal (ej. "+2 esta semana") */
  deltaLabel?: string;
  deltaDirection?: 'up' | 'down' | 'flat';
  pulse?: boolean;
}

export function KpiCardWithSparkline({
  label, value, hint, Icon, accent, href, series, deltaLabel, deltaDirection, pulse,
}: KpiCardWithSparklineProps) {
  const colors = COLOR_MAP[accent];

  // Calcular sparkline path si hay series
  const sparkline = (() => {
    if (!series || series.length < 2) return null;

    const W = 240;
    const H = 48;
    const pad = 2;
    const max = Math.max(...series.map(d => d.value), 1);
    const step = (W - pad * 2) / Math.max(series.length - 1, 1);

    const pts = series.map((d, i) => ({
      x: pad + i * step,
      y: H - pad - (d.value / max) * (H - pad * 2),
      v: d.value,
      label: d.label,
    }));

    let linePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2;
      linePath += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
    const lastPt = pts[pts.length - 1];

    return { W, H, pts, linePath, areaPath, lastPt };
  })();

  const DeltaIcon = deltaDirection === 'up' ? TrendingUp
                    : deltaDirection === 'down' ? TrendingDown
                    : Minus;
  const deltaColor = deltaDirection === 'up' ? 'text-vylta-green'
                    : deltaDirection === 'down' ? 'text-vylta-rose'
                    : 'text-vylta-muted';

  const inner = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card transition-all hover:border-vylta-gold/40 hover:-translate-y-0.5">
      {/* Halo decorativo */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-25 transition-opacity group-hover:opacity-45"
        style={{ background: colors.halo }}
      />

      <div className="relative">
        {/* Header con label + icon */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-vylta-subtle">
            {label}
          </span>
          <Icon className={cn('h-5 w-5', colors.text)} strokeWidth={2} />
        </div>

        {/* Valor principal */}
        <div className="mt-4 flex items-baseline gap-3">
          <div className={cn('text-5xl font-bold tabular-nums tracking-tightest leading-none', colors.text)}>
            {value}
          </div>
          {pulse && (
            <span className="relative flex h-2.5 w-2.5 self-start mt-1">
              <span className="absolute inset-0 animate-ping rounded-full opacity-50" style={{ background: colors.halo }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: colors.halo }} />
            </span>
          )}
        </div>

        {/* Hint + delta */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-vylta-muted">{hint}</span>
          {deltaLabel && (
            <span className={cn('inline-flex items-center gap-1 text-xs font-bold tabular-nums', deltaColor)}>
              <DeltaIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              {deltaLabel}
            </span>
          )}
        </div>

        {/* Sparkline */}
        {sparkline && (
          <div className="mt-4 -mx-1">
            <svg viewBox={`0 0 ${sparkline.W} ${sparkline.H}`} className="w-full h-12">
              <defs>
                <linearGradient id={`spark-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={colors.chart} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={colors.chart} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={sparkline.areaPath} fill={`url(#spark-grad-${label})`} />
              <path
                d={sparkline.linePath}
                fill="none"
                stroke={colors.chart}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Punto final destacado */}
              <circle
                cx={sparkline.lastPt.x}
                cy={sparkline.lastPt.y}
                r={3}
                fill={colors.chart}
                stroke="#0F1424"
                strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 6px ${colors.chart})` }}
              />
            </svg>
          </div>
        )}

        {/* Link */}
        {href && (
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-vylta-muted transition group-hover:text-vylta-gold">
            Ver detalle <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href} prefetch>{inner}</Link> : inner;
}
