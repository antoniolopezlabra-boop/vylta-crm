import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatPercentChange } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// KPI Card ejecutiva — versión web del componente móvil KPICard
//
// Diseño:
//   ┌───────────────────────────┐
//   │ LABEL          [icono]   │
//   │ $45,250                  │
//   │ ↗ +18% vs mes ant.       │
//   └───────────────────────────┘
// ══════════════════════════════════════════════════════════════════════

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  change: number | null;
  comparisonLabel?: string;
}

export function KPICard({
  label,
  value,
  icon: Icon,
  iconColor,
  change,
  comparisonLabel = 'vs mes ant.',
}: KPICardProps) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-border/80">
      {/* Glow sutil en hover */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30"
        style={{ background: iconColor }}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              isPositive && 'text-vylta-green-600 dark:text-vylta-green-400',
              isNegative && 'text-destructive',
              !isPositive && !isNegative && 'text-muted-foreground',
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {formatPercentChange(change)}
          </span>
          <span className="text-muted-foreground">{comparisonLabel}</span>
        </div>
      </div>
    </div>
  );
}
