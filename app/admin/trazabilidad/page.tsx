'use client';

import { useState } from 'react';
import {
  Activity,
  Eye,
  Play,
  Flag,
  MousePointerClick,
  FileText,
  UserPlus,
  CreditCard,
  Clock,
  TrendingDown,
  RefreshCw,
  Loader2,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useTrazabilidad } from '@/hooks/use-trazabilidad';
import { useAdminEmbajadores } from '@/hooks/use-admin-embajadores';
import { PaidAcquisition } from '@/components/admin/paid-acquisition';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// Trazabilidad — Embudo de adquisición de VYLTA en tiempo real (CEO)
//
// Fuente: public.funnel_events (experiencia + páginas de giro) vía RPC
// funnel_trazabilidad. Realtime por Supabase. Cruza con registros y pagos.
// ═══════════════════════════════════════════════════════════════════════

const RANGES = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
];

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString('es-MX');
}

function dur(seconds: number) {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function TrazabilidadPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch, isFetching } = useTrazabilidad(days);

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-vylta-bone">
            Trazabilidad de clientes
          </h1>
          <p className="mt-1 text-sm text-vylta-muted">
            Adquisición en tiempo real: redes (Facebook + Google), experiencia y embajadores.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 rounded-lg border border-vylta-green/30 bg-vylta-green/10 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vylta-green opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-vylta-green" />
            </span>
            <span className="text-sm font-bold text-vylta-green">
              {fmt(data?.live ?? 0)} en vivo
            </span>
          </div>

          {/* Range selector */}
          <div className="inline-flex overflow-hidden rounded-lg border border-border">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  'px-3 py-2 text-sm font-semibold transition-colors',
                  days === r.days
                    ? 'bg-vylta-gold/15 text-vylta-gold'
                    : 'bg-vylta-card/40 text-vylta-muted hover:text-vylta-bone',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-vylta-card/40 px-3 py-2 text-sm font-semibold text-vylta-muted transition hover:text-vylta-bone"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Adquisición por redes (paid: FB + Google) — lo primero para el CEO */}
      <PaidAcquisition days={days} />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-vylta-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando embudo…
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl border border-vylta-rose/30 bg-vylta-rose/5 p-6 text-center text-sm text-vylta-rose">
          No se pudo cargar el embudo. ¿Tu usuario está en <code>vylta_admins</code>?
        </div>
      ) : (
        <Dashboard data={data} />
      )}
    </div>
  );
}

function Dashboard({ data }: { data: NonNullable<ReturnType<typeof useTrazabilidad>['data']> }) {
  // Embudo web (eventos de la experiencia + giro)
  const steps = [
    { key: 'entered', label: 'Entraron a la experiencia', value: data.entered, icon: Eye },
    { key: 'started', label: 'Tocaron "Empezar"', value: data.started, icon: Play },
    { key: 'finished', label: 'Terminaron la experiencia', value: data.finished, icon: Flag },
    { key: 'cta', label: 'Clic "Activar VYLTA"', value: data.cta, icon: MousePointerClick },
    { key: 'giro_view', label: 'Llegaron a página de giro', value: data.giro_view, icon: FileText },
    { key: 'reg_click', label: 'Clic en registrarse', value: data.reg_click, icon: UserPlus },
  ];
  const top = steps[0].value || 0;

  // Mayor fuga (drop-off entre pasos consecutivos)
  let worstIdx = -1;
  let worstDrop = -1;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].value;
    if (prev > 0) {
      const drop = prev - steps[i].value;
      if (drop > worstDrop) {
        worstDrop = drop;
        worstIdx = i;
      }
    }
  }

  const sceneData = (data.scenes || []).map((s) => ({
    name: `E${s.scene}`,
    sessions: s.sessions,
  }));

  // Embajadores — registros por persona (RPC admin_get_embajadores, ya existente).
  const { data: embajadores = [] } = useAdminEmbajadores();
  const embRows = [...embajadores].sort((a, b) => (b.clientes_total || 0) - (a.clientes_total || 0));
  const embRegistrados = embajadores.reduce((s, e) => s + (e.clientes_total || 0), 0);
  const embNuevosMes = embajadores.reduce((s, e) => s + (e.nuevos_mes || 0), 0);

  return (
    <div className="space-y-7">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Entraron" value={fmt(data.entered)} icon={Eye} accent="sky" />
        <Kpi
          label="Empezaron"
          value={`${pct(data.started, data.entered)}%`}
          sub={fmt(data.started)}
          icon={Play}
          accent="sky"
        />
        <Kpi
          label="Terminaron"
          value={`${pct(data.finished, data.entered)}%`}
          sub={fmt(data.finished)}
          icon={Flag}
          accent="gold"
        />
        <Kpi
          label="Clic CTA"
          value={`${pct(data.cta, data.entered)}%`}
          sub={fmt(data.cta)}
          icon={MousePointerClick}
          accent="gold"
        />
        <Kpi label="Registrados" value={fmt(data.registered)} sub="en el periodo" icon={UserPlus} accent="green" />
        <Kpi label="Pagaron" value={fmt(data.paid_new)} sub={`${fmt(data.paid_total)} total`} icon={CreditCard} accent="green" />
      </div>

      {/* Embudo web */}
      <section className="rounded-2xl border border-border bg-vylta-surface p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-vylta-bone">Embudo de la experiencia</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-vylta-muted">
            <Clock className="h-3.5 w-3.5" /> Tiempo promedio dentro: <b className="text-vylta-bone">{dur(data.avg_seconds)}</b>
          </span>
        </div>

        <div className="space-y-2.5">
          {steps.map((s, i) => {
            const widthPct = top ? Math.max(2, (s.value / top) * 100) : 0;
            const ofTop = pct(s.value, top);
            const prev = i > 0 ? steps[i - 1].value : null;
            const dropPct = prev && prev > 0 ? Math.round((1 - s.value / prev) * 100) : null;
            const isLeak = i === worstIdx && worstDrop > 0;
            const Icon = s.icon;
            return (
              <div key={s.key} className="group">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-vylta-bone">
                    <Icon className="h-4 w-4 text-vylta-muted" />
                    {s.label}
                  </span>
                  <span className="flex items-center gap-3">
                    {dropPct !== null && dropPct > 0 && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          isLeak ? 'font-bold text-vylta-rose' : 'text-vylta-muted',
                        )}
                      >
                        <TrendingDown className="h-3 w-3" />
                        -{dropPct}%
                      </span>
                    )}
                    <span className="tabular-nums font-bold text-vylta-bone">{fmt(s.value)}</span>
                    <span className="tabular-nums text-xs text-vylta-muted w-12 text-right">{ofTop}%</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-vylta-card/60">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isLeak ? 'bg-vylta-rose' : 'bg-gradient-to-r from-vylta-green to-vylta-sky',
                    )}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {worstIdx > 0 && worstDrop > 0 && (
          <div className="mt-4 rounded-lg border border-vylta-rose/25 bg-vylta-rose/5 px-4 py-3 text-sm text-vylta-bone">
            🔴 <b>Mayor fuga:</b> entre “{steps[worstIdx - 1].label}” y “{steps[worstIdx].label}” se pierden{' '}
            <b className="text-vylta-rose">{fmt(worstDrop)}</b> personas. Ahí conviene optimizar primero.
          </div>
        )}

        <p className="mt-3 text-xs text-vylta-subtle">
          Registrados y pagados son conteos del periodo (aún no atados 1:1 a cada sesión — fase 2: enlazar sesión → registro).
        </p>
      </section>

      {/* Dónde abandonan (escena por escena) */}
      <section className="rounded-2xl border border-border bg-vylta-surface p-5 md:p-6">
        <h2 className="mb-1 text-lg font-bold text-vylta-bone">Dónde abandonan (escena por escena)</h2>
        <p className="mb-4 text-sm text-vylta-muted">
          Cuántas personas llegaron a cada escena de la experiencia. La caída marca dónde se van.
        </p>
        {sceneData.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sceneData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: '#0f1424',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#f1f5f9',
                }}
                formatter={(v: number) => [fmt(v), 'Sesiones']}
              />
              <Bar dataKey="sessions" radius={[6, 6, 0, 0]}>
                {sceneData.map((_, i) => (
                  <Cell key={i} fill="url(#sceneGrad)" />
                ))}
              </Bar>
              <defs>
                <linearGradient id="sceneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Por giro + por origen */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BreakdownCard title="Por giro (clic en CTA)" rows={data.by_giro.map((g) => ({ label: g.giro, value: g.sessions }))} />
        <BreakdownCard title="Por origen del tráfico" rows={data.by_source.map((s) => ({ label: s.source, value: s.sessions }))} />
      </div>

      {/* Fase 2 — clientes atribuidos al embudo */}
      <section className="rounded-2xl border border-vylta-green/25 bg-vylta-green/5 p-5 md:p-6">
        <h2 className="text-lg font-bold text-vylta-bone">💳 Clientes atribuidos al embudo</h2>
        <p className="mt-1 mb-4 text-sm text-vylta-muted">
          Registros y pagos que vinieron específicamente de la experiencia (sesión enlazada al cliente). Esto es lo que define dónde invertir.
        </p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Kpi label="Registrados del embudo" value={fmt(data.attr_registered)} icon={UserPlus} accent="green" />
          <Kpi label="Pagaron del embudo" value={fmt(data.attr_paid)} icon={CreditCard} accent="green" />
          <Kpi
            label="Conversión visitante→pago"
            value={`${pct(data.attr_paid, data.entered)}%`}
            sub={`${fmt(data.attr_paid)} de ${fmt(data.entered)}`}
            icon={Activity}
            accent="gold"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BreakdownCard
            title="Clientes que PAGAN — por origen real"
            rows={data.paid_by_source.map((s) => ({ label: s.source, value: s.customers }))}
          />
          <BreakdownCard
            title="Clientes que PAGAN — por giro"
            rows={data.paid_by_giro.map((g) => ({ label: g.giro, value: g.customers }))}
          />
        </div>

        <p className="mt-3 text-xs text-vylta-subtle">
          Cuenta solo registros que llegaron por el enlace de la experiencia (con sesión enlazada). Se puebla con el tráfico nuevo desde hoy.
        </p>
      </section>

      {/* Embajadores — registros por persona */}
      <section className="rounded-2xl border border-vylta-sky/25 bg-vylta-sky/5 p-5 md:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-vylta-sky" />
          <h2 className="text-lg font-bold text-vylta-bone">Embajadores — registros por persona</h2>
        </div>
        <p className="mb-4 text-sm text-vylta-muted">
          Cuántos negocios registró cada embajador con su código (aplicado en el alta). El detalle de comisiones y accesos está en la pestaña <b>Embajadores</b>.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <Kpi label="Embajadores" value={fmt(embajadores.length)} icon={Users} accent="sky" />
          <Kpi label="Registrados (total)" value={fmt(embRegistrados)} icon={UserPlus} accent="green" />
          <Kpi label="Nuevos este mes" value={fmt(embNuevosMes)} icon={UserPlus} accent="gold" />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-vylta-card/40 text-left text-xs uppercase tracking-wide text-vylta-muted">
                <th className="px-4 py-2.5 font-semibold">Embajador</th>
                <th className="px-3 py-2.5 text-right font-semibold">Registrados</th>
                <th className="px-3 py-2.5 text-right font-semibold">De pago</th>
                <th className="px-4 py-2.5 text-right font-semibold">Nuevos mes</th>
              </tr>
            </thead>
            <tbody>
              {embRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-vylta-muted">
                    Aún no hay embajadores. Créalos en la pestaña Embajadores.
                  </td>
                </tr>
              ) : (
                embRows.map((e) => (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="px-4 py-2.5 text-vylta-bone">
                      {e.nombre} <span className="text-xs text-vylta-muted">· {e.ref_code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-vylta-bone">{fmt(e.clientes_total)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-vylta-green">{fmt(e.clientes_activos)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-vylta-bone">{fmt(e.nuevos_mes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-vylta-subtle">
          “Registrados” = negocios dados de alta con el código del embajador (business_profiles.referido_por). “De pago” = los que tienen plan activo de pago. Se actualiza en vivo.
        </p>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  accent: 'green' | 'gold' | 'sky';
}) {
  const color = {
    green: 'text-vylta-green bg-vylta-green/10',
    gold: 'text-vylta-gold bg-vylta-gold/10',
    sky: 'text-vylta-sky bg-vylta-sky/10',
  }[accent];
  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-vylta-muted">{label}</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', color)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-vylta-bone">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-vylta-subtle">{sub}</div>}
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-2xl border border-border bg-vylta-surface p-5 md:p-6">
      <h2 className="mb-4 text-lg font-bold text-vylta-bone">{title}</h2>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="capitalize text-vylta-bone">{r.label}</span>
                <span className="tabular-nums font-bold text-vylta-bone">{fmt(r.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-vylta-card/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-vylta-green to-vylta-sky"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Empty() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-vylta-subtle">
      <Activity className="h-6 w-6 opacity-50" />
      <span className="text-sm">Aún no hay datos en este periodo.</span>
    </div>
  );
}
