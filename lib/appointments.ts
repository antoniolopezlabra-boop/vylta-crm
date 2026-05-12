import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para citas
//
// IMPORTANTE: Schema alineado con la app móvil (utils/api.ts).
// La tabla appointments NO tiene 'duration_minutes' ni 'paid';
// la duración se calcula de end_time - start_time, y "pagado" se
// determina con status === 'Pagado'.
// ══════════════════════════════════════════════════════════════════════

export interface Appointment {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name_temp: string | null;
  client_phone_temp: string | null;
  service_name: string;
  service_cost: number | null;
  date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
  staff_id: string | null;
  source: string | null;
  client?: { name: string; phone: string | null } | null;
}

export interface AppointmentWithMeta extends Appointment {
  displayClientName: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  isPaid: boolean;
}

// Estados que SI cuentan como citas activas (no canceladas/rechazadas)
export const ACTIVE_STATUSES = ['Pendiente', 'Confirmada', 'Completada', 'Pagado', 'Reagendada', 'En espera', 'Solicitud'];
export const EXCLUDED_STATUSES = ['Cancelada', 'No asistió', 'Rechazada'];
export const PAID_STATUSES = ['Pagado', 'Completada'];

/**
 * Carga las citas de un rango de fechas. La vista semanal carga lunes→domingo.
 * Usa select * para evitar problemas si la BD agrega/quita columnas.
 */
export async function fetchAppointmentsInRange(
  startDate: string,
  endDate: string,
): Promise<AppointmentWithMeta[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('appointments')
    .select('*, client:clients(name, phone)')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[fetchAppointmentsInRange] Error:', error);
    return [];
  }

  return (data || []).map(decorate);
}

/** Convierte una cita raw de la BD en AppointmentWithMeta con metadatos. */
function decorate(apt: any): AppointmentWithMeta {
  const startMinutes = timeToMinutes(apt.start_time || '00:00');
  const endMinutes = apt.end_time ? timeToMinutes(apt.end_time) : startMinutes + 30;
  const durationMinutes = Math.max(15, endMinutes - startMinutes);
  return {
    ...apt,
    displayClientName: apt.client?.name || apt.client_name_temp || 'Cliente',
    startMinutes,
    endMinutes,
    durationMinutes,
    isPaid: PAID_STATUSES.includes(apt.status),
  };
}

/** Convierte "HH:MM" o "HH:MM:SS" a minutos desde medianoche. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const APPT_STATUS_STYLES: Record<string, { bg: string; border: string; text: string; barColor: string }> = {
  Confirmada:   { bg: 'bg-vylta-green-500/10',  border: 'border-vylta-green-500/40',  text: 'text-vylta-green-700 dark:text-vylta-green-400',  barColor: '#10B981' },
  Pendiente:    { bg: 'bg-vylta-amber-500/10',  border: 'border-vylta-amber-500/40',  text: 'text-vylta-amber-700 dark:text-amber-400',         barColor: '#F59E0B' },
  Completada:   { bg: 'bg-vylta-indigo-500/10', border: 'border-vylta-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-400',             barColor: '#6366F1' },
  Pagado:       { bg: 'bg-vylta-green-500/15',  border: 'border-vylta-green-500/50',  text: 'text-vylta-green-700 dark:text-vylta-green-400',  barColor: '#059669' },
  Reagendada:   { bg: 'bg-vylta-indigo-500/10', border: 'border-vylta-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-400',             barColor: '#8B5CF6' },
  'En espera':  { bg: 'bg-vylta-amber-500/10',  border: 'border-vylta-amber-500/40',  text: 'text-vylta-amber-700 dark:text-amber-400',         barColor: '#FBBF24' },
  Solicitud:    { bg: 'bg-vylta-amber-500/10',  border: 'border-vylta-amber-500/40',  text: 'text-vylta-amber-700 dark:text-amber-400',         barColor: '#FBBF24' },
  Cancelada:    { bg: 'bg-secondary',           border: 'border-border',              text: 'text-muted-foreground',                            barColor: '#94A3B8' },
  'No asistió': { bg: 'bg-vylta-rose-500/10',   border: 'border-vylta-rose-500/40',   text: 'text-rose-700 dark:text-rose-400',                 barColor: '#F43F5E' },
  Rechazada:    { bg: 'bg-vylta-rose-500/10',   border: 'border-vylta-rose-500/40',   text: 'text-rose-700 dark:text-rose-400',                 barColor: '#F43F5E' },
};

export function getApptStatusStyle(status: string) {
  return APPT_STATUS_STYLES[status] || APPT_STATUS_STYLES.Pendiente;
}
