'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCurrency, formatPercentChange } from '@/lib/utils';
import type { DailyRevenuePoint } from '@/lib/dashboard-stats';

// ══════════════════════════════════════════════════════════════════════
// Gráfica de línea de ingresos diarios — estilo Stripe Dashboard
//
// Usa Recharts (mejor que SVG manual en web).
// Animaciones sutiles, gradient fill, tooltip personalizado.
// ══════════════════════════════════════════════════════════════════════

interface RevenueChartProps {
  title: string;
  totalValue: string;
  changePercent: number | null;
  changeLabel?: string;
  data: DailyRevenuePoint[];
  rangeLabel?: string;
}

export function RevenueChart({
  title,
  totalValue,
  changePercent,
  changeLabel = 'vs mes anterior',
  data,
  rangeLabel,
}: RevenueChartProps) {
  const isPositive = changePercent !== null && changePercent > 0;
  const isNegative = changePercent !== null && changePercent < 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{totalValue}</span>
            {changePercent !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-semibold',
                  isPositive && 'text-vylta-green-600 dark:text-vylta-green-400',
                  isNegative && 'text-destructive',
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {formatPercentChange(changePercent)}
                <span className="font-normal text-muted-foreground ml-1">{changeLabel}</span>
              </span>
            )}
          </div>
        </div>
        {rangeLabel && (
          <span className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {rangeLabel}
          </span>
        )}
      </div>

      {/* Gráfica */}
      <div className="mt-6 h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="currentColor"
                className="text-xs text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="currentColor"
                className="text-xs text-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v).replace('$', '')}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin movimiento aún para este período.
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold text-vylta-green-600 dark:text-vylta-green-400 tabular-nums">
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}
