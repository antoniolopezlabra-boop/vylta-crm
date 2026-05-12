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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getHomeStats, type TodayAppointment } from '@/lib/home-stats';
import { cn, formatCurrency } from '@/lib/utils';
import { formatShortDate, MONTHS_ES, DAYS_ES_FULL } from '@/lib/date-utils';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { UnpaidList } from '@/components/dashboard/unpaid-list';

export default async function DashboardPage() {
  const stats = await getHomeStats();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('user_id', user!.id)
    .maybeSingle();

  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    profile?.business_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    '';

  const now = new Date();
  const todayLabel = `${DAYS_ES_FULL[(now.getDay() === 0 ? 6 : now.getDay() - 1)]} ${now.getDate()} de ${MONTHS_ES[now.getMonth()].toLowerCase()}`;

  const hasUrgentAlerts = stats.tomorrowUnconfirmed > 0 || stats.pendingRequests > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greet()} {firstName && <>, {firstName}</>} <span className="inline-block animate-fade-in">👋</span>
          </h1>
          <p className="text-sm capitalize text-muted-foreground">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <QuickActions />
        </div>
      </div>

      {stats.unpaidAppointments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border-2 border-vylta-amber-500/40 bg-gradient-to-br from-vylta-amber-500/10 via-card to-card shadow-md">
          <div className="flex items-center justify-between p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-vylta-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-vylta-amber-700 dark:text-amber-400">Por cobrar</span>
              </div>
              <div className="mt-2 text-4xl font-bold tabular-nums text-vylta-amber-700 dark:text-amber-400">
                {formatCurrency(stats.unpaidTotal)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.unpaidAppointments.length} {stats.unpaidAppointments.length === 1 ? 'cita pendiente' : 'citas pendientes'} de cobro
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-vylta-amber-500/20 text-vylta-amber-700 dark:text-amber-400">
              <Wallet className="h-10 w-10" />
            </div>
          </div>
          <UnpaidList appointments={stats.unpaidAppointments} />
        </div>
      )}

      {stats.pendingRequests > 0 && (
        <Link href="/citas" className="flex items-center gap-4 rounded-xl border-2 border-blue-500/40 bg-blue-500/5 p-4 transition hover:bg-blue-500/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-700 dark:text-blue-400">
              {stats.pendingRequests} {stats.pendingRequests === 1 ? 'solicitud nueva' : 'solicitudes nuevas'} desde el link público
            </div>
            <div className="text-xs text-muted-foreground">Toca para revisarlas y aceptar/rechazar</div>
          </div>
          <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigKpi label="Citas hoy" value={`${stats.todayCount}`} icon={CalendarCheck} accent="green" sub={stats.todayCount > 0 ? `${stats.todayConfirmed} confirmadas` : 'Día libre'} />
        <BigKpi label="Pendientes" value={`${stats.todayPending}`} icon={Clock} accent="amber" sub={stats.todayPending > 0 ? 'Por confirmar' : 'Todas listas'} />
        <BigKpi label="Cobrado hoy" value={formatCurrency(stats.todayRevenue)} icon={DollarSign} accent="green" sub={`${stats.todayPaidCount} ${stats.todayPaidCount === 1 ? 'cita pagada' : 'citas pagadas'}`} />
        <BigKpi label="Mañana" value={`${stats.tomorrowCount}`} icon={CalendarCheck} accent={stats.tomorrowUnconfirmed > 0 ? 'amber' : 'green'} sub={stats.tomorrowUnconfirmed > 0 ? `${stats.tomorrowUnconfirmed} sin confirmar` : 'Todo en orden'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section icon={CalendarCheck} title="Agenda de hoy" count={stats.upcomingToday.length} action={
            <Link href="/citas" className="text-xs font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400">Ver calendario →</Link>
          }>
            {stats.upcomingToday.length === 0 ? <EmptyDay /> : (
              <ul className="divide-y divide-border">
                {stats.upcomingToday.map((apt) => (<AppointmentRow key={apt.id} apt={apt} showDate={false} />))}
              </ul>
            )}
          </Section>

          {stats.upcomingFuture.length > 0 && (
            <Section icon={Clock} title="Próximas citas" count={stats.upcomingFuture.length}>
              <ul className="divide-y divide-border">
                {stats.upcomingFuture.map((apt) => (<AppointmentRow key={apt.id} apt={apt} showDate={true} />))}
              </ul>
            </Section>
          )}

          <div className="rounded-xl border border-border bg-gradient-to-br from-vylta-green-500/5 via-card to-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-vylta-green-600 dark:text-vylta-green-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Resumen de {stats.monthLabel}</h3>
                <p className="text-xs text-muted-foreground">
                  Llevas <span className="font-bold text-foreground">{formatCurrency(stats.monthRevenue)}</span> cobrados en{' '}
                  <span className="font-bold text-foreground">{stats.monthAppointments}</span> citas este mes.
                </p>
              </div>
              <Link href="/reportes" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-vylta-green-500/10 px-3 py-1.5 text-xs font-bold text-vylta-green-700 transition hover:bg-vylta-green-500/20 dark:text-vylta-green-400">
                Ver análisis
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {stats.tomorrowUnconfirmed > 0 && (
            <AlertCard variant="warning" icon={AlertTriangle} title={`${stats.tomorrowUnconfirmed} ${stats.tomorrowUnconfirmed === 1 ? 'cita mañana' : 'citas mañana'} sin confirmar`} description="Confírmalas para reducir no-shows." actionLabel="Ver citas" actionHref="/citas" />
          )}

          {stats.upcomingBirthdays.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cake className="h-4 w-4 text-pink-500" />
                  <h3 className="text-sm font-bold">Cumpleaños esta semana</h3>
                </div>
                <span className="rounded-full bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:text-pink-400">{stats.upcomingBirthdays.length}</span>
              </div>
              <ul className="space-y-2">
                {stats.upcomingBirthdays.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.daysUntil === 0 ? '🎉 ¡Hoy!' : c.daysUntil === 1 ? 'Mañana' : `En ${c.daysUntil} días`}</div>
                    </div>
                    {c.phone && (<a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-vylta-green-500/10 text-vylta-green-600 transition hover:bg-vylta-green-500/20 dark:text-vylta-green-400" title="Felicitar por WhatsApp"><Phone className="h-3.5 w-3.5" /></a>)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats.inactiveClients.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-vylta-amber-500" />
                  <h3 className="text-sm font-bold">Clientes inactivos</h3>
                </div>
                <Link href="/clientes?segment=inactivos" className="text-[10px] font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400">Ver todos</Link>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">Sin visita hace 60+ días. ¡Ideal para reenganchar!</p>
              <ul className="space-y-2">
                {stats.inactiveClients.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">Hace {c.daysSinceLastVisit} días</div>
                    </div>
                    {c.phone && (<a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-vylta-green-500/10 text-vylta-green-600 transition hover:bg-vylta-green-500/20 dark:text-vylta-green-400" title="Contactar por WhatsApp"><Phone className="h-3.5 w-3.5" /></a>)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasUrgentAlerts && stats.upcomingBirthdays.length === 0 && stats.inactiveClients.length === 0 && stats.unpaidAppointments.length === 0 && (
            <div className="rounded-xl border border-vylta-green-500/30 bg-vylta-green-500/5 p-5 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-vylta-green-600 dark:text-vylta-green-400" />
              <h3 className="mt-2 text-sm font-bold">¡Todo en orden!</h3>
              <p className="mt-1 text-xs text-muted-foreground">No tienes alertas pendientes ahora mismo.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function BigKpi({ label, value, icon: Icon, sub, accent }: { label: string; value: string; icon: any; sub: string; accent: 'green' | 'amber' | 'indigo' | 'rose' }) {
  const colors = {
    green: { ring: 'border-vylta-green-500/30', bg: 'bg-vylta-green-500/10', text: 'text-vylta-green-600 dark:text-vylta-green-400' },
    amber: { ring: 'border-vylta-amber-500/30', bg: 'bg-vylta-amber-500/10', text: 'text-vylta-amber-700 dark:text-amber-400' },
    indigo: { ring: 'border-vylta-indigo-500/30', bg: 'bg-vylta-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
    rose: { ring: 'border-vylta-rose-500/30', bg: 'bg-vylta-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
  }[accent];
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', colors.ring)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', colors.bg, colors.text)}><Icon className="h-3.5 w-3.5" /></div>
      </div>
      <div className={cn('mt-1 text-2xl font-bold tabular-nums', colors.text)}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Section({ icon: Icon, title, count, action, children }: { icon: any; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" />
          <h3 className="text-sm font-bold">{title}</h3>
          {typeof count === 'number' && (<span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>)}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Confirmada: 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400',
  Pendiente: 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
  Reagendada: 'bg-vylta-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  'En espera': 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
  Solicitud: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  Pagado: 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400',
  Completada: 'bg-vylta-indigo-500/15 text-indigo-600 dark:text-indigo-400',
};

function AppointmentRow({ apt, showDate }: { apt: TodayAppointment; showDate: boolean }) {
  return (
    <li>
      <Link href={`/citas/${apt.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/40">
        <div className="flex flex-col items-center justify-center rounded-md bg-secondary/60 px-2.5 py-1.5 tabular-nums">
          <span className="text-sm font-bold leading-none">{apt.start_time?.slice(0, 5)}</span>
          {showDate && (<span className="mt-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{formatShortDate(apt.date)}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {apt.staff && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: apt.staff.color }} title={apt.staff.name} />
            )}
            <span className="truncate text-sm font-semibold">{apt.client_name}</span>
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', STATUS_STYLES[apt.status] || 'bg-secondary text-muted-foreground')}>{apt.status}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {apt.service_name}{apt.staff ? ' · ' + apt.staff.name : ''}
          </div>
        </div>
        {apt.service_cost ? (<span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">{formatCurrency(apt.service_cost)}</span>) : null}
      </Link>
    </li>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-vylta-green-500/10">
        <CheckCircle2 className="h-5 w-5 text-vylta-green-600 dark:text-vylta-green-400" />
      </div>
      <h4 className="text-sm font-semibold">Sin citas hoy</h4>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">Disfruta tu día libre o crea una cita para empezar.</p>
    </div>
  );
}

function AlertCard({ variant, icon: Icon, title, description, actionLabel, actionHref }: { variant: 'warning' | 'info'; icon: any; title: string; description: string; actionLabel: string; actionHref: string }) {
  const styles = variant === 'warning' ? 'border-vylta-amber-500/40 bg-vylta-amber-500/5' : 'border-vylta-indigo-500/40 bg-vylta-indigo-500/5';
  const iconStyles = variant === 'warning' ? 'text-vylta-amber-700 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400';
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', styles)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconStyles)} />
        <div className="flex-1">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <Link href={actionHref} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-vylta-green-600 hover:underline dark:text-vylta-green-400">{actionLabel} →</Link>
        </div>
      </div>
    </div>
  );
}
