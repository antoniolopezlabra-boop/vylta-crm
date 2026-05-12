import { DollarSign, CalendarCheck, Target, UserPlus } from 'lucide-react';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { formatCurrency } from '@/lib/utils';
import { MONTHS_ES } from '@/lib/date-utils';
import { KPICard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { ServicesDonut } from '@/components/dashboard/services-donut';
import { UpcomingPanel } from '@/components/dashboard/upcoming-panel';
import { InsightsPanel } from '@/components/dashboard/insights-panel';
import { createClient } from '@/lib/supabase/server';

// ══════════════════════════════════════════════════════════════════════
// /dashboard — Pantalla principal del CRM ejecutivo
//
// Server Component que carga TODOS los datos del dashboard en server
// antes de renderizar la página. Esto significa que el usuario ve la
// página YA con datos reales, no con un "loading" que parpadea.
//
// Layout:
//   ┌──────────────────────────────────────────────────────┐
//   │ Saludo + selector mes                              │
//   ├──────────────────────────────────────────────────────┤
//   │ [KPI 1] [KPI 2] [KPI 3] [KPI 4]                    │
//   ├──────────────────────────────────────────────────────┤
//   │ ┌───────────────────────────┐ ┌────────────────┐ │
//   │ │ Gráfica de ingresos       │ │ Próximas       │ │
//   │ ├───────────────────────────┤ │ citas          │ │
//   │ │ Donut + Insights           │ │                │ │
//   │ └───────────────────────────┘ └────────────────┘ │
//   └──────────────────────────────────────────────────────┘
// ══════════════════════════════════════════════════════════════════════

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const stats = await getDashboardStats(year, month);

  // Obtener nombre del usuario para el saludo
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, owner_name')
    .eq('user_id', user!.id)
    .maybeSingle();

  const firstName =
    profile?.owner_name?.split(' ')[0] ||
    profile?.business_name?.split(' ')[0] ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    'Antonio';

  return (
    <div className="space-y-6">
      {/* Saludo + selector de mes */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola, {firstName} <span className="inline-block animate-fade-in">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Aquí tienes el panorama de tu negocio para {MONTHS_ES[month]} {year}.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold">
          <CalendarCheck className="h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" />
          {MONTHS_ES[month]} {year}
        </div>
      </div>

      {/* KPIs - 4 cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Ingresos"
          value={formatCurrency(stats.monthRevenue)}
          icon={DollarSign}
          iconColor="#10B981"
          change={stats.revenueChange}
        />
        <KPICard
          label="Citas"
          value={`${stats.monthAppointments}`}
          icon={CalendarCheck}
          iconColor="#6366F1"
          change={stats.aptsChange}
        />
        <KPICard
          label="Ticket prom."
          value={formatCurrency(stats.avgTicket)}
          icon={Target}
          iconColor="#F59E0B"
          change={stats.ticketChange}
        />
        <KPICard
          label="Clientes nuevos"
          value={`${stats.clientsThisMonth}`}
          icon={UserPlus}
          iconColor="#F472B6"
          change={stats.newClientsChange}
        />
      </div>

      {/* Grid principal: columna izquierda gráficas, derecha próximas citas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna izquierda (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <RevenueChart
            title="Ingresos"
            totalValue={formatCurrency(stats.monthRevenue)}
            changePercent={stats.revenueChange}
            data={stats.dailyRevenue}
            rangeLabel={MONTHS_ES[month].slice(0, 3)}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ServicesDonut
              title="Ingresos por servicio"
              totalValue={formatCurrency(stats.monthRevenue)}
              data={stats.revenueByService}
              rangeLabel={MONTHS_ES[month].slice(0, 3)}
            />
            <InsightsPanel stats={stats} />
          </div>
        </div>

        {/* Columna derecha (1/3) - Próximas citas */}
        <div className="lg:col-span-1">
          <UpcomingPanel appointments={stats.upcomingAppointments} />
        </div>
      </div>
    </div>
  );
}
