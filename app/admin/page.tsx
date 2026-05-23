'use client';

import {
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  Activity,
  Crown,
  Gem,
  Loader2,
  Ticket,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  UserPlus,
  Wallet,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { MexicoHeatmap } from '@/components/admin/mexico-heatmap';
import { PerformanceGauges } from '@/components/admin/performance-gauges';
import { VendorPaymentsTable } from '@/components/admin/vendor-payments-table';
import { PlanMixDonut } from '@/components/admin/plan-mix-donut';
import { UserSupportPanel } from '@/components/admin/user-support-panel';
import { KpiCardWithSparkline } from '@/components/admin/kpi-card-with-sparkline';

// ═══════════════════════════════════════════════════════════════════════
// Control Center v4 — Refactor para eliminar redundancias (May 22 2026)
//
// ANTONIO PIDIÓ:
//   "hay cosas en las que necesito un mayor detalle no el numero grueso
//    de resultado, por ejemplo: Tengo un dashboard al inicio que dice
//    Negocios 17 y tengo abajo una grafica que dice Nuevos negocios
//    (8 semanas). ambos recuadros me los puedes juntar en uno solo.
//    quiero algo ejecutivo a nivel direccion."
//
// CAMBIOS:
//   1️⃣ Cards consolidados: KPI numerico + mini sparkline en mismo card
//      • Negocios + serie 8 semanas → 1 card
//      • Citas 14d + serie diaria → 1 card
//
//   2️⃣ Eliminadas graficas duplicadas redundantes
//
//   3️⃣ Layout reorganizado para sentirse ejecutivo:
//      - Fila 1: 4 KPIs consolidados con sparklines
//      - Fila 2: Mapa de calor (con botón expandir)
//      - Fila 3: Performance gauges
//      - Fila 4: MRR Hero + Plan Mix donut + Indicadores (en triple grid)
//      - Fila 5: Pagos a proveedores (tabla con tipografia grande)
//      - Fila 6: Soporte usuarios
//      - Fila 7: Quick actions
// ═══════════════════════════════════════════════════════════════════════

export default function AdminDashboardPage() {
  const { data, isLoading, isFetching, refetch } = useAdminDashboard();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-vylta-muted">
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

  // Calcular deltas para los cards consolidados
  const lastWeekValue = data.weeklyNegocios[data.weeklyNegocios.length - 2]?.value || 0;
  const thisWeekValue = data.weeklyNegocios[data.weeklyNegocios.length - 1]?.value || 0;
  const negociosDelta = thisWeekValue - lastWeekValue;
  const negociosDeltaDir: 'up' | 'down' | 'flat' =
    negociosDelta > 0 ? 'up' : negociosDelta < 0 ? 'down' : 'flat';

  const yesterdayCitas = data.dailyCitas[data.dailyCitas.length - 2]?.value || 0;
  const todayCitas = data.dailyCitas[data.dailyCitas.length - 1]?.value || 0;
  const citasDelta = todayCitas - yesterdayCitas;
  const citasDeltaDir: 'up' | 'down' | 'flat' =
    citasDelta > 0 ? 'up' : citasDelta < 0 ? 'down' : 'flat';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-vylta-gold/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vylta-gold" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-vylta-gold">
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
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          {isFetching ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* ═══ 4 KPIs EJECUTIVOS CONSOLIDADOS (con sparklines) ═══ */}
      <section>
        <SectionHeader label="Vista global del negocio" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCardWithSparkline
            label="Negocios"
            value={data.totalTenants}
            hint="Suscritos a VYLTA"
            Icon={Building2}
            accent="green"
            href="/admin/tenants"
            series={data.weeklyNegocios}
            deltaLabel={negociosDelta !== 0 ? `${negociosDelta > 0 ? '+' : ''}${negociosDelta} esta semana` : 'sin cambios'}
            deltaDirection={negociosDeltaDir}
          />
          <KpiCardWithSparkline
            label="Clientes finales"
            value={data.totalClients}
            hint="Capturados por los negocios"
            Icon={Users}
            accent="luxury"
          />
          <KpiCardWithSparkline
            label="Suscriptores"
            value={data.activeSubscribers}
            hint="Planes pagados activos"
            Icon={Sparkles}
            accent="gold"
            pulse
          />
          <KpiCardWithSparkline
            label="Citas 14 días"
            value={data.last14DaysAppointments}
            hint="Reservaciones recientes"
            Icon={CalendarCheck}
            accent="blue"
            series={data.dailyCitas}
            deltaLabel={citasDelta !== 0 ? `${citasDelta > 0 ? '+' : ''}${citasDelta} vs ayer` : 'sin cambios'}
            deltaDirection={citasDeltaDir}
          />
        </div>
      </section>

      {/* ═══ MAPA DE CALOR (con botón expandir) ═══ */}
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

      {/* ═══ PERFORMANCE GAUGES ═══ */}
      <section>
        <PerformanceGauges />
      </section>

      {/* ═══ SALUD FINANCIERA: MRR HERO + DONUT + INDICADORES ═══ */}
      <section>
        <SectionHeader label="Salud financiera" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1.2fr]">
          {/* MRR HERO */}
          <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/30 bg-vylta-surface p-7 shadow-card-lg">
            <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-vylta-gold/10 blur-[80px]" />
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.08]" />

            <div className="relative flex flex-col gap-5 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-vylta-gold" />
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-gold">
                    Ingresos Recurrentes Mensuales
                  </span>
                </div>
                <span className="text-xs text-vylta-muted tabular-nums">
                  {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div>
                <div className="text-7xl font-bold tabular-nums tracking-tightest text-vylta-gold">
                  ${data.mrr.toLocaleString('es-MX')}
                </div>
                <div className="mt-2 text-sm text-vylta-muted font-semibold">MXN / mes</div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-border pt-5 mt-auto">
                <PlanCount label="Premium" count={data.basicCount} price={399} color="text-vylta-green" Icon={Gem} />
                <PlanCount label="Luxury" count={data.premiumCount} price={799} color="text-vylta-luxury" Icon={Crown} />
                <PlanCount label="Básico" count={data.gratuitoCount} price={0} color="text-vylta-subtle" Icon={Users} />
              </div>
            </div>
          </div>

          {/* DONUT */}
          <PlanMixDonut
            premiumCount={data.basicCount}
            luxuryCount={data.premiumCount}
            basicoCount={data.gratuitoCount}
          />
        </div>
      </section>

      {/* ═══ INDICADORES OPERACIONALES ═══ */}
      <section>
        <SectionHeader label="Indicadores operacionales" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MiniKpi label="Activos 30d" value={data.activeTenants} hint="Con sesión reciente" Icon={Activity} accent="blue" />
          <MiniKpi label="Retención" value={`${data.retentionRate}%`} hint="Activos / Total" Icon={TrendingUp} accent="gold" />
          <MiniKpi label="Citas mes" value={data.monthAppointments} hint={`Histórico: ${data.totalAppointments}`} Icon={CalendarCheck} accent="luxury" />
        </div>
      </section>

      {/* ═══ PAGOS A PROVEEDORES — tipografia grande ═══ */}
      <section>
        <SectionHeader label="Pagos a proveedores" />
        <VendorPaymentsTable />
      </section>

      {/* ═══ SOPORTE A USUARIOS ═══ */}
      <section>
        <SectionHeader label="Soporte a usuarios" />
        <UserSupportPanel />
      </section>

      {/* ═══ ACCIONES RÁPIDAS ═══ */}
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
    <div className="mb-4 flex items-center gap-2">
      <div className="h-px w-5 bg-vylta-gold/40" />
      <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">{label}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function PlanCount({ label, count, price, color, Icon }: { label: string; count: number; price: number; color: string; Icon: any; }) {
  return (
    <div className="text-center">
      <Icon className={cn('mx-auto h-5 w-5 mb-2', color)} />
      <div className={cn('text-3xl font-bold tabular-nums', color)}>{count}</div>
      <div className="text-xs font-bold uppercase tracking-wider text-vylta-muted mt-1">{label}</div>
      <div className="text-xs text-vylta-subtle mt-0.5 tabular-nums">
        {price > 0 ? `$${price}/mes` : 'Gratis'}
      </div>
    </div>
  );
}

function MiniKpi({
  label, value, hint, Icon, accent,
}: {
  label: string; value: number | string; hint: string; Icon: any;
  accent: 'green' | 'blue' | 'gold' | 'luxury';
}) {
  const colorMap = {
    green: { text: 'text-vylta-green', halo: '#10B981' },
    blue: { text: 'text-vylta-sky', halo: '#0EA5E9' },
    gold: { text: 'text-vylta-gold', halo: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
  }[accent];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card transition-all hover:border-vylta-gold/30">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-25"
        style={{ background: colorMap.halo }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className={cn('mt-3 text-3xl font-bold tabular-nums tracking-tightest', colorMap.text)}>{value}</div>
        <div className="mt-1 text-sm text-vylta-muted">{hint}</div>
      </div>
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
            <h3 className="text-base font-bold">{title}</h3>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-sm text-vylta-muted mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
