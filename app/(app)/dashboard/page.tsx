'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  Clock,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Cake,
  UserX,
  CheckCircle2,
  Phone,
  Sparkles,
  Link2,
  Wallet,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import type { TodayAppointment } from '@/lib/home-stats';
import { cn, formatCurrency } from '@/lib/utils';
import { formatShortDate, MONTHS_ES, DAYS_ES_FULL } from '@/lib/date-utils';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { UnpaidList } from '@/components/dashboard/unpaid-list';
import { PlanUsageBanner } from '@/components/dashboard/plan-usage-banner';
import { useHomeStats } from '@/lib/queries/use-home-stats';
import DashboardLoading from './loading';

// ══════════════════════════════════════════════════════════════════════
// Dashboard premium — v2 con React Query (Client Component)
//
// Mejoras vs v1:
//   • 1ra visita: igual de rápida (~600ms con skeleton)
//   • 2da+ visita: INSTANTÁNEA desde cache (< 30ms)
//   • Volver a la pestaña refresca silenciosamente en background
//   • Cambios desde móvil aparecen automáticamente vía Realtime
//   • Saludo personalizado pulled del user de Supabase client-side
// ══════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { data: stats, isLoading } = useHomeStats();
  const [firstName, setFirstName] = useState('');

  // Obtener el firstName del usuario una sola vez al montar
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      // Intentar business_profile primero, fallback a metadata, fallback a email
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const name =
        user.user_metadata?.full_name?.split(' ')[0] ||
        profile?.business_name?.split(' ')[0] ||
        user.email?.split('@')[0] ||
        '';
      setFirstName(name);
    });
  }, []);

  // Mientras carga la 1ra vez, mostrar el skeleton (igual que loading.tsx)
  if (isLoading || !stats) {
    return <DashboardLoading />;
  }

  const now = new Date();
  const todayLabel = `${DAYS_ES_FULL[(now.getDay() === 0 ? 6 : now.getDay() - 1)]} ${now.getDate()} de ${MONTHS_ES[now.getMonth()].toLowerCase()}`;
  const hasUrgentAlerts = stats.tomorrowUnconfirmed > 0 || stats.pendingRequests > 0;

  return (
    <div className="space-y-7 animate-fade-in">
      {/* HERO */}
      <Hero
        greeting={greet()}
        firstName={firstName}
        todayLabel={todayLabel}
        todayCount={stats.todayCount}
        todayRevenue={stats.todayRevenue}
        todayConfirmed={stats.todayConfirmed}
        todayPending={stats.todayPending}
      />

      {stats.planUsage.isGratuito && <PlanUsageBanner usage={stats.planUsage} />}

      {/* COBROS PENDIENTES */}
      {stats.unpaidAppointments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-vylta-amber/30 bg-vylta-surface shadow-card-lg relative">
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-vylta-amber/10 blur-3xl" />
          <div className="relative flex items-center justify-between p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-vylta-amber/50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-vylta-amber" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-amber">Por cobrar</span>
              </div>
              <div className="mt-3 text-5xl font-bold tabular-nums tracking-tightest text-vylta-bone">
                {formatCurrency(stats.unpaidTotal)}
              </div>
              <p className="mt-1.5 text-sm text-vylta-muted">
                {stats.unpaidAppointments.length} {stats.unpaidAppointments.length === 1 ? 'cita pendiente' : 'citas pendientes'} de cobro
              </p>
            </div>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-vylta-amber/10 ring-1 ring-vylta-amber/20">
              <Wallet className="h-10 w-10 text-vylta-amber" strokeWidth={1.5} />
            </div>
          </div>
          <UnpaidList appointments={stats.unpaidAppointments} />
        </div>
      )}

      {/* SOLICITUDES LINK PÚBLICO */}
      {stats.pendingRequests > 0 && (
        <Link
          href="/citas"
          className="group flex items-center gap-4 rounded-xl border border-vylta-luxury/30 bg-vylta-surface px-5 py-4 transition-all hover:border-vylta-luxury/50 hover:shadow-luxury"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vylta-luxury/15 text-vylta-luxury ring-1 ring-vylta-luxury/20">
            <Link2 className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-vylta-bone">
              {stats.pendingRequests} {stats.pendingRequests === 1 ? 'solicitud nueva' : 'solicitudes nuevas'} desde tu link público
            </div>
            <div className="text-xs text-vylta-muted mt-0.5">
              Toca para revisarlas y aceptar o rechazar
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-vylta-luxury transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* KPIs DE HOY */}
      <section>
        <SectionHeader icon={Sparkles} label="Hoy" iconColor="text-vylta-green" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Citas hoy" value={`${stats.todayCount}`} icon={CalendarCheck} accent="green" sub={stats.todayCount > 0 ? `${stats.todayConfirmed} confirmadas` : 'Día libre'} />
          <StatCard label="Pendientes" value={`${stats.todayPending}`} icon={Clock} accent="amber" sub={stats.todayPending > 0 ? 'Por confirmar' : 'Todas listas'} />
          <StatCard label="Cobrado hoy" value={formatCurrency(stats.todayRevenue)} icon={DollarSign} accent="green" sub={`${stats.todayPaidCount} ${stats.todayPaidCount === 1 ? 'cita pagada' : 'citas pagadas'}`} />
          <StatCard label="Mañana" value={`${stats.tomorrowCount}`} icon={CalendarCheck} accent={stats.tomorrowUnconfirmed > 0 ? 'amber' : 'green'} sub={stats.tomorrowUnconfirmed > 0 ? `${stats.tomorrowUnconfirmed} sin confirmar` : 'Todo en orden'} />
        </div>
      </section>

      {/* KPIs DE ESTA SEMANA */}
      <section>
        <SectionHeader icon={TrendingUp} label="Esta semana" iconColor="text-vylta-luxury" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Citas semana" value={`${stats.weekCount}`} icon={CalendarCheck} accent="luxury" sub={stats.weekCount > 0 ? 'En total' : 'Sin actividad'} />
          <StatCard label="Confirmadas" value={`${stats.weekConfirmed}`} icon={CheckCircle2} accent="green" sub="Lock-in" />
          <StatCard label="Pendientes" value={`${stats.weekPending}`} icon={Clock} accent="amber" sub={stats.weekPending > 0 ? 'Por gestionar' : 'Todas listas'} />
          <StatCard label="Cobrado" value={formatCurrency(stats.weekRevenue)} icon={DollarSign} accent="green" sub="Esta semana" />
        </div>
      </section>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            icon={CalendarCheck}
            title="Agenda de hoy"
            count={stats.upcomingToday.length}
            action={
              <Link
                href="/citas"
                className="inline-flex items-center gap-1 text-xs font-semibold text-vylta-green hover:text-vylta-green-light transition-colors"
              >
                Ver calendario
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {stats.upcomingToday.length === 0 ? <EmptyDay /> : (
              <ul className="divide-y divide-border">
                {stats.upcomingToday.map((apt) => <AppointmentRow key={apt.id} apt={apt} showDate={false} />)}
              </ul>
            )}
          </Section>

          {stats.upcomingFuture.length > 0 && (
            <Section icon={Clock} title="Próximas citas" count={stats.upcomingFuture.length}>
              <ul className="divide-y divide-border">
                {stats.upcomingFuture.map((apt) => <AppointmentRow key={apt.id} apt={apt} showDate={true} />)}
              </ul>
            </Section>
          )}

          <div className="relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
            <div className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-vylta-green/8 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 text-vylta-green ring-1 ring-vylta-green/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-vylta-bone">Resumen de {stats.monthLabel}</h3>
                <p className="text-xs text-vylta-muted mt-0.5">
                  Llevas <span className="font-bold text-vylta-bone tabular-nums">{formatCurrency(stats.monthRevenue)}</span> cobrados en <span className="font-bold text-vylta-bone tabular-nums">{stats.monthAppointments}</span> citas este mes.
                </p>
              </div>
              <Link href="/reportes" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-vylta-green/10 px-3 py-2 text-xs font-bold text-vylta-green transition hover:bg-vylta-green/20">
                Ver análisis
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* SIDEBAR DERECHA */}
        <aside className="space-y-4">
          {stats.tomorrowUnconfirmed > 0 && (
            <AlertCard variant="warning" icon={AlertTriangle} title={`${stats.tomorrowUnconfirmed} ${stats.tomorrowUnconfirmed === 1 ? 'cita mañana' : 'citas mañana'} sin confirmar`} description="Confírmalas para reducir no-shows." actionLabel="Ver citas" actionHref="/citas" />
          )}

          {stats.upcomingBirthdays.length > 0 && (
            <SidebarCard icon={Cake} iconColor="text-vylta-rose" iconBg="bg-vylta-rose/10" iconRing="ring-vylta-rose/20" title="Cumpleaños esta semana" badge={stats.upcomingBirthdays.length} badgeClass="bg-vylta-rose/15 text-vylta-rose">
              <ul className="space-y-2.5">
                {stats.upcomingBirthdays.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-vylta-bone">{c.name}</div>
                      <div className="text-[11px] text-vylta-muted mt-0.5">
                        {c.daysUntil === 0 ? '🎉 ¡Hoy!' : c.daysUntil === 1 ? 'Mañana' : `En ${c.daysUntil} días`}
                      </div>
                    </div>
                    {c.phone && (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vylta-whatsapp/15 text-vylta-whatsapp transition hover:bg-vylta-whatsapp/25" title="Felicitar por WhatsApp">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </SidebarCard>
          )}

          {stats.inactiveClients.length > 0 && (
            <SidebarCard icon={UserX} iconColor="text-vylta-amber" iconBg="bg-vylta-amber/10" iconRing="ring-vylta-amber/20" title="Clientes inactivos" action={
              <Link href="/clientes/inactivos" className="text-[10px] font-semibold text-vylta-green hover:text-vylta-green-light transition-colors">Ver todos</Link>
            }>
              <p className="mb-3 text-[11px] text-vylta-muted">Sin visita hace 60+ días. ¡Ideal para reenganchar!</p>
              <ul className="space-y-2.5">
                {stats.inactiveClients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-vylta-bone">{c.name}</div>
                      <div className="text-[11px] text-vylta-muted mt-0.5">Hace {c.daysSinceLastVisit} días</div>
                    </div>
                    {c.phone && (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vylta-whatsapp/15 text-vylta-whatsapp transition hover:bg-vylta-whatsapp/25" title="Contactar por WhatsApp">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </SidebarCard>
          )}

          {!hasUrgentAlerts && stats.upcomingBirthdays.length === 0 && stats.inactiveClients.length === 0 && stats.unpaidAppointments.length === 0 && (
            <div className="relative overflow-hidden rounded-xl border border-vylta-green/25 bg-vylta-surface p-6 text-center">
              <div className="pointer-events-none absolute inset-0 bg-vylta-green/5" />
              <div className="relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-vylta-green/10 ring-1 ring-vylta-green/20">
                  <Sparkles className="h-5 w-5 text-vylta-green" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-vylta-bone">¡Todo en orden!</h3>
                <p className="mt-1 text-xs text-vylta-muted">No tienes alertas pendientes ahora mismo.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Componentes internos (mismos que v1, sin cambios)
// ══════════════════════════════════════════════════════════════════════

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function Hero({ greeting, firstName, todayLabel, todayCount, todayRevenue, todayConfirmed, todayPending }: { greeting: string; firstName: string; todayLabel: string; todayCount: number; todayRevenue: number; todayConfirmed: number; todayPending: number; }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-vylta-surface shadow-card-lg">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-vylta-green/10 blur-[100px]" />
        <div className="absolute -bottom-24 -left-20 h-60 w-60 rounded-full bg-vylta-luxury/5 blur-[80px]" />
        <div className="absolute inset-0 bg-grid opacity-[0.15]" style={{ maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 80%)' }} />
      </div>
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-vylta-subtle">{todayLabel}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tightest text-vylta-bone sm:text-4xl">
            {greeting}{firstName && <>, <span className="text-gradient-vylta">{firstName}</span></>}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <HeroStat icon={Calendar} value={todayCount} label={todayCount === 1 ? 'cita hoy' : 'citas hoy'} color="text-vylta-green" />
            {todayPending > 0 && <HeroStat icon={Clock} value={todayPending} label="por confirmar" color="text-vylta-amber" />}
            {todayConfirmed > 0 && <HeroStat icon={CheckCircle2} value={todayConfirmed} label="confirmadas" color="text-vylta-green" />}
            {todayRevenue > 0 && <HeroStat icon={DollarSign} value={formatCurrency(todayRevenue)} label="cobrado" color="text-vylta-green" isCurrency />}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0"><QuickActions /></div>
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, value, label, color, isCurrency }: { icon: any; value: number | string; label: string; color: string; isCurrency?: boolean; }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-4 w-4', color)} strokeWidth={2} />
      <span className={cn('font-bold tabular-nums', color, !isCurrency && 'text-lg')}>{value}</span>
      <span className="text-vylta-muted">{label}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, iconColor }: { icon: any; label: string; iconColor: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className={cn('h-3.5 w-3.5', iconColor)} strokeWidth={2.5} />
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">{label}</h2>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, sub, accent }: { label: string; value: string; icon: any; sub: string; accent: 'green' | 'amber' | 'luxury' | 'rose'; }) {
  const colorMap = {
    green:  { text: 'text-vylta-green',  bg: 'bg-vylta-green/10',  ring: 'ring-vylta-green/20',  haloHex: '#10B981' },
    amber:  { text: 'text-vylta-amber',  bg: 'bg-vylta-amber/10',  ring: 'ring-vylta-amber/20',  haloHex: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', bg: 'bg-vylta-luxury/10', ring: 'ring-vylta-luxury/20', haloHex: '#A78BFA' },
    rose:   { text: 'text-vylta-rose',   bg: 'bg-vylta-rose/10',   ring: 'ring-vylta-rose/20',   haloHex: '#F43F5E' },
  }[accent];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card transition-all hover:border-border/80 hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-50" style={{ background: colorMap.haloHex }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', colorMap.bg, colorMap.ring, colorMap.text)}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        </div>
        <div className={cn('mt-3 text-3xl font-bold tabular-nums tracking-tightest', colorMap.text)}>{value}</div>
        <div className="mt-1 text-[11px] text-vylta-muted">{sub}</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, count, action, children }: { icon: any; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-vylta-card/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-vylta-green" strokeWidth={2.25} />
          <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
          {typeof count === 'number' && (
            <span className="rounded-full bg-vylta-card px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-vylta-muted">{count}</span>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SidebarCard({ icon: Icon, iconColor, iconBg, iconRing, title, badge, badgeClass, action, children }: { icon: any; iconColor: string; iconBg: string; iconRing: string; title: string; badge?: number; badgeClass?: string; action?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg ring-1', iconBg, iconRing, iconColor)}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
          {badge !== undefined && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', badgeClass)}>{badge}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Confirmada:   'bg-vylta-green/15 text-vylta-green',
  Pendiente:    'bg-vylta-amber/15 text-vylta-amber',
  Reagendada:   'bg-vylta-luxury/15 text-vylta-luxury',
  'En espera':  'bg-vylta-amber/15 text-vylta-amber',
  Solicitud:    'bg-vylta-sky/15 text-vylta-sky',
  Pagado:       'bg-vylta-green/15 text-vylta-green',
  Completada:   'bg-vylta-luxury/15 text-vylta-luxury',
};

function AppointmentRow({ apt, showDate }: { apt: TodayAppointment; showDate: boolean }) {
  return (
    <li>
      <Link href={`/citas/${apt.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-vylta-card/40">
        <div className="flex flex-col items-center justify-center rounded-lg bg-vylta-card/60 px-3 py-2 tabular-nums border border-border">
          <span className="text-sm font-bold leading-none text-vylta-bone">{apt.start_time?.slice(0, 5)}</span>
          {showDate && <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-vylta-subtle">{formatShortDate(apt.date)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {apt.staff && <span className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: apt.staff.color }} title={apt.staff.name} />}
            <span className="truncate text-sm font-semibold text-vylta-bone">{apt.client_name}</span>
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', STATUS_STYLES[apt.status] || 'bg-vylta-card text-vylta-muted')}>{apt.status}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-vylta-muted">{apt.service_name}{apt.staff ? ' · ' + apt.staff.name : ''}</div>
        </div>
        {apt.service_cost ? <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green">{formatCurrency(apt.service_cost)}</span> : null}
      </Link>
    </li>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-vylta-green/10 ring-1 ring-vylta-green/20">
        <CheckCircle2 className="h-6 w-6 text-vylta-green" strokeWidth={2} />
      </div>
      <h4 className="text-sm font-semibold text-vylta-bone">Sin citas hoy</h4>
      <p className="mt-1 max-w-xs text-xs text-vylta-muted">Disfruta tu día libre o crea una cita para empezar.</p>
    </div>
  );
}

function AlertCard({ variant, icon: Icon, title, description, actionLabel, actionHref }: { variant: 'warning' | 'info'; icon: any; title: string; description: string; actionLabel: string; actionHref: string; }) {
  const isWarning = variant === 'warning';
  const styles = isWarning ? 'border-vylta-amber/30 bg-vylta-amber/5' : 'border-vylta-luxury/30 bg-vylta-luxury/5';
  const iconStyles = isWarning ? 'text-vylta-amber' : 'text-vylta-luxury';
  return (
    <div className={cn('rounded-xl border p-4 shadow-card', styles)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconStyles)} strokeWidth={2} />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
          <p className="mt-0.5 text-xs text-vylta-muted">{description}</p>
          <Link href={actionHref} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-vylta-green hover:text-vylta-green-light transition-colors">
            {actionLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
