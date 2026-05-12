'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { ServiceSlice } from '@/lib/dashboard-stats';

// ══════════════════════════════════════════════════════════════════════
// Donut de ingresos por servicio
// ══════════════════════════════════════════════════════════════════════

interface ServicesDonutProps {
  title: string;
  totalValue: string;
  data: ServiceSlice[];
  rangeLabel?: string;
}

export function ServicesDonut({ title, totalValue, data, rangeLabel }: ServicesDonutProps) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const hasData = total > 0 && data.length > 0;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {rangeLabel && (
          <span className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {rangeLabel}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="mt-6 flex flex-1 items-center gap-6">
          {/* Donut */}
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={86}
                  paddingAngle={2}
                  dataKey="amount"
                  animationDuration={800}
                >
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </div>
              <div className="text-base font-bold tabular-nums">{totalValue}</div>
            </div>
          </div>

          {/* Legend */}
          <ul className="flex-1 space-y-2.5">
            {data.slice(0, 6).map((slice) => {
              const percent = Math.round((slice.amount / total) * 100);
              return (
                <li key={slice.name} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="flex-1 truncate text-sm font-medium">{slice.name}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: slice.color }}>
                    {percent}%
                  </span>
                </li>
              );
            })}
            {data.length > 6 && (
              <li className="text-xs italic text-muted-foreground">+ {data.length - 6} más</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          Sin servicios cobrados aún.
        </div>
      )}
    </div>
  );
}

function DonutTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const percent = Math.round((slice.amount / total) * 100);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <span className="text-sm font-semibold">{slice.name}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
        {formatCurrency(slice.amount)} · <span className="font-bold" style={{ color: slice.color }}>{percent}%</span>
      </div>
    </div>
  );
}
