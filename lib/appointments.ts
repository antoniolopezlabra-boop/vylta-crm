import { createClient } from '@/lib/supabase/client';
import { toLocalDateString } from '@/lib/date-utils';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para citas
// ══════════════════════════════════════════════════════════════════════

export interface Appointment {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name_temp: string | null;
  service_name: string;
  service_cost: number | null;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  paid: boolean | null;
  notes: string | null;
  client?: { name: string } | null;
}

export interface AppointmentWithMeta extends Appointment {
  displayClientName: string;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Carga las citas de un rango de fechas. La vista semanal carga lunes→domingo.
 */
export async function fetchAppointmentsInRange(
  startDate: string,
  endDate: string,
): Promise<AppointmentWithMeta[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('appointments')
    .select('id, user_id, client_id, client_name_temp, service_name, service_cost, date, start_time, end_time, duration_minutes, status, paid, notes, client:clients(name)')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  return (data || []).map((apt: any) => {
    const startMinutes = timeToMinutes(apt.start_time);
    const duration = apt.duration_minutes || 60;
    const endMinutes = apt.end_time ? timeToMinutes(apt.end_time) : startMinutes + duration;
    return {
      ...apt,
      displayClientName: apt.client?.name || apt.client_name_temp || 'Cliente',
      startMinutes,
      endMinutes,
    };
  });
}

/** Convierte "HH:MM" a minutos desde medianoche. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Devuelve los 7 días de la semana que contiene la fecha dada (lunes-domingo).
 */
export function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const dow = d.getDay();
  // Retroceder hasta el lunes
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

/** Convierte minutos desde medianoche a string "HH:MM". */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Estilos por status para el bloque visual del calendario. */
export const APPT_STATUS_STYLES: Record<string, { bg: string; border: string; text: string; barColor: string }> = {
  Confirmada: { bg: 'bg-vylta-green-500/10',  border: 'border-vylta-green-500/40',  text: 'text-vylta-green-700 dark:text-vylta-green-400',  barColor: '#10B981' },
  Pendiente:  { bg: 'bg-vylta-amber-500/10',  border: 'border-vylta-amber-500/40',  text: 'text-vylta-amber-700 dark:text-amber-400',         barColor: '#F59E0B' },
  Completada: { bg: 'bg-vylta-indigo-500/10', border: 'border-vylta-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-400',             barColor: '#6366F1' },
  Pagado:     { bg: 'bg-vylta-green-500/15',  border: 'border-vylta-green-500/50',  text: 'text-vylta-green-700 dark:text-vylta-green-400',  barColor: '#10B981' },
  Cancelada:  { bg: 'bg-secondary',           border: 'border-border',              text: 'text-muted-foreground',                            barColor: '#94A3B8' },
  'No asistió': { bg: 'bg-vylta-rose-500/10', border: 'border-vylta-rose-500/40',   text: 'text-rose-700 dark:text-rose-400',                 barColor: '#F43F5E' },
};

export function getApptStatusStyle(status: string) {
  return APPT_STATUS_STYLES[status] || APPT_STATUS_STYLES.Pendiente;
}
