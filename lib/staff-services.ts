'use client';

import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Servicios por colaborador (nov 2026)
//
//   staff_members.serves_all_services = true  → atiende TODOS (default)
//   staff_members.serves_all_services = false → solo los de staff_services
//
// El link público de reservas solo ofrece a quien sí realiza los servicios
// elegidos. Se edita desde el colaborador (Equipo) o desde el servicio.
// ══════════════════════════════════════════════════════════════════════

export interface StaffSkill {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  serves_all_services: boolean;
}

async function uid(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesión expirada');
  return user.id;
}

/** Servicios asignados a un colaborador (solo aplica si serves_all = false). */
export async function fetchStaffServiceIds(staffId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('staff_services')
    .select('service_id')
    .eq('staff_id', staffId);
  if (error) {
    console.error('[fetchStaffServiceIds] error:', error);
    return [];
  }
  return (data || []).map(r => r.service_id as string);
}

/** Guarda "todos" o la lista exacta de servicios del colaborador. */
export async function saveStaffServices(staffId: string, servesAll: boolean, serviceIds: string[]) {
  const supabase = createClient();
  const userId = await uid();

  const { error: upErr } = await supabase
    .from('staff_members')
    .update({ serves_all_services: servesAll })
    .eq('id', staffId)
    .eq('user_id', userId);
  if (upErr) throw upErr;

  // Reemplazo completo de la lista (borrar + insertar).
  const { error: delErr } = await supabase.from('staff_services').delete().eq('staff_id', staffId);
  if (delErr) throw delErr;
  if (!servesAll && serviceIds.length) {
    const rows = Array.from(new Set(serviceIds)).map(service_id => ({ staff_id: staffId, service_id, user_id: userId }));
    const { error: insErr } = await supabase.from('staff_services').insert(rows);
    if (insErr) throw insErr;
  }
}

/** Colaboradores del negocio + qué colaboradores realizan un servicio dado. */
export async function fetchServiceStaff(serviceId: string | null): Promise<{ staff: StaffSkill[]; doers: Set<string> }> {
  const supabase = createClient();
  const userId = await uid();
  const { data: staff, error } = await supabase
    .from('staff_members')
    .select('id,name,color,is_active,serves_all_services')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[fetchServiceStaff] error:', error);
    return { staff: [], doers: new Set() };
  }
  const list = (staff || []) as StaffSkill[];
  const doers = new Set<string>(list.filter(s => s.serves_all_services !== false).map(s => s.id));
  if (serviceId) {
    const { data: rows } = await supabase.from('staff_services').select('staff_id').eq('service_id', serviceId);
    (rows || []).forEach(r => doers.add(r.staff_id as string));
  }
  return { staff: list, doers };
}

/**
 * Guarda quién realiza UN servicio (desde el formulario del servicio).
 * - Marcar a alguien con lista → se agrega el servicio a su lista.
 * - Desmarcar a alguien que atendía "todos" → pasa a "solo algunos" con
 *   todos los servicios del negocio MENOS este (no pierde los demás).
 * - Desmarcar a alguien con lista → se quita el servicio de su lista.
 */
export async function saveServiceStaff(
  serviceId: string,
  staff: StaffSkill[],
  before: Set<string>,
  after: Set<string>,
) {
  const supabase = createClient();
  const userId = await uid();
  let allServiceIds: string[] | null = null;

  for (const m of staff) {
    const was = before.has(m.id);
    const now = after.has(m.id);
    if (was === now) continue;

    if (now) {
      if (m.serves_all_services !== false) continue; // ya atiende todo
      const { error } = await supabase
        .from('staff_services')
        .upsert({ staff_id: m.id, service_id: serviceId, user_id: userId }, { onConflict: 'staff_id,service_id', ignoreDuplicates: true });
      if (error) throw error;
    } else if (m.serves_all_services !== false) {
      if (!allServiceIds) {
        const { data, error } = await supabase.from('services').select('id').eq('user_id', userId);
        if (error) throw error;
        allServiceIds = (data || []).map(r => r.id as string);
      }
      await saveStaffServices(m.id, false, allServiceIds.filter(id => id !== serviceId));
    } else {
      const { error } = await supabase
        .from('staff_services')
        .delete()
        .eq('staff_id', m.id)
        .eq('service_id', serviceId);
      if (error) throw error;
    }
  }
}
