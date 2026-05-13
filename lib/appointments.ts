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

// ══════════════════════════════════════════════════════════════════════
// ESTILOS DE STATUS — Brand Kit VYLTA v1.0
//
// CRÍTICO: cada status tiene un color DIFERENTE para que la agenda no se
// vea como un muro monócromo. La idea es jerarquía visual ejecutiva:
//
//   🟢 Pagado / Completada  → verde slido (éxito, dinero en mano)
//   🔵 Confirmada            → azul sky (locked-in, no cobrada aún)
//   🟡 Pendiente / En espera → ámbar (atención requerida)
//   🟣 Solicitud             → morado luxury (entró por link, decidir)
//   🟦 Reagendada            → índigo (movimiento)
//   ⚫ Cancelada / No-show   → gris muted (descartada)
//   🔴 Rechazada             → rojo apagado (decisión negativa)
//
// Cada estilo aporta:
//   bg     → fill MUY tenue (alpha 8–12%) para no saturar
//   border → color medio para el border-left de 3px
//   text   → color claro para que el texto destaque sobre el bg
//   dot    → color sólido para el indicador pequeño
//   accent → color para precio + acentos (más saturado)
//
// Todos los hex están alineados con el brand kit (sin #6366F1 indigo
// legacy y sin tokens vylta-*-500 inventados).
// ══════════════════════════════════════════════════════════════════════

export interface ApptStatusStyle {
  /** Background fill tenue del bloque */
  bg: string;
  /** Color del border-left de 3px (hex string para style={}) */
  barColor: string;
  /** Color del nombre del cliente */
  text: string;
  /** Color del precio + dot indicador (más saturado, hex string) */
  accent: string;
  /** Texto muted (servicio, hora) */
  textMuted: string;
  // Legacy: mantenemos `border` por compatibilidad con código viejo
  border?: string;
}

export const APPT_STATUS_STYLES: Record<string, ApptStatusStyle> = {
  // 🟢 PAGADO — verde sólido (éxito máximo, dinero cobrado)
  Pagado: {
    bg: 'bg-vylta-green/[0.10]',
    barColor: '#10B981',
    text: 'text-vylta-green-light',
    accent: '#3ECF8E',
    textMuted: 'text-vylta-green/70',
    border: 'border-vylta-green/40',
  },
  // 🟢 COMPLETADA — verde tenue (servicio dado, falta cobro)
  Completada: {
    bg: 'bg-vylta-green/[0.08]',
    barColor: '#059669',
    text: 'text-vylta-green-light',
    accent: '#10B981',
    textMuted: 'text-vylta-green/60',
    border: 'border-vylta-green/35',
  },
  // 🔵 CONFIRMADA — azul sky (locked-in, todavía no se da el servicio)
  Confirmada: {
    bg: 'bg-vylta-sky/[0.10]',
    barColor: '#0EA5E9',
    text: 'text-sky-300',
    accent: '#38BDF8',
    textMuted: 'text-sky-400/70',
    border: 'border-vylta-sky/40',
  },
  // 🟡 PENDIENTE — ámbar (necesita confirmación)
  Pendiente: {
    bg: 'bg-vylta-amber/[0.10]',
    barColor: '#F59E0B',
    text: 'text-amber-300',
    accent: '#FBBF24',
    textMuted: 'text-amber-400/70',
    border: 'border-vylta-amber/40',
  },
  // 🟡 EN ESPERA — ámbar más pálido (waitlist)
  'En espera': {
    bg: 'bg-vylta-amber/[0.08]',
    barColor: '#FBBF24',
    text: 'text-amber-300',
    accent: '#F59E0B',
    textMuted: 'text-amber-400/60',
    border: 'border-vylta-amber/30',
  },
  // 🟣 SOLICITUD — morado luxury (entró del link público)
  Solicitud: {
    bg: 'bg-vylta-luxury/[0.12]',
    barColor: '#A78BFA',
    text: 'text-violet-300',
    accent: '#C4B5FD',
    textMuted: 'text-violet-400/70',
    border: 'border-vylta-luxury/40',
  },
  // 🟦 REAGENDADA — índigo más azul (se movió de fecha)
  Reagendada: {
    bg: 'bg-indigo-500/[0.10]',
    barColor: '#818CF8',
    text: 'text-indigo-300',
    accent: '#A5B4FC',
    textMuted: 'text-indigo-400/70',
    border: 'border-indigo-400/40',
  },
  // ⚫ CANCELADA — gris muted (sin foco visual)
  Cancelada: {
    bg: 'bg-vylta-card/60',
    barColor: '#64748B',
    text: 'text-vylta-muted line-through',
    accent: '#94A3B8',
    textMuted: 'text-vylta-subtle line-through',
    border: 'border-border',
  },
  // 🔴 NO ASISTIÓ — rosa apagado (perdida)
  'No asistió': {
    bg: 'bg-vylta-rose/[0.08]',
    barColor: '#F43F5E',
    text: 'text-rose-300',
    accent: '#FB7185',
    textMuted: 'text-rose-400/60',
    border: 'border-vylta-rose/30',
  },
  // 🔴 RECHAZADA — rosa sólido (decisión negativa)
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
