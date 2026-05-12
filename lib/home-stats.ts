// ══════════════════════════════════════════════════════════════════════
// Stats para Inicio (operativo).
//
// Filosofía nueva: Inicio = "hoy y los próximos días". Lo accionable.
// El análisis histórico profundo vive en /reportes.
//
// Por eso aquí solo calculamos:
//   • HOY: citas, confirmadas, pendientes, ingresos cobrados
//   • MAÑANA: citas pendientes sin confirmar (alerta accionable)
//   • ESTA SEMANA: cumpleaños de clientes
//   • INACTIVOS: clientes >60d sin visita (recordatorio de reenganche)
//   • PRÓXIMAS CITAS: las siguientes 8 confirmadas/pendientes
//   • Mini-resumen del mes (1 KPI con botón "Ver análisis completo")
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

export interface HomeStats {
  // HOY
  todayCount: number;
  todayConfirmed: number;
  todayPending: number;
  todayRevenue: number;
  todayPaidCount: number;

  // MAÑANA
  tomorrowCount: number;
  tomorrowUnconfirmed: number;

  // PRÓXIMAS (hoy + futuras, hasta 8)
  upcomingToday: TodayAppointment[];
  upcomingFuture: TodayAppointment[];

  // SEMANA (cumpleaños próximos 7d)
  upcomingBirthdays: BirthdayClient[];

  // REENGANCHE
  inactiveClients: InactiveClientHint[];

  // MINI-RESUMEN DEL MES (para enviar a /reportes con un click)
  monthRevenue: number;
  monthAppointments: number;
  monthLabel: string;
}

const PAID_STATUSES = ['Pagado', 'Completada'];
const ACTIVE_STATUSES = ['Pendiente', 'Confirmada', 'Reagendada', 'En espera', 'Solicitud', 'Completada', 'Pagado'];

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
  const sevenDaysAhead = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 7);
    return toLocalDateString(t);
  })();
  const monthStart = getMonthStartString(now.getFullYear(), now.getMonth());
  const monthEnd = getMonthEndString(now.getFullYear(), now.getMonth());
  const sixtyDaysAgoStr = (() => {
    const t = new Date();
    t.setDate(t.getDate() - 60);
    return toLocalDateString(t);
  })();

  const [
    todayApts,
    tomorrowApts,
    upcomingApts,
    monthApts,
    clientsWithBirthdays,
    inactiveClientsData,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, service_name, start_time, end_time, date, status, service_cost, client:clients(name), client_name_temp')
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
      .select('id, service_name, start_time, end_time, date, status, service_cost, client:clients(name), client_name_temp')
      .eq('user_id', userId)
      .gt('date', today)
      .in('status', ACTIVE_STATUSES)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(8),
    supabase
      .from('appointments')
      .select('id, status, service_cost')
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
  ]);

  // ── HOY ──
  const todayList = (todayApts.data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    start_time: a.start_time,
    end_time: a.end_time,
    date: a.date,
    status: a.status,
    service_cost: a.service_cost,
  })) as TodayAppointment[];

  const activeToday = todayList.filter(a => !['Cancelada', 'No asistió', 'Rechazada'].includes(a.status));
  const todayConfirmed = activeToday.filter(a => a.status === 'Confirmada').length;
  const todayPending = activeToday.filter(a => ['Pendiente', 'Reagendada', 'Solicitud', 'En espera'].includes(a.status)).length;
  const todayPaid = activeToday.filter(a => PAID_STATUSES.includes(a.status));
  const todayRevenue = todayPaid.reduce((s, a) => s + (a.service_cost || 0), 0);

  // ── MAÑANA ──
  const tomorrowList = tomorrowApts.data || [];
  const tomorrowActive = tomorrowList.filter((a: any) => !['Cancelada', 'No asistió', 'Rechazada'].includes(a.status));
  const tomorrowUnconfirmed = tomorrowActive.filter((a: any) => a.status !== 'Confirmada').length;

  // ── PRÓXIMAS CITAS FUTURAS ──
  const upcomingFuture = (upcomingApts.data || []).map((a: any) => ({
    id: a.id,
    client_name: a.client?.name || a.client_name_temp || 'Cliente',
    service_name: a.service_name,
    start_time: a.start_time,
    end_time: a.end_time,
    date: a.date,
    status: a.status,
    service_cost: a.service_cost,
  })) as TodayAppointment[];

  // ── CUMPLEAÑOS PRÓXIMOS 7d ──
  const upcomingBirthdays: BirthdayClient[] = [];
  const currentYear = now.getFullYear();
  (clientsWithBirthdays.data || []).forEach((c: any) => {
    if (!c.birthday) return;
    const [_, m, d] = c.birthday.split('-').map(Number);
    // Calcular cumple en este año
    let nextBday = new Date(currentYear, m - 1, d, 12, 0, 0);
    if (nextBday < now) {
      // Ya pasó, calcular el del año que viene
      nextBday = new Date(currentYear + 1, m - 1, d, 12, 0, 0);
    }
    const daysUntil = Math.ceil((nextBday.getTime() - now.getTime()) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= 7) {
      upcomingBirthdays.push({
        id: c.id,
        name: c.name,
        birthday: c.birthday,
        daysUntil,
        phone: c.phone || null,
      });
    }
  });
  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  // ── CLIENTES INACTIVOS >60d ──
  const inactiveClients: InactiveClientHint[] = (inactiveClientsData.data || [])
    .slice(0, 5)
    .map((c: any) => {
      const lastVisit = new Date(c.last_visit + 'T12:00:00');
      const days = Math.floor((now.getTime() - lastVisit.getTime()) / 86_400_000);
      return {
        id: c.id,
        name: c.name,
        daysSinceLastVisit: days,
        phone: c.phone || null,
      };
    });

  // ── MINI-RESUMEN DEL MES ──
  const monthList = monthApts.data || [];
  const monthRevenue = monthList
    .filter((a: any) => PAID_STATUSES.includes(a.status))
    .reduce((s: number, a: any) => s + (a.service_cost || 0), 0);
  const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return {
    todayCount: activeToday.length,
    todayConfirmed,
    todayPending,
    todayRevenue,
    todayPaidCount: todayPaid.length,
    tomorrowCount: tomorrowActive.length,
    tomorrowUnconfirmed,
    upcomingToday: activeToday,
    upcomingFuture,
    upcomingBirthdays,
    inactiveClients,
    monthRevenue,
    monthAppointments: monthList.length,
    monthLabel: `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`,
  };
}
