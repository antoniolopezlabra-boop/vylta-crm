// ══════════════════════════════════════════════════════════════════════
// Tipos y función para cargar las estadísticas del dashboard.
//
// Lógica replicada de app/(tabs)/reports.tsx de la app móvil para que ambas
// plataformas calculen lo mismo. Las queries se ejecutan en SERVER (Server
// Component) para que la primera página llegue ya con datos.
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import {
  getMonthStartString,
  getMonthEndString,
  getTodayString,
  toLocalDateString,
  DAYS_ES_SHORT,
  DAYS_ES_FULL,
  calcChange,
} from '@/lib/date-utils';

export interface ServiceSlice {
  name: string;
  amount: number;
  color: string;
}

export interface DailyRevenuePoint {
  label: string;
  value: number;
}

export interface UpcomingAppointment {
  id: string;
  client_name: string;
  service_name: string;
  start_time: string;
  date: string;
  status: string;
  service_cost: number | null;
}

export interface DashboardStats {
  // Métricas actuales del mes
  monthRevenue: number;
  monthAppointments: number;
  avgTicket: number;
  clientsThisMonth: number;
  pendingRevenue: number;

  // Comparaciones vs mes anterior
  revenueChange: number | null;
  aptsChange: number | null;
  ticketChange: number | null;
  newClientsChange: number | null;

  // Hoy
  todayAppointments: number;
  confirmedToday: number;

  // Para gráficas
  dailyRevenue: DailyRevenuePoint[];
  revenueByService: ServiceSlice[];

  // Para panel lateral
  upcomingAppointments: UpcomingAppointment[];

  // Para insights
  bestWeekday: { name: string; percent: number } | null;
  topService: ServiceSlice | null;
  inactiveClientsCount: number;

  // Histórico
  totalClients: number;
  completedAppointments: number;
}

const SERVICE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#F472B6', '#3B82F6', '#A855F7', '#14B8A6'];

/**
 * Carga TODAS las estadísticas del dashboard en paralelo para un mes dado.
 * @param year año (ej: 2026)
 * @param month mes (0-indexed, 0=enero)
 */
export async function getDashboardStats(
  year: number,
  month: number,
): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const userId = user.id;

  const today = getTodayString();
  const monthStart = getMonthStartString(year, month);
  const monthEnd = getMonthEndString(year, month);
  const lastMonthStart = getMonthStartString(year, month - 1);
  const lastMonthEnd = getMonthEndString(year, month - 1);

  // ── Queries en paralelo (Promise.all para reducir latencia total) ──
  const [
    todayApts,
    monthApts,
    revLegacy,
    revNew,
    revLegacyPrev,
    revNewPrev,
    pendingData,
    lastMonthAptsRes,
    clientsTotalRes,
    clientsThisMonthRes,
    clientsLastMonthRes,
    completedHistoricRes,
    inactiveClientsRes,
    upcomingApts,
  ] = await Promise.all([
    supabase.from('appointments').select('status').eq('user_id', userId).eq('date', today),
    supabase.from('appointments').select('id, status, start_time, date').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
    supabase.from('appointments').select('date, service_cost, service_name').eq('user_id', userId).eq('status', 'Pagado').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('appointments').select('date, service_cost, service_name').eq('user_id', userId).eq('status', 'Completada').eq('paid', true).gte('date', monthStart).lte('date', monthEnd),
    supabase.from('appointments').select('service_cost').eq('user_id', userId).eq('status', 'Pagado').gte('date', lastMonthStart).lte('date', lastMonthEnd),
    supabase.from('appointments').select('service_cost').eq('user_id', userId).eq('status', 'Completada').eq('paid', true).gte('date', lastMonthStart).lte('date', lastMonthEnd),
    supabase.from('appointments').select('service_cost').eq('user_id', userId).eq('status', 'Completada').or('paid.is.null,paid.eq.false').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', lastMonthStart).lte('date', lastMonthEnd),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart).lte('created_at', monthEnd + 'T23:59:59'),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd + 'T23:59:59'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['Completada', 'Pagado']),
    inactiveClientsQuery(supabase, userId),
    upcomingAppointmentsQuery(supabase, userId, today),
  ]);

  // ── Procesamiento de ingresos del mes ──
  const paid = [...(revLegacy.data || []), ...(revNew.data || [])];
  const monthRevenue = paid.reduce((s, a) => s + (a.service_cost || 0), 0);
  const lastMonthRevenue = [...(revLegacyPrev.data || []), ...(revNewPrev.data || [])]
    .reduce((s, a) => s + (a.service_cost || 0), 0);
  const pendingRevenue = (pendingData.data || []).reduce((s, a) => s + (a.service_cost || 0), 0);

  // ── Ingresos por día de la semana (gráfica de línea) ──
  const dailyByWeekday = [0, 0, 0, 0, 0, 0, 0];
  paid.forEach((a) => {
    if (!a.date || !a.service_cost) return;
    const d = new Date(a.date + 'T12:00:00');
    const jsDay = d.getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1; // lunes = 0
    dailyByWeekday[idx] += a.service_cost;
  });
  const dailyRevenue: DailyRevenuePoint[] = dailyByWeekday.map((value, i) => ({
    label: DAYS_ES_SHORT[i],
    value: Math.round(value),
  }));

  // ── Ingresos por servicio (donut) ──
  const serviceMap = new Map<string, number>();
  paid.forEach((a) => {
    const name = (a.service_name || 'Sin nombre').trim();
    serviceMap.set(name, (serviceMap.get(name) || 0) + (a.service_cost || 0));
  });
  const revenueByService: ServiceSlice[] = Array.from(serviceMap.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount), color: '' }))
    .sort((a, b) => b.amount - a.amount)
    .map((slice, idx) => ({ ...slice, color: SERVICE_COLORS[idx % SERVICE_COLORS.length] }));

  // ── Insights: mejor día ──
  const totalDaily = dailyByWeekday.reduce((s, v) => s + v, 0);
  let bestWeekday: { name: string; percent: number } | null = null;
  if (totalDaily > 0) {
    let maxIdx = 0;
    for (let i = 1; i < 7; i++) {
      if (dailyByWeekday[i] > dailyByWeekday[maxIdx]) maxIdx = i;
    }
    bestWeekday = {
      name: DAYS_ES_FULL[maxIdx],
      percent: Math.round((dailyByWeekday[maxIdx] / totalDaily) * 100),
    };
  }

  // ── Métricas derivadas ──
  const monthApt = monthApts.data || [];
  const completedThisMonth = monthApt.filter(a => ['Completada', 'Pagado'].includes(a.status)).length;
  const avgTicket = completedThisMonth > 0 ? Math.round(monthRevenue / completedThisMonth) : 0;

  // Avg ticket mes anterior (para comparación)
  const completedLastMonth = [...(revLegacyPrev.data || []), ...(revNewPrev.data || [])].length;
  const avgTicketLast = completedLastMonth > 0 ? Math.round(lastMonthRevenue / completedLastMonth) : 0;

  return {
    monthRevenue,
    monthAppointments: monthApt.length,
    avgTicket,
    clientsThisMonth: clientsThisMonthRes.count || 0,
    pendingRevenue,
    revenueChange: calcChange(monthRevenue, lastMonthRevenue),
    aptsChange: calcChange(monthApt.length, lastMonthAptsRes.count || 0),
    ticketChange: calcChange(avgTicket, avgTicketLast),
    newClientsChange: calcChange(clientsThisMonthRes.count || 0, clientsLastMonthRes.count || 0),
    todayAppointments: todayApts.data?.length || 0,
    confirmedToday: todayApts.data?.filter(a => a.status === 'Confirmada').length || 0,
    dailyRevenue,
    revenueByService,
    upcomingAppointments: upcomingApts || [],
    bestWeekday,
    topService: revenueByService[0] || null,
    inactiveClientsCount: inactiveClientsRes || 0,
    totalClients: clientsTotalRes.count || 0,
    completedAppointments: completedHistoricRes.count || 0,
  };
}

// ── Query helpers ──

async function inactiveClientsQuery(supabase: any, userId: string): Promise<number> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoff = toLocalDateString(sixtyDaysAgo);
  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lt('last_visit', cutoff);
  return count || 0;
}

async function upcomingAppointmentsQuery(
  supabase: any,
  userId: string,
  todayStr: string,
): Promise<UpcomingAppointment[]> {
  const { data } = await supabase
    .from('appointments')
    .select('id, service_name, start_time, date, status, service_cost, client:clients(name), client_name_temp')
    .eq('user_id', userId)
    .gte('date', todayStr)
    .in('status', ['Confirmada', 'Pendiente'])
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(8);

  return (data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    start_time: a.start_time,
    date: a.date,
    status: a.status,
    service_cost: a.service_cost,
  }));
}
