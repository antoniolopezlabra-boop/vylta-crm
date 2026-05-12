'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  CalendarCheck,
  Target,
  UserPlus,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { cn, formatCurrency, formatPercentChange } from '@/lib/utils';
import { MONTHS_ES } from '@/lib/date-utils';
import {
  calculatePeriod,
  generateCSV,
  downloadCSV,
  getReportsData,
  type PeriodType,
  type ReportsData,
  type ReportPeriod,
} from '@/lib/reports';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/dashboard/kpi-card';

// ══════════════════════════════════════════════════════════════════════
// /reportes — Reportes ejecutivos detallados
//
// Selector de período: Mes / Trimestre / Año
// Navegación entre períodos con ◀/▶
// Botón exportar CSV
// 4 KPIs comparativos
// Gráfica de área dual: actual vs anterior
// Top 10 servicios con barras horizontales
// Top 10 clientes que más gastan
// Distribución por status (pie)
// ══════════════════════════════════════════════════════════════════════

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'mes',       label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'año',       label: 'Año' },
];

export default function ReportesPage() {
  const [periodType, setPeriodType] = useState<PeriodType>('mes');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const period = useMemo(
    () => calculatePeriod(periodType, referenceDate),
    [periodType, referenceDate],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReportsData(period).then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [period]);

  function goPrev() {
    const d = new Date(referenceDate);
    if (periodType === 'mes')       d.setMonth(d.getMonth() - 1);
    if (periodType === 'trimestre') d.setMonth(d.getMonth() - 3);
    if (periodType === 'año')       d.setFullYear(d.getFullYear() - 1);
    setReferenceDate(d);
  }

  function goNext() {
    const d = new Date(referenceDate);
    if (periodType === 'mes')       d.setMonth(d.getMonth() + 1);
    if (periodType === 'trimestre') d.setMonth(d.getMonth() + 3);
    if (periodType === 'año')       d.setFullYear(d.getFullYear() + 1);
    setReferenceDate(d);
  }

  function goToday() {
    setReferenceDate(new Date());
  }

  function handleExport() {
    if (!data) return;
    setExporting(true);
    const csv = generateCSV(data.rawAppointments, period.label);
    const filename = `vylta-reporte-${period.label.toLowerCase().replace(/\s/g, '-')}.csv`;
    downloadCSV(csv, filename);
    setTimeout(() => setExporting(false), 500);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes ejecutivos</h1>
          <p className="text-sm text-muted-foreground">
            Análisis profundo de tu negocio para {period.label}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de tipo de período */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriodType(opt.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                  periodType === opt.value
                    ? 'bg-vylta-green-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Navegación */}
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              onClick={goPrev}
              className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="border-x border-border px-3 text-xs font-semibold transition hover:bg-secondary"
            >
              Hoy
            </button>
            <button
              onClick={goNext}
              className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Exportar */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data || loading || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar CSV
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Ingresos"
              value={formatCurrency(data.totalRevenue)}
              icon={DollarSign}
              iconColor="#10B981"
              change={data.revenueChange}
              comparisonLabel="vs ant."
            />
            <KPICard
              label="Citas"
              value={`${data.totalAppointments}`}
              icon={CalendarCheck}
              iconColor="#6366F1"
              change={data.apptsChange}
              comparisonLabel="vs ant."
            />
            <KPICard
              label="Ticket prom."
              value={formatCurrency(data.avgTicket)}
              icon={Target}
              iconColor="#F59E0B"
              change={data.ticketChange}
              comparisonLabel="vs ant."
            />
            <KPICard
              label="Clientes nuevos"
              value={`${data.totalClientsNew}`}
              icon={UserPlus}
              iconColor="#F472B6"
              change={null}
              comparisonLabel="en el período"
            />
          </div>

          {/* Gráfica de comparación */}
          <RevenueComparisonChart
            data={data.monthlyRevenue}
            currentLabel={period.label}
            periodType={periodType}
          />

          {/* Grid: Top servicios + Top clientes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopServicesBars services={data.topServices} totalRevenue={data.totalRevenue} />
            <TopClientsList clients={data.topClients} />
          </div>

          {/* Distribución por status */}
          <StatusDistribution data={data.statusDistribution} />

          {/* Resumen para impresión / soporte */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Resumen ejecutivo
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Durante <span className="font-bold text-foreground">{period.label}</span> tu negocio generó{' '}
              <span className="font-bold text-vylta-green-600 dark:text-vylta-green-400">{formatCurrency(data.totalRevenue)}</span>{' '}
              en ingresos cobrados a lo largo de {data.totalAppointments} citas registradas, con un ticket promedio de{' '}
              <span className="font-bold">{formatCurrency(data.avgTicket)}</span>. Captaste {data.totalClientsNew} clientes nuevos en este período.
              {data.revenueChange !== null && (
                <> Comparado con el período anterior, tus ingresos {data.revenueChange >= 0 ? 'crecieron' : 'cayeron'}{' '}
                  <span className={cn('font-bold', data.revenueChange >= 0 ? 'text-vylta-green-600 dark:text-vylta-green-400' : 'text-destructive')}>
                    {Math.abs(data.revenueChange)}%
                  </span>.</>
              )}
              {data.topServices[0] && (
                <> Tu servicio estrella fue <span className="font-bold">{data.topServices[0].name}</span>, con{' '}
                  {formatCurrency(data.topServices[0].revenue)} en ingresos ({data.topServices[0].count} citas).</>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Gráfica comparativa actual vs anterior ──

function RevenueComparisonChart({
  data,
  currentLabel,
  periodType,
}: {
  data: { label: string; current: number; previous: number }[];
  currentLabel: string;
  periodType: PeriodType;
}) {
  const totalCurrent = data.reduce((s, d) => s + d.current, 0);
  const totalPrev = data.reduce((s, d) => s + d.previous, 0);
  const hasData = totalCurrent > 0 || totalPrev > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Comparativa de ingresos</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Período actual vs período anterior de igual duración
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Legend2 color="#10B981" label={currentLabel} />
          <Legend2 color="#94A3B8" label="Anterior" />
        </div>
      </div>

      <div className="mt-6 h-72">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
              <XAxis dataKey="label" stroke="currentColor" className="text-xs text-muted-foreground" tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-xs text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v).replace('$', '')} />
              <Tooltip content={<ComparisonTooltip currentLabel={currentLabel} />} />
              <Area type="monotone" dataKey="previous" stroke="#94A3B8" strokeWidth={1.5} fill="url(#prevGrad)" strokeDasharray="4 4" animationDuration={800} />
              <Area type="monotone" dataKey="current" stroke="#10B981" strokeWidth={2.5} fill="url(#currentGrad)" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin datos en este período.
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonTooltip({ active, payload, label, currentLabel }: any) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p: any) => p.dataKey === 'current')?.value || 0;
  const previous = payload.find((p: any) => p.dataKey === 'previous')?.value || 0;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 space-y-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-vylta-green-500" />
          <span className="text-muted-foreground text-xs">{currentLabel}:</span>
          <span className="font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400 ml-auto">{formatCurrency(current)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-muted-foreground text-xs">Anterior:</span>
          <span className="font-medium tabular-nums ml-auto">{formatCurrency(previous)}</span>
        </div>
      </div>
    </div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ── Top servicios con barras horizontales ──

function TopServicesBars({
  services,
  totalRevenue,
}: {
  services: { name: string; revenue: number; count: number; color: string }[];
  totalRevenue: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Top servicios</h3>
        <span className="text-xs text-muted-foreground">por ingresos</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Los más rentables del período.</p>

      {services.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin servicios cobrados aún.</p>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => {
            const percent = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
            return (
              <li key={s.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: s.color }}>
                    {formatCurrency(s.revenue)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: s.color }}
                    />
                  </div>
                  <span className="shrink-0 w-16 text-right text-[10px] text-muted-foreground tabular-nums">
                    {s.count} {s.count === 1 ? 'cita' : 'citas'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Top clientes que más gastan ──

function TopClientsList({
  clients,
}: {
  clients: { id: string; name: string; revenue: number; appointments: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Top clientes</h3>
        <span className="text-xs text-muted-foreground">por gasto total</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Tus clientes más valiosos del período.</p>

      {clients.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin gastos de clientes aún.</p>
      ) : (
        <ol className="space-y-2">
          {clients.map((c, idx) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-secondary/50">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
                idx === 0 && 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
                idx === 1 && 'bg-secondary text-foreground',
                idx === 2 && 'bg-vylta-amber-500/10 text-vylta-amber-700 dark:text-amber-500',
                idx >= 3 && 'bg-secondary/50 text-muted-foreground',
              )}>
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.appointments} {c.appointments === 1 ? 'cita' : 'citas'}</div>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                {formatCurrency(c.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Distribución por status ──

function StatusDistribution({
  data,
}: {
  data: { status: string; count: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold">Distribución por estado</h3>
      <p className="mb-4 text-xs text-muted-foreground">Cómo se reparten tus citas según su estado.</p>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin citas en el período.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Pie */}
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  animationDuration={800}
                >
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  const percent = Math.round((item.count / total) * 100);
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm font-semibold">{item.status}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {item.count} citas · <span className="font-bold" style={{ color: item.color }}>{percent}%</span>
                      </div>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="text-xl font-bold tabular-nums">{total}</div>
            </div>
          </div>

          {/* Leyenda detallada */}
          <ul className="space-y-2">
            {data.map((item) => {
              const percent = Math.round((item.count / total) * 100);
              return (
                <li key={item.status} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="flex-1 text-sm font-semibold">{item.status}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums" style={{ color: item.color }}>
                    {percent}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
