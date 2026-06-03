import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para gestión de equipo (colaboradores).
//
// Schema alineado con la app móvil:
//   • staff_members: id, user_id, name, role, color, avatar_url, is_active,
//     sort_order, created_at
//   • staff_hours: staff_id, day_of_week (0=Dom..6=Sab), is_open,
//     start_time, end_time
//   • staff_accounts: staff_member_id, user_id (acceso a app móvil)
//
// Plan requerido: Premium (badge "Luxury" visible al usuario)
// Límite: configurable por usuario (ver MAX_STAFF / getStaffLimit abajo).
//
// ⚡ ACTUALIZACIÓN (May 19 2026):
// Añadidos helpers createStaffAccount() y deleteStaffAccount() que
// invocan Edge Functions de Supabase. Esto permite gestionar acceso a
// la app móvil desde el CRM web (antes era exclusivo de la app móvil).
//
// SEGURIDAD: Las Edge Functions corren en el servidor con service_role
// key y validan que organizationUserId matchee el usuario autenticado.
// El JWT del browser se envía automáticamente vía supabase.functions.invoke.
// ══════════════════════════════════════════════════════════════════════

// ⚡ Jun 2026: el límite de colaboradores dejó de ser fijo. Ahora es
// configurable POR USUARIO en la columna subscription_plans.max_staff,
// editable por un administrador desde el panel /admin/tenants/[id].
// MAX_STAFF queda como VALOR POR DEFECTO y fallback seguro (mismo número
// que antes) por si la columna no está disponible todavía. Esto sienta
// las bases para una futura suscripción Enterprise con más colaboradores.
// Para obtener el límite REAL del usuario actual, usar getStaffLimit().
export const MAX_STAFF = 5;

export const STAFF_PALETTE = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
];

export const STAFF_ROLES = ['Peluquero', 'Estilista', 'Barbero', 'Esteticista', 'Masajista', 'Médico', 'Asistente', 'Otro'];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes',     short: 'Lun' },
  { value: 2, label: 'Martes',    short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves',    short: 'Jue' },
  { value: 5, label: 'Viernes',   short: 'Vie' },
  { value: 6, label: 'Sábado',    short: 'Sáb' },
  { value: 0, label: 'Domingo',   short: 'Dom' },
];

export interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  color: string;
  avatar_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface StaffHour {
  staff_id: string;
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
}

export interface StaffMemberWithStats extends StaffMember {
  hasAccount: boolean;
  appointmentsCount?: number;
  monthRevenue?: number;
}

/**
 * Verifica si el usuario tiene un plan que permite gestión de equipo.
 * Plan Premium (DB) = Luxury (UI). El plan Básico (DB) = Premium (UI) NO incluye equipo.
 */
export async function hasTeamAccess(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('subscription_plans')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return false;
  const planType = (data.plan_type || '').toLowerCase();
  const status = (data.status || '').toLowerCase();
  const validStatus = ['active', 'pending_cancellation', 'trialing'].includes(status);
  return planType === 'premium' && validStatus;
}

/**
 * Obtiene el límite de colaboradores del usuario actual.
 * Lee subscription_plans.max_staff (el RLS permite leer la propia fila).
 *
 * DEFENSIVO: si la columna no existe todavía (p. ej. antes de correr la
 * migración) o si ocurre cualquier error, devuelve el valor por defecto
 * (MAX_STAFF = 5), preservando exactamente el comportamiento anterior.
 */
export async function getStaffLimit(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return MAX_STAFF;
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('max_staff')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return MAX_STAFF;
    const v = (data as any)?.max_staff;
    return typeof v === 'number' && v > 0 ? v : MAX_STAFF;
  } catch {
    return MAX_STAFF;
  }
}

/**
 * Carga la lista de colaboradores con sus cuentas (si tienen acceso a la app).
 */
export async function fetchStaff(): Promise<StaffMemberWithStats[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [staffRes, accountsRes] = await Promise.all([
    supabase
      .from('staff_members')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('staff_accounts')
      .select('staff_member_id'),
  ]);

  if (staffRes.error) {
    console.error('[fetchStaff] error:', staffRes.error);
    return [];
  }

  const accountSet = new Set((accountsRes.data || []).map((a: any) => a.staff_member_id));

  return (staffRes.data || []).map((s: any) => ({
    ...s,
    hasAccount: accountSet.has(s.id),
  }));
}

/**
 * Carga los horarios de un colaborador. Si no existen, devuelve un default
 * (L-V abierto 9-18, S-D cerrado).
 */
export async function fetchStaffHours(staffId: string): Promise<StaffHour[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('staff_hours')
    .select('*')
    .eq('staff_id', staffId);

  if (data && data.length > 0) return data as StaffHour[];

  // Default: L-V abierto, S-D cerrado
  return DAYS_OF_WEEK.map(d => ({
    staff_id: staffId,
    day_of_week: d.value,
    is_open: d.value >= 1 && d.value <= 5,
    start_time: '09:00',
    end_time: '18:00',
  }));
}

/**
 * Carga los horarios del negocio para usarlos como default al crear un colaborador.
 */
export async function fetchBusinessHoursAsDefault(): Promise<StaffHour[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return DAYS_OF_WEEK.map(d => ({
      staff_id: '',
      day_of_week: d.value,
      is_open: d.value >= 1 && d.value <= 5,
      start_time: '09:00',
      end_time: '18:00',
    }));
  }

  const { data } = await supabase
    .from('business_hours')
    .select('day_of_week, is_open, start_time, end_time')
    .eq('user_id', user.id);

  return DAYS_OF_WEEK.map(d => {
    const bh = (data || []).find((h: any) => h.day_of_week === d.value);
    return bh
      ? { staff_id: '', day_of_week: d.value, is_open: bh.is_open, start_time: bh.start_time, end_time: bh.end_time }
      : { staff_id: '', day_of_week: d.value, is_open: d.value >= 1 && d.value <= 5, start_time: '09:00', end_time: '18:00' };
  });
}

export interface SaveStaffInput {
  id?: string;
  name: string;
  role: string | null;
  color: string;
  is_active: boolean;
  hours: { day_of_week: number; is_open: boolean; start_time: string; end_time: string }[];
}

/**
 * Crea o actualiza un colaborador y sus horarios.
 * Estrategia: borra todos los horarios existentes y reinserta los nuevos
 * (mismo patrón que la app móvil).
 */
export async function saveStaffMember(input: SaveStaffInput): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  let staffId = input.id;

  if (!staffId) {
    // CREATE
    const { data, error } = await supabase
      .from('staff_members')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        role: input.role?.trim() || null,
        color: input.color,
        is_active: input.is_active,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[saveStaffMember] create error:', error);
      return { error: error?.message || 'No se pudo crear el colaborador' };
    }
    staffId = data.id;
  } else {
    // UPDATE
    const { error } = await supabase
      .from('staff_members')
      .update({
        name: input.name.trim(),
        role: input.role?.trim() || null,
        color: input.color,
        is_active: input.is_active,
      })
      .eq('id', staffId)
      .eq('user_id', user.id);
    if (error) {
      console.error('[saveStaffMember] update error:', error);
      return { error: error.message };
    }
    // Borrar horarios existentes
    await supabase.from('staff_hours').delete().eq('staff_id', staffId);
  }

  // Insertar horarios
  const hoursToInsert = input.hours.map(h => ({
    staff_id: staffId,
    day_of_week: h.day_of_week,
    is_open: h.is_open,
    start_time: h.start_time,
    end_time: h.end_time,
  }));
  const { error: hErr } = await supabase.from('staff_hours').insert(hoursToInsert);
  if (hErr) {
    console.error('[saveStaffMember] hours insert error:', hErr);
    return { error: hErr.message };
  }

  return { id: staffId! };
}

export async function toggleStaffActive(id: string, newState: boolean): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('staff_members')
    .update({ is_active: newState })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    console.error('[toggleStaffActive] error:', error);
    return false;
  }
  return true;
}

export async function deleteStaffMember(id: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('staff_members')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    console.error('[deleteStaffMember] error:', error);
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// GESTIÓN DE ACCESO A LA APP MÓVIL (staff_accounts)
//
// Estos helpers invocan Edge Functions de Supabase porque requieren
// service_role key para operar con el sistema de auth de Supabase.
//
// FLUJO:
//   1. Browser invoca supabase.functions.invoke(...)
//   2. Supabase incluye automáticamente el JWT del usuario en headers
//   3. Edge Function valida que organizationUserId === auth.uid()
//   4. Edge Function usa service_role key para crear/eliminar auth user
//   5. Edge Function inserta/elimina row en staff_accounts
//
// REUTILIZAR las MISMAS Edge Functions que la app móvil:
//   • create-staff-account
//   • delete-staff-account
//
// Esto garantiza que cualquier mejora en la lógica (ej. validación de
// password complejidad) impacte ambos clients sin código duplicado.
// ══════════════════════════════════════════════════════════════════════

export interface CreateStaffAccountInput {
  staffMemberId: string;
  email: string;
  password: string;
}

export interface CreateStaffAccountResult {
  email: string;
  password: string;
}

/**
 * Crea una cuenta de acceso a la app móvil para un colaborador.
 *
 * @returns Las credenciales creadas para mostrar al dueño (single-shot).
 * @throws Error con mensaje legible si algo falla.
 */
export async function createStaffAccount(
  input: CreateStaffAccountInput,
): Promise<CreateStaffAccountResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Validaciones cliente para fallar rápido sin invocar la Edge Function
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Ingresa un correo electrónico');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo no tiene formato válido');
  }
  if (input.password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  const { data, error } = await supabase.functions.invoke('create-staff-account', {
    body: {
      staffMemberId: input.staffMemberId,
      email,
      password: input.password,
      organizationUserId: user.id,
    },
  });

  // Las Edge Functions de Supabase pueden devolver error en dos lugares:
  // 1. `error` (network o fallo de invocación)
  // 2. `data.error` (la función corrió pero devolvió error de negocio)
  if (error) {
    console.error('[createStaffAccount] invoke error:', error);
    throw new Error(error.message || 'No se pudo crear el acceso');
  }
  if (data?.error) {
    console.error('[createStaffAccount] business error:', data.error);
    throw new Error(data.error);
  }

  return { email, password: input.password };
}

/**
 * Revoca el acceso a la app móvil de un colaborador.
 * El colaborador YA NO podrá iniciar sesión, pero sus citas históricas
 * y la relación con staff_members se mantienen intactas.
 */
export async function deleteStaffAccount(staffMemberId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase.functions.invoke('delete-staff-account', {
    body: {
      staffMemberId,
      organizationUserId: user.id,
    },
  });

  if (error) {
    console.error('[deleteStaffAccount] invoke error:', error);
    throw new Error(error.message || 'No se pudo revocar el acceso');
  }
  if (data?.error) {
    console.error('[deleteStaffAccount] business error:', data.error);
    throw new Error(data.error);
  }
}
