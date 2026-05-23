'use client';

import Link from 'next/link';
import {
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  Activity,
  Crown,
  Gem,
  Coins,
  ArrowRight,
  Loader2,
  Ticket,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { MexicoHeatmap } from '@/components/admin/mexico-heatmap';
import { PerformanceGauges } from '@/components/admin/performance-gauges';
import { VendorPaymentsTable } from '@/components/admin/vendor-payments-table';
import { PlanMixDonut } from '@/components/admin/plan-mix-donut';
import { UserSupportPanel } from '@/components/admin/user-support-panel';

// ═══════════════════════════════════════════════════════════════════════
// Control Center Dashboard — VYLTA Admin (FASE 2 COMPLETA May 22 2026)
//
// ESTRUCTURA VISUAL (de arriba hacia abajo):
//   1. Header con live indicator + boton refresh
//   2. KPI top: 4 metricas core (Clientes, Suscriptores, Citas 14d, Nuevos)
//   3. MAPA DE MÉXICO HEATMAP — signature feature
//   4. Performance gauges (4): DB Load, Storage, Response Time, Realtime
//   5. Hero MRR + breakdown de planes
//   6. Plan Mix Donut + Indicadores operacionales
//   7. Charts: 14d citas + 8 semanas negocios
//   8. Pagos a proveedores (tabla)
//   9. Soporte a usuarios (buscar + reset password)
//   10. Quick actions a secciones admin
// ═══════════════════════════════════════════════════════════════════════

export default function AdminDashboardPage() {
  const { data, isLoading, isFetching, refetch } = useAdminDashboard();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-vylta-muted">
            Cargando Control Center
          </span>
        </div>
      </div>
    );
  }

  const dateString = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-7 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-vylta-gold/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vylta-gold" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-vylta-gold">
              VYLTA Control Center · LIVE
            </span>
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tightest text-vylta-bone">
            Centro de operaciones
          </h1>
          <p className="text-sm text-vylta-muted mt-1 capitalize">{dateString}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-xs font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          {isFetching ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* 4 KPIs CORE */}
      <section>
        <SectionHeader label="Vista global del negocio" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Clientes" value={data.totalClients} hint="Capturados en VYLTA" Icon={Users} accent="green" />
          <KpiCard label="Suscriptores" value={data.activeSubscribers} hint="Planes pagados activos" Icon={Sparkles} accent="gold" pulse />
          <KpiCard label="Citas 14d" value={data.last14DaysAppointments} hint="Últimos 14 días" Icon={CalendarCheck} accent="luxury" />
          <KpiCard label="Nuevos" value={`+${data.newBusinessesThisWeek}`} hint="Negocios esta semana" Icon={UserPlus} accent="blue" pulse={data.newBusinessesThisWeek > 0} />
        </div>
      </section>

      {/* MAPA DE MÉXICO */}
      <section className="relative overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg">
        <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-vylta-gold/8 blur-[100px]" />
        <div className="relative">
          <MexicoHeatmap
            data={data.stateData}
            onStateClick={(state) => {
              console.log('[ControlCenter] Click en estado:', state);
            }}
          />
        </div>
      </section>

      {/* PERFORMANCE GAUGES — NUEVO Fase 2 */}
      <section>
        <PerformanceGauges />
      </section>

      {/* MRR HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-vylta-gold/30 bg-vylta-surface p-7 shadow-card-lg">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-vylta-gold/10 blur-[80px]" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.08]" />

        <div className="relative flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-vylta-gold" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-gold">
                Ingresos Recurrentes Mensuales
              </span>
            </div>
            <span className="text-[10px] text-vylta-muted tabular-nums">
              {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div>
            <div className="text-7xl font-bold tabular-nums tracking-tightest text-vylta-gold">
              ${data.mrr.toLocaleString('es-MX')}
            </div>
            <div className="mt-2 text-sm text-vylta-muted font-semibold">MXN / mes</div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-5">
            <PlanCount label="Premium" count={data.basicCount} price={399} color="text-vylta-green" Icon={Gem} />
            <PlanCount label="Luxury" count={data.premiumCount} price={799} color="text-vylta-luxury" Icon={Crown} />
            <PlanCount label="Básico" count={data.gratuitoCount} price={0} color="text-vylta-subtle" Icon={Users} />
          </div>
        </div>
      </section>

      {/* PLAN MIX DONUT + INDICADORES OPERACIONALES */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PlanMixDonut
          premiumCount={data.basicCount}
          luxuryCount={data.premiumCount}
          basicoCount={data.gratuitoCount}
        />
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Negocios totales" value={data.totalTenants} hint="Registrados" Icon={Building2} accent="green" href="/admin/tenants" />
          <KpiCard label="Activos 30d" value={data.activeTenants} hint="Con sesión reciente" Icon={Activity} accent="blue" />
          <KpiCard label="Retención" value={`${data.retentionRate}%`} hint="Activos / Total" Icon={TrendingUp} accent="gold" />
          <KpiCard label="Citas mes" value={data.monthAppointments} hint={`Histórico: ${data.totalAppointments}`} Icon={CalendarCheck} accent="luxury" />
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Citas últimos 14 días"
          subtitle={`${data.totalAppointments} citas históricas totales`}
          accentColor="#A78BFA"
          data={data.dailyCitas}
          gradientId="citasGrad"
        />
        <ChartCard
          title="Nuevos negocios (8 semanas)"
          subtitle={`${data.totalTenants} negocios en total`}
          accentColor="#10B981"
          data={data.weeklyNegocios}
          gradientId="negociosGrad"
        />
      </div>

      {/* PAGOS A PROVEEDORES — NUEVO Fase 2 */}
      <section>
        <VendorPaymentsTable />
      </section>

      {/* SOPORTE A USUARIOS — NUEVO Fase 3 */}
      <section>
        <UserSupportPanel />
      </section>

      {/* QUICK ACTIONS */}
      <section>
        <SectionHeader label="Acciones rápidas" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard href="/admin/tenants" Icon={Building2} title="Negocios" description="Ver y administrar todos los negocios registrados" color="green" />
          <ActionCard href="/admin/promo-codes" Icon={Ticket} title="Códigos promo" description="Crear y administrar códigos de descuento" color="gold" />
          <ActionCard href="/admin/admins" Icon={ShieldCheck} title="Administradores" description="Gestionar usuarios con acceso al Control Center" color="luxury" />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-px w-5 bg-vylta-gold/40" />
      <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-muted">{label}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function PlanCount({ label, count, price, color, Icon }: { label: string; count: number; price: number; color: string; Icon: any; }) {
  return (
    <div className="text-center">
      <Icon className={cn('mx-auto h-4 w-4 mb-1.5', color)} />
      <div className={cn('text-3xl font-bold tabular-nums', color)}>{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-muted mt-1">{label}</div>
      <div className="text-[10px] text-vylta-subtle mt-0.5 tabular-nums">
        {price > 0 ? `$${price}/mes` : 'Gratis'}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, Icon, accent, pulse, href,
}: {
  label: string; value: number | string; hint: string; Icon: any;
  accent: 'green' | 'blue' | 'gold' | 'luxury'; pulse?: boolean; href?: string;
}) {
  const colorMap = {
    green: { text: 'text-vylta-green', halo: '#10B981' },
    blue: { text: 'text-vylta-sky', halo: '#0EA5E9' },
    gold: { text: 'text-vylta-gold', halo: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
  }[accent];

  const inner = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card transition-all hover:border-vylta-gold/30 hover:-translate-y-0.5">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-25 transition-opacity group-hover:opacity-40"
        style={{ background: colorMap.halo }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className={cn('text-3xl font-bold tabular-nums tracking-tightest', colorMap.text)}>{value}</div>
          {pulse && (
            <span className="relative flex h-2 w-2 mt-2">
              <span className="absolute inset-0 animate-ping rounded-full opacity-50" style={{ background: colorMap.halo }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: colorMap.halo }} />
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-vylta-muted">{hint}</div>
        {href && (
          <div className="mt-2 text-[10px] font-bold text-vylta-muted group-hover:text-vylta-bone flex items-center gap-0.5">
            Ver detalle <ArrowRight className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href} prefetch>{inner}</Link> : inner;
}

function ChartCard({ title, subtitle, accentColor, data, gradientId }: {
  title: string; subtitle: string; accentColor: string;
  data: { label: string; value: number }[]; gradientId: string;
}) {
  const W = 460;
  const H = 160;
  const pad = 16;

  const max = Math.max(...data.map((d) => d.value), 1);
  const step = (W - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => ({
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
  const activePts = pts.filter((p) => p.v > 0);

  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
      <div className="mb-4 flex items-start gap-2">
        <div className="w-0.5 h-10 rounded-full" style={{ backgroundColor: accentColor }} />
        <div>
          <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
          <p className="text-[11px] text-vylta-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
            <stop offset="70%" stopColor={accentColor} stopOpacity={0.05} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <line x1={pad} y1={H} x2={W - pad} y2={H} stroke="#334155" strokeWidth={0.5} />
        <path d={linePath} stroke={accentColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {activePts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#0A0E1A" stroke={accentColor} strokeWidth={1.5} />
            <text x={p.x} y={p.y - 8} fontSize={9} fill={accentColor} textAnchor="middle" fontWeight="bold">{p.v}</text>
          </g>
        ))}
        {pts.filter((_, i) => i % 2 === 0).map((p, i) => (
          <text key={`l-${i}`} x={p.x} y={H + 14} fontSize={8} fill="#64748B" textAnchor="middle">{p.label}</text>
        ))}
      </svg>
    </div>
  );
}

function ActionCard({ href, Icon, title, description, color }: {
  href: string; Icon: any; title: string; description: string;
  color: 'green' | 'gold' | 'luxury';
}) {
  const colorMap = {
    green: 'text-vylta-green border-vylta-green/30 bg-vylta-green/5 hover:bg-vylta-green/10',
    gold: 'text-vylta-gold border-vylta-gold/30 bg-vylta-gold/5 hover:bg-vylta-gold/10',
    luxury: 'text-vylta-luxury border-vylta-luxury/30 bg-vylta-luxury/5 hover:bg-vylta-luxury/10',
  }[color];

  return (
    <Link href={href} prefetch className={cn('group relative overflow-hidden rounded-xl border p-5 shadow-card transition-all hover:-translate-y-0.5', colorMap)}>
      <div className="flex items-start gap-3">
        <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold">{title}</h3>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-[11px] text-vylta-muted mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
