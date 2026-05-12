// ══════════════════════════════════════════════════════════════════════
// Reportes ejecutivos — queries de análisis profundo
//
// Diferencia con dashboard-stats.ts: aquí cargamos rangos arbitrarios
// (no solo el mes en curso), generamos comparativas año-tras-año, top N
// de servicios y clientes, distribución por status.
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString, MONTHS_ES } from '@/lib/date-utils';

export interface ReportsData {
  // Métricas globales del período
  totalRevenue: number;
  totalAppointments: number;
  totalClientsNew: number;
  avgTicket: number;

  // Comparativas vs período anterior
  revenueChange: number | null;
  apptsChange: number | null;
  ticketChange: number | null;

  // Ingresos por mes (gráfica de línea)
  monthlyRevenue: { label: string; current: number; previous: number }[];

  // Top servicios (barras horizontales)
  topServices: { name: string; revenue: number; count: number; color: string }[];

  // Top clientes (que más gastaron)
  topClients: { id: string; name: string; revenue: number; appointments: number }[];

  // Distribución por status (pie)
  statusDistribution: { status: string; count: number; color: string }[];

  // Para exportar a CSV
  rawAppointments: any[];
}

const SERVICE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#F472B6', '#3B82F6', '#A855F7', '#14B8A6', '#EF4444', '#84CC16', '#06B6D4'];

const STATUS_COLORS: Record<string, string> = {
  Confirmada: '#10B981',
  Pendiente: '#F59E0B',
  Completada: '#6366F1',
  Pagado: '#34D399',
  Cancelada: '#94A3B8',
  'No asistió': '#F43F5E',
};

export type PeriodType = 'mes' | 'trimestre' | 'año' | 'custom';

export interface ReportPeriod {
  type: PeriodType;
  startDate: string;
  endDate: string;
  label: string;
  // Para comparativa
  prevStartDate: string;
  prevEndDate: string;
}

/**
 * Calcula el rango de fechas según el tipo de período seleccionado.
 */
export function calculatePeriod(
  type: PeriodType,
  reference: Date,
  customStart?: string,
  customEnd?: string,
): ReportPeriod {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  if (type === 'mes') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const prevStart = new Date(year, month - 1, 1);
    const prevEnd = new Date(year, month, 0);
    return {
      type,
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      label: `${MONTHS_ES[month]} ${year}`,
      prevStartDate: toLocalDateString(prevStart),
      prevEndDate: toLocalDateString(prevEnd),
    };
  }

  if (type === 'trimestre') {
    const q = Math.floor(month / 3); // 0, 1, 2, 3
    const start = new Date(year, q * 3, 1);
    const end = new Date(year, q * 3 + 3, 0);
    const prevStart = new Date(year, q * 3 - 3, 1);
    const prevEnd = new Date(year, q * 3, 0);
    return {
      type,
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      label: `Q${q + 1} ${year}`,
      prevStartDate: toLocalDateString(prevStart),
      prevEndDate: toLocalDateString(prevEnd),
    };
  }

  if (type === 'año') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const prevStart = new Date(year - 1, 0, 1);
    const prevEnd = new Date(year - 1, 11, 31);
    return {
      type,
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      label: `${year}`,
      prevStartDate: toLocalDateString(prevStart),
      prevEndDate: toLocalDateString(prevEnd),
    };
  }

  // custom
  const s = customStart || toLocalDateString(new Date(year, month, 1));
  const e = customEnd || toLocalDateString(new Date(year, month + 1, 0));
  // Calcular período previo de igual duración
  const startD = new Date(s + 'T12:00:00');
  const endD = new Date(e + 'T12:00:00');
  const days = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;
  const prevEndD = new Date(startD);
  prevEndD.setDate(prevEndD.getDate() - 1);
  const prevStartD = new Date(prevEndD);
  prevStartD.setDate(prevStartD.getDate() - days + 1);
  return {
    type,
    startDate: s,
    endDate: e,
    label: `${s} → ${e}`,
    prevStartDate: toLocalDateString(prevStartD),
    prevEndDate: toLocalDateString(prevEndD),
  };
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Carga TODOS los datos del reporte para un período dado.
 */
export async function getReportsData(period: ReportPeriod): Promise<ReportsData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const userId = user.id;

  // Carga citas del período actual y el previo en paralelo
  const [currentRes, previousRes, newClientsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, date, start_time, service_name, service_cost, status, paid, client_id, client:clients(id, name)')
      .eq('user_id', userId)
      .gte('date', period.startDate)
      .lte('date', period.endDate),
    supabase
      .from('appointments')
      .select('service_cost, status, paid')
      .eq('user_id', userId)
      .gte('date', period.prevStartDate)
      .lte('date', period.prevEndDate),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', period.startDate)
      .lte('created_at', period.endDate + 'T23:59:59'),
  ]);

  const current = currentRes.data || [];
  const previous = previousRes.data || [];

  // ── Métricas globales ──
  const paidCurrent = current.filter((a: any) =>
    a.status === 'Pagado' || (a.status === 'Completada' && a.paid),
  );
  const totalRevenue = paidCurrent.reduce((s: number, a: any) => s + (a.service_cost || 0), 0);
  const totalAppointments = current.length;
  const totalClientsNew = newClientsRes.count || 0;
  const avgTicket = paidCurrent.length > 0 ? Math.round(totalRevenue / paidCurrent.length) : 0;

  // ── Período anterior para comparativa ──
  const paidPrev = previous.filter((a: any) =>
    a.status === 'Pagado' || (a.status === 'Completada' && a.paid),
  );
  const prevRevenue = paidPrev.reduce((s: number, a: any) => s + (a.service_cost || 0), 0);
  const prevApptsCount = previous.length;
  const prevAvgTicket = paidPrev.length > 0 ? Math.round(prevRevenue / paidPrev.length) : 0;

  // ── Ingresos por mes (gráfica dual: actual vs anterior) ──
  const monthlyRevenue = buildMonthlyRevenue(current, previous, period);

  // ─═ Top servicios por revenue ─═
  const serviceMap = new Map<string, { revenue: number; count: number }>();
  paidCurrent.forEach((a: any) => {
    const name = (a.service_name || 'Sin nombre').trim();
    const prev = serviceMap.get(name) || { revenue: 0, count: 0 };
    serviceMap.set(name, {
      revenue: prev.revenue + (a.service_cost || 0),
      count: prev.count + 1,
    });
  });
  const topServices = Array.from(serviceMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((s, idx) => ({ ...s, color: SERVICE_COLORS[idx % SERVICE_COLORS.length] }));

  // ── Top clientes por revenue ──
  const clientMap = new Map<string, { id: string; name: string; revenue: number; appointments: number }>();
  paidCurrent.forEach((a: any) => {
    const id = a.client?.id || 'sin-cliente';
    const name = a.client?.name || 'Cliente anónimo';
    const prev = clientMap.get(id) || { id, name, revenue: 0, appointments: 0 };
    clientMap.set(id, {
      id,
      name,
      revenue: prev.revenue + (a.service_cost || 0),
      appointments: prev.appointments + 1,
    });
  });
  const topClients = Array.from(clientMap.values())
    .filter((c) => c.id !== 'sin-cliente')
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Distribución por status ──
  const statusMap = new Map<string, number>();
  current.forEach((a: any) => {
    statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1);
  });
  const statusDistribution = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      count,
      color: STATUS_COLORS[status] || '#94A3B8',
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRevenue,
    totalAppointments,
    totalClientsNew,
    avgTicket,
    revenueChange: calcChange(totalRevenue, prevRevenue),
    apptsChange: calcChange(totalAppointments, prevApptsCount),
    ticketChange: calcChange(avgTicket, prevAvgTicket),
    monthlyRevenue,
    topServices,
    topClients,
    statusDistribution,
    rawAppointments: current,
  };
}

/**
 * Genera la serie temporal de ingresos para comparar dos períodos.
 * Para período MES → una entrada por día.
 * Para período TRIMESTRE → una entrada por semana.
 * Para período AÑO → una entrada por mes.
 */
function buildMonthlyRevenue(
  current: any[],
  previous: any[],
  period: ReportPeriod,
): { label: string; current: number; previous: number }[] {
  const buckets = new Map<string, { current: number; previous: number; sortKey: number }>();

  const isPaid = (a: any) => a.status === 'Pagado' || (a.status === 'Completada' && a.paid);

  // Generar buckets según el tipo de período
  if (period.type === 'año') {
    // 12 meses
    for (let m = 0; m < 12; m++) {
      buckets.set(MONTHS_ES[m].slice(0, 3), { current: 0, previous: 0, sortKey: m });
    }
    current.filter(isPaid).forEach((a) => {
      const m = new Date(a.date + 'T12:00:00').getMonth();
      const key = MONTHS_ES[m].slice(0, 3);
      const b = buckets.get(key)!;
      b.current += a.service_cost || 0;
    });
    previous.filter(isPaid).forEach((a: any) => {
      // Asumimos que previous es del año anterior, mismo orden de meses
      const m = new Date(a.date + 'T12:00:00').getMonth();
      const key = MONTHS_ES[m].slice(0, 3);
      const b = buckets.get(key);
      if (b) b.previous += a.service_cost || 0;
    });
  } else if (period.type === 'trimestre') {
    // Por semana del trimestre
    const start = new Date(period.startDate + 'T12:00:00');
    const end = new Date(period.endDate + 'T12:00:00');
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const weeks = Math.ceil(totalDays / 7);
    for (let w = 0; w < weeks; w++) {
      buckets.set(`Sem ${w + 1}`, { current: 0, previous: 0, sortKey: w });
    }
    current.filter(isPaid).forEach((a: any) => {
      const d = new Date(a.date + 'T12:00:00');
      const w = Math.floor((d.getTime() - start.getTime()) / 86_400_000 / 7);
      const key = `Sem ${w + 1}`;
      const b = buckets.get(key);
      if (b) b.current += a.service_cost || 0;
    });
  } else {
    // mes o custom: por día
    const start = new Date(period.startDate + 'T12:00:00');
    const end = new Date(period.endDate + 'T12:00:00');
    const totalDays = Math.min(31, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.set(String(d.getDate()), { current: 0, previous: 0, sortKey: i });
    }
    current.filter(isPaid).forEach((a: any) => {
      const d = new Date(a.date + 'T12:00:00');
      const key = String(d.getDate());
      const b = buckets.get(key);
      if (b) b.current += a.service_cost || 0;
    });
  }

  return Array.from(buckets.entries())
    .map(([label, data]) => ({ label, current: data.current, previous: data.previous, sortKey: data.sortKey }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ sortKey, ...rest }) => rest);
}

/**
 * Genera CSV exportable con todas las citas del período.
 */
export function generateCSV(rawAppointments: any[], periodLabel: string): string {
  const headers = ['Fecha', 'Hora', 'Cliente', 'Servicio', 'Precio', 'Status', 'Pagado'];
  const rows = rawAppointments.map((a: any) => [
    a.date,
    a.start_time,
    a.client?.name || 'Sin cliente',
    a.service_name || '',
    a.service_cost || 0,
    a.status || '',
    a.paid ? 'Sí' : 'No',
  ]);

  // Escapar comillas y comas
  const escape = (v: any) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [
    `# VYLTA — Reporte ${periodLabel}`,
    `# Generado: ${new Date().toLocaleString('es-MX')}`,
    headers.join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');

  return csv;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
