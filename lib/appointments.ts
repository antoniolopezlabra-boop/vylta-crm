import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Citas — schema alineado con app móvil.
// Status válidos: Pendiente, Confirmada, Completada, Pagado, Reagendada,
// En espera, Solicitud, Cancelada, No asistió, Rechazada.
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
  client?: { id?: string; name: string; phone: string | null; email?: string | null } | null;
  staff?: { id?: string; name: string; color: string; role?: string | null } | null;
}

export interface AppointmentWithMeta extends Appointment {
  displayClientName: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  isPaid: boolean;
}

export const ACTIVE_STATUSES = ['Pendiente', 'Confirmada', 'Completada', 'Pagado', 'Reagendada', 'En espera', 'Solicitud'];
export const EXCLUDED_STATUSES = ['Cancelada', 'No asistió', 'Rechazada'];
export const PAID_STATUSES = ['Pagado', 'Completada'];

export async function fetchAppointmentsInRange(
  startDate: string,
  endDate: string,
): Promise<AppointmentWithMeta[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('appointments')
    .select('*, client:clients(id, name, phone, email), staff:staff_members(id, name, color, role)')
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

export async function fetchAppointmentById(id: string): Promise<Appointment | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('appointments')
    .select('*, client:clients(id, name, phone, email), staff:staff_members(id, name, color, role)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[fetchAppointmentById] Error:', error);
    return null;
  }
  return data as any;
}

export async function updateAppointmentStatus(
  id: string,
  newStatus: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[updateAppointmentStatus] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

export async function assignStaffToAppointment(
  appointmentId: string,
  staffId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({ staff_id: staffId, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[assignStaffToAppointment] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[deleteAppointment] Error:', error);
    return false;
  }
  return true;
}

/** Detecta qué colaboradores están libres/ocupados a esa hora (excluyendo la propia cita). */
export async function getStaffAvailability(
  date: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time, status, id')
    .eq('user_id', user.id)
    .eq('date', date)
    .not('staff_id', 'is', null);

  if (!data) return new Set();

  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const newStart = timeToMin(startTime);
  const newEnd = timeToMin(endTime);

  const busyStaff = new Set<string>();
  data.forEach((a: any) => {
    if (a.id === excludeAppointmentId) return;
    if (EXCLUDED_STATUSES.includes(a.status)) return;
    const aStart = timeToMin(a.start_time);
    const aEnd = a.end_time ? timeToMin(a.end_time) : aStart + 60;
    if (newStart < aEnd && newEnd > aStart) busyStaff.add(a.staff_id);
  });
  return busyStaff;
}

export async function fetchActiveStaff(): Promise<Array<{ id: string; name: string; color: string; role: string | null }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('staff_members')
    .select('id, name, color, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data || []) as any;
}

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
  Solicitud:    { bg: 'bg-blue-500/10',         border: 'border-blue-500/40',         text: 'text-blue-700 dark:text-blue-400',                 barColor: '#3B82F6' },
  Cancelada:    { bg: 'bg-secondary',           border: 'border-border',              text: 'text-muted-foreground',                            barColor: '#94A3B8' },
  'No asistió': { bg: 'bg-vylta-rose-500/10',   border: 'border-vylta-rose-500/40',   text: 'text-rose-700 dark:text-rose-400',                 barColor: '#F43F5E' },
  Rechazada:    { bg: 'bg-vylta-rose-500/10',   border: 'border-vylta-rose-500/40',   text: 'text-rose-700 dark:text-rose-400',                 barColor: '#F43F5E' },
};

export function getApptStatusStyle(status: string) {
  return APPT_STATUS_STYLES[status] || APPT_STATUS_STYLES.Pendiente;
}
