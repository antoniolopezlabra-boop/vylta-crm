import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';

// ═════════════════════════════════════════════════════════════════════
// Sistema de Administradores VYLTA
//
// La tabla `vylta_admins` en Supabase guarda los usuarios que tienen
// acceso al panel Control Center.
//
// Campos:
//   - user_id (uuid, FK auth.users)
//   - role ('super_admin' | 'admin')
//   - is_active (bool)
//   - name (texto, nombre del admin)
//   - created_at
//
// La lógica del CRM web es:
//   - Layout autenticado (app/(app)/layout.tsx) verifica si user_id está
//     en vylta_admins con is_active=true.
//   - Si lo está → redirect('/admin')
//   - Si no → continúa al CRM normal
//
// Esto se ejecuta en el SERVIDOR (Server Component) para evitar flash
// de contenido incorrecto al usuario antes de redirigir.
// ═════════════════════════════════════════════════════════════════════

export type AdminRole = 'super_admin' | 'admin';

export interface AdminUser {
  user_id: string;
  role: AdminRole;
  is_active: boolean;
  name: string | null;
  created_at?: string;
}

/**
 * Server-side: Verifica si el usuario autenticado actual es admin.
 * Devuelve el registro de admin si lo es, null si no.
 *
 * Usar desde Server Components (layout, page) que necesiten hacer
 * redirecciones server-side.
 */
export async function getAdminUserServer(): Promise<AdminUser | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('vylta_admins')
    .select('user_id, role, is_active, name, created_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[getAdminUserServer] Error:', error);
    return null;
  }
  return data as AdminUser | null;
}

/**
 * Client-side: misma lógica pero desde Client Component.
 * Útil para hooks de React Query que verifican estatus admin.
 */
export async function getAdminUserClient(): Promise<AdminUser | null> {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('vylta_admins')
    .select('user_id, role, is_active, name, created_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[getAdminUserClient] Error:', error);
    return null;
  }
  return data as AdminUser | null;
}

/**
 * Helper: ¿este registro de admin es super admin?
 * Los super admins ven secciones extra (admins, promo-codes) en el Control Center.
 */
export function isSuperAdmin(admin: AdminUser | null): boolean {
  return admin?.role === 'super_admin';
}
