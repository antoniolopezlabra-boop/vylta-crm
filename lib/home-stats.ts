// ══════════════════════════════════════════════════════════════════════
// Stats para Inicio (operativo) + cobros pendientes + uso plan Básico + KPIs semana
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import {
  getMonthStartString,
  getMonthEndString,
  getTodayString,
  toLocalDateString,
} from '@/lib/date-utils';

export interface TodayAppointment {
  id: string;
  client_name: string;
  service_name: string;
  start_time: string;
  end_time: string | null;
  date: string;
  status: string;
  service_cost: number | null;
  staff?: { name: string; color: string } | null;
}

export interface UnpaidAppointment {
  id: string;
  client_name: string;
  service_name: string;
  service_cost: number | null;
  date: string;
  start_time: string;
  staff?: { name: string; color: string } | null;
}

export interface BirthdayClient {
  id: string;
  name: string;
  birthday: string;
  daysUntil: number;
  phone: string | null;
}

export interface InactiveClientHint {
  id: string;
  name: string;
  daysSinceLastVisit: number;
  phone: string | null;
}

export type PlanTier = 'gratuito' | 'basico' | 'premium';

export interface PlanUsage {
  /** Tier real de BD: gratuito ("Básico"), basico ("Premium"), premium ("Luxury") */
  tier: PlanTier;
  isGratuito: boolean;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isNearLimit: boolean; // >= 80%
  isAtLimit: boolean;   // >= 100%
}

export interface HomeStats {
  // Hoy
  todayCount: number;
  todayConfirmed: number;
  todayPending: number;
  todayRevenue: number;
  todayPaidCount: number;
  // Mañana
  tomorrowCount: number;
  tomorrowUnconfirmed: number;
  // Semana
  weekCount: number;
  weekConfirmed: number;
  weekPending: number;
  weekRevenue: number;
  // Listas
  upcomingToday: TodayAppointment[];
  upcomingFuture: TodayAppointment[];
  upcomingBirthdays: BirthdayClient[];
  inactiveClients: InactiveClientHint[];
  unpaidAppointments: UnpaidAppointment[];
  unpaidTotal: number;
  pendingRequests: number;
  // Mes
  monthRevenue: number;
  monthAppointments: number;
  monthLabel: string;
  // Plan + uso
  planUsage: PlanUsage;
}

const PAID_STATUSES = ['Pagado', 'Completada'];
const ACTIVE_STATUSES = ['Pendiente', 'Confirmada', 'Reagendada', 'En espera', 'Solicitud', 'Completada', 'Pagado'];
const EXCLUDED_STATUSES = ['Cancelada', 'No asistió', 'Rechazada'];
const GRATUITO_MONTHLY_LIMIT = 10;

/** Devuelve el lunes y domingo de la semana actual como strings YYYY-MM-DD */
function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toLocalDateString(monday), end: toLocalDateString(sunday) };
}

export async function getHomeStats(): Promise<HomeStats> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const userId = user.id;

  const now = new Date();
  const today = getTodayString();
  const tomorrow = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toLocalDateString(t);
  })();
  const monthStart = getMonthStartString(now.getFullYear(), now.getMonth());
  const monthEnd = getMonthEndString(now.getFullYear(), now.getMonth());
  const week = getWeekRange();
  const sixtyDaysAgoStr = (() => {
    const t = new Date();
    t.setDate(t.getDate() - 60);
    return toLocalDateString(t);
  })();

  const [
    todayApts,
    tomorrowApts,
    weekApts,
    upcomingApts,
    monthApts,
    clientsWithBirthdays,
    inactiveClientsData,
    unpaidApts,
    requestsData,
    planData,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, service_name, start_time, end_time, date, status, service_cost, client:clients(name), client_name_temp, staff:staff_members(name, color)')
      .eq('user_id', userId)
      .eq('date', today)
      .order('start_time', { ascending: true }),
    supabase
      .from('appointments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('date', tomorrow),
    supabase
      .from('appointments')
      .select('id, status, service_cost')
      .eq('user_id', userId)
      .gte('date', week.start)
      .lte('date', week.end),
    supabase
      .from('appointments')
      .select('id, service_name, start_time, end_time, date, status, service_cost, client:clients(name), client_name_temp, staff:staff_members(name, color)')
      .eq('user_id', userId)
      .gt('date', today)
      .in('status', ACTIVE_STATUSES)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(8),
    supabase
      .from('appointments')
      .select('id, status, service_cost, created_at')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('clients')
      .select('id, name, birthday, phone')
      .eq('user_id', userId)
      .not('birthday', 'is', null),
    supabase
      .from('clients')
      .select('id, name, phone, last_visit')
      .eq('user_id', userId)
      .not('last_visit', 'is', null)
      .lt('last_visit', sixtyDaysAgoStr)
      .order('last_visit', { ascending: false })
      .limit(20),
    supabase
      .from('appointments')
      .select('id, service_name, service_cost, date, start_time, client:clients(name), client_name_temp, staff:staff_members(name, color)')
      .eq('user_id', userId)
      .eq('status', 'Completada')
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(20),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'Solicitud'),
    supabase
      .from('subscription_plans')
      .select('plan_type, status')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  // — Hoy —
  const todayList = (todayApts.data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    start_time: a.start_time,
    end_time: a.end_time,
    date: a.date,
    status: a.status,
    service_cost: a.service_cost,
    staff: a.staff || null,
  })) as TodayAppointment[];
  const activeToday = todayList.filter(a => !EXCLUDED_STATUSES.includes(a.status));
  const todayConfirmed = activeToday.filter(a => a.status === 'Confirmada').length;
  const todayPending = activeToday.filter(a => ['Pendiente', 'Reagendada', 'Solicitud', 'En espera'].includes(a.status)).length;
  const todayPaid = activeToday.filter(a => PAID_STATUSES.includes(a.status));
  const todayRevenue = todayPaid.reduce((s, a) => s + (a.service_cost || 0), 0);

  // — Mañana —
  const tomorrowList = tomorrowApts.data || [];
  const tomorrowActive = tomorrowList.filter((a: any) => !EXCLUDED_STATUSES.includes(a.status));
  const tomorrowUnconfirmed = tomorrowActive.filter((a: any) => a.status !== 'Confirmada').length;

  // — Semana —
  const weekList = weekApts.data || [];
  const weekActive = weekList.filter((a: any) => !EXCLUDED_STATUSES.includes(a.status));
  const weekConfirmed = weekActive.filter((a: any) => a.status === 'Confirmada').length;
  const weekPending = weekActive.filter((a: any) => ['Pendiente', 'Reagendada', 'Solicitud', 'En espera'].includes(a.status)).length;
  const weekRevenue = weekActive
    .filter((a: any) => PAID_STATUSES.includes(a.status))
    .reduce((s: number, a: any) => s + (a.service_cost || 0), 0);

  // — Futuro —
  const upcomingFuture = (upcomingApts.data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    start_time: a.start_time,
    end_time: a.end_time,
    date: a.date,
    status: a.status,
    service_cost: a.service_cost,
    staff: a.staff || null,
  })) as TodayAppointment[];

  // — Cobros pendientes —
  const unpaidAppointments = (unpaidApts.data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    service_cost: a.service_cost,
    date: a.date,
    start_time: a.start_time,
    staff: a.staff || null,
  })) as UnpaidAppointment[];
  const unpaidTotal = unpaidAppointments.reduce((s, a) => s + (a.service_cost || 0), 0);

  // — Cumpleaños —
  const upcomingBirthdays: BirthdayClient[] = [];
  const currentYear = now.getFullYear();
  (clientsWithBirthdays.data || []).forEach((c: any) => {
    if (!c.birthday) return;
    const parts = c.birthday.split('-').map(Number);
    const m = parts[1];
    const d = parts[2];
    let nextBday = new Date(currentYear, m - 1, d, 12, 0, 0);
    if (nextBday < now) nextBday = new Date(currentYear + 1, m - 1, d, 12, 0, 0);
    const daysUntil = Math.ceil((nextBday.getTime() - now.getTime()) / 86400000);
    if (daysUntil >= 0 && daysUntil <= 7) {
      upcomingBirthdays.push({ id: c.id, name: c.name, birthday: c.birthday, daysUntil, phone: c.phone || null });
    }
  });
  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  // — Inactivos —
  const inactiveClients: InactiveClientHint[] = (inactiveClientsData.data || [])
    .slice(0, 5)
    .map((c: any) => {
      const lastVisit = new Date(c.last_visit + 'T12:00:00');
      const days = Math.floor((now.getTime() - lastVisit.getTime()) / 86400000);
      return { id: c.id, name: c.name, daysSinceLastVisit: days, phone: c.phone || null };
    });

  // — Mes —
  const monthList = monthApts.data || [];
  const monthActive = monthList.filter((a: any) => !EXCLUDED_STATUSES.includes(a.status));
  const monthRevenue = monthList
    .filter((a: any) => PAID_STATUSES.includes(a.status))
    .reduce((s: number, a: any) => s + (a.service_cost || 0), 0);

  // — Plan + uso (para banner de plan Básico) —
  // BD tier 'gratuito' = label UI "Plan Básico" con límite de 10 citas/mes
  const tier = ((planData.data?.plan_type as string) || 'gratuito').toLowerCase() as PlanTier;
  const isGratuito = tier === 'gratuito';
  const used = monthActive.length;
  const limit = GRATUITO_MONTHLY_LIMIT;
  const remaining = Math.max(0, limit - used);
  const percentage = Math.min(100, Math.round((used / limit) * 100));

  const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return {
    todayCount: activeToday.length,
    todayConfirmed,
    todayPending,
    todayRevenue,
    todayPaidCount: todayPaid.length,
    tomorrowCount: tomorrowActive.length,
    tomorrowUnconfirmed,
    weekCount: weekActive.length,
    weekConfirmed,
    weekPending,
    weekRevenue,
    upcomingToday: activeToday,
    upcomingFuture,
    upcomingBirthdays,
    inactiveClients,
    unpaidAppointments,
    unpaidTotal,
    pendingRequests: requestsData.count || 0,
    monthRevenue,
    monthAppointments: monthActive.length,
    monthLabel: `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`,
    planUsage: {
      tier,
      isGratuito,
      used,
      limit,
      remaining,
      percentage,
      isNearLimit: percentage >= 80 && percentage < 100,
      isAtLimit: percentage >= 100,
    },
  };
}
