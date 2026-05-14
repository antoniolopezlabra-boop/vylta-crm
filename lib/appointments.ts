import { createClient } from '@/lib/supabase/client';
import { getBlocksForDate, findBlockConflict, type TimeBlock } from '@/lib/time-blocks';

// ═════════════════════════════════════════════════════════════════════
// Citas — schema alineado con app móvil.
// Status válidos: Pendiente, Confirmada, Completada, Pagado, Reagendada,
// En espera, Solicitud, Cancelada, No asistió, Rechazada.
// ═════════════════════════════════════════════════════════════════════

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

/**
 * Status que permiten eliminación permanente desde la UI.
 * Solo citas ya cerradas pueden ser borradas para evitar pérdida
 * accidental de citas activas o pagadas (que afectan historial fiscal).
 */
export const HARD_DELETABLE_STATUSES = ['Cancelada', 'Rechazada'];

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

/**
 * Hard delete — elimina permanentemente de la BD. NO se puede recuperar.
 *
 * REGLAS DE SEGURIDAD:
 * - Solo debe usarse para citas con status en HARD_DELETABLE_STATUSES
 *   (Cancelada, Rechazada). La validación debe ocurrir en la UI antes
 *   de llamar a esta función para evitar pérdida de historial fiscal.
 * - Para cancelación cotidiana usar softDeleteAppointment (preserva la
 *   cita pero cambia status a Cancelada con opción de undo).
 *
 * Retorna formato consistente con el resto de funciones del módulo.
 */
export async function hardDeleteAppointment(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  // Verificar status actual antes de borrar (defensa en profundidad).
  // La UI también valida, pero esto previene llamadas maliciosas via consola.
  const { data: current, error: fetchErr } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr || !current) {
    return { error: 'No se encontró la cita' };
  }

  if (!HARD_DELETABLE_STATUSES.includes(current.status)) {
    return {
      error: `Solo se pueden eliminar permanentemente las citas Canceladas o Rechazadas. Status actual: ${current.status}`,
    };
  }

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[hardDeleteAppointment] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * @deprecated Usar hardDeleteAppointment en su lugar (formato de retorno consistente).
 * Esta función se mantiene por compatibilidad con código legacy.
 */
export async function deleteAppointment(id: string): Promise<boolean> {
  const result = await hardDeleteAppointment(id);
  return 'ok' in result;
}

/**
 * Soft delete — pone status='Cancelada' guardando el status original
 * en notes para poder restaurar con undo. Más seguro que hard delete.
 */
export async function softDeleteAppointment(
  id: string,
  previousStatus: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'Cancelada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[softDeleteAppointment] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Restaura una cita cancelada al status anterior (operación inversa del soft delete).
 */
export async function restoreAppointment(
  id: string,
  restoreStatus: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({
      status: restoreStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateAppointmentSchedule(
  id: string,
  date: string,
  startTime: string,
  endTime: string,
  status: 'Reagendada' | 'Confirmada' | 'Pendiente' = 'Reagendada',
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({
      date,
      start_time: startTime,
      end_time: endTime,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[updateAppointmentSchedule] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

export interface AppointmentUpdatePayload {
  client_id: string;
  service_name: string;
  service_cost: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  staff_id: string | null;
}

/**
 * Actualiza TODOS los campos editables de una cita. Usar desde el form
 * de edición. Preserva updated_at en el server.
 */
export async function updateAppointmentFull(
  id: string,
  data: AppointmentUpdatePayload,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase
    .from('appointments')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[updateAppointmentFull] Error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Devuelve el conjunto de staff_ids ocupados en una franja horaria específica.
 * Considera (a) citas existentes activas (b) bloqueos de tiempo aplicables.
 */
export async function getStaffAvailability(
  date: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string,
  timeBlocks?: TimeBlock[],
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
  const slotDuration = newEnd - newStart;

  const busyStaff = new Set<string>();

  // 1. Por citas activas
  data.forEach((a: any) => {
    if (a.id === excludeAppointmentId) return;
    if (EXCLUDED_STATUSES.includes(a.status)) return;
    const aStart = timeToMin(a.start_time);
    const aEnd = a.end_time ? timeToMin(a.end_time) : aStart + 60;
    if (newStart < aEnd && newEnd > aStart) busyStaff.add(a.staff_id);
  });

  // 2. Por bloqueos de tiempo (si fueron provistos)
  if (timeBlocks && timeBlocks.length > 0) {
    const allStaffIds = new Set<string>();
    data.forEach((a: any) => { if (a.staff_id) allStaffIds.add(a.staff_id); });

    const businessBlocks = getBlocksForDate(timeBlocks, date, null);
    const businessConflict = findBlockConflict(newStart, slotDuration, businessBlocks);
    if (businessConflict) {
      allStaffIds.forEach(id => busyStaff.add(id));
    }

    allStaffIds.forEach(staffId => {
      const staffBlocks = getBlocksForDate(timeBlocks, date, staffId);
      const staffConflict = findBlockConflict(newStart, slotDuration, staffBlocks);
      if (staffConflict) busyStaff.add(staffId);
    });
  }

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

// ═════════════════════════════════════════════════════════════════════
// ESTILOS DE STATUS — Brand Kit VYLTA v1.0
// ═════════════════════════════════════════════════════════════════════

export interface ApptStatusStyle {
  bg: string;
  barColor: string;
  text: string;
  accent: string;
  textMuted: string;
  border?: string;
}

export const APPT_STATUS_STYLES: Record<string, ApptStatusStyle> = {
  Pagado: {
    bg: 'bg-vylta-green/[0.10]',
    barColor: '#10B981',
    text: 'text-vylta-green-light',
    accent: '#3ECF8E',
    textMuted: 'text-vylta-green/70',
    border: 'border-vylta-green/40',
  },
  Completada: {
    bg: 'bg-vylta-green/[0.08]',
    barColor: '#059669',
    text: 'text-vylta-green-light',
    accent: '#10B981',
    textMuted: 'text-vylta-green/60',
    border: 'border-vylta-green/35',
  },
  Confirmada: {
    bg: 'bg-vylta-sky/[0.10]',
    barColor: '#0EA5E9',
    text: 'text-sky-300',
    accent: '#38BDF8',
    textMuted: 'text-sky-400/70',
    border: 'border-vylta-sky/40',
  },
  Pendiente: {
    bg: 'bg-vylta-amber/[0.10]',
    barColor: '#F59E0B',
    text: 'text-amber-300',
    accent: '#FBBF24',
    textMuted: 'text-amber-400/70',
    border: 'border-vylta-amber/40',
  },
  'En espera': {
    bg: 'bg-vylta-amber/[0.08]',
    barColor: '#FBBF24',
    text: 'text-amber-300',
    accent: '#F59E0B',
    textMuted: 'text-amber-400/60',
    border: 'border-vylta-amber/30',
  },
  Solicitud: {
    bg: 'bg-vylta-luxury/[0.12]',
    barColor: '#A78BFA',
    text: 'text-violet-300',
    accent: '#C4B5FD',
    textMuted: 'text-violet-400/70',
    border: 'border-vylta-luxury/40',
  },
  Reagendada: {
    bg: 'bg-indigo-500/[0.10]',
    barColor: '#818CF8',
    text: 'text-indigo-300',
    accent: '#A5B4FC',
    textMuted: 'text-indigo-400/70',
    border: 'border-indigo-400/40',
  },
  Cancelada: {
    bg: 'bg-vylta-card/60',
    barColor: '#64748B',
    text: 'text-vylta-muted line-through',
    accent: '#94A3B8',
    textMuted: 'text-vylta-subtle line-through',
    border: 'border-border',
  },
  'No asistió': {
    bg: 'bg-vylta-rose/[0.08]',
    barColor: '#F43F5E',
    text: 'text-rose-300',
    accent: '#FB7185',
    textMuted: 'text-rose-400/60',
    border: 'border-vylta-rose/30',
  },
  Rechazada: {
    bg: 'bg-vylta-rose/[0.10]',
    barColor: '#E11D48',
    text: 'text-rose-300',
    accent: '#F43F5E',
    textMuted: 'text-rose-400/70',
    border: 'border-vylta-rose/40',
  },
};

export function getApptStatusStyle(status: string): ApptStatusStyle {
  return APPT_STATUS_STYLES[status] || APPT_STATUS_STYLES.Pendiente;
}
