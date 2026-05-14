import { createClient as createBrowserClient } from '@/lib/supabase/client';

// ═════════════════════════════════════════════════════════════════════
// Sistema de Administradores VYLTA — utilidades client-safe
//
// IMPORTANTE: Este archivo NO importa cookies() ni nada de next/headers.
// Puede ser usado tanto en Server Components como en Client Components.
//
// Para uso server-only (verificaciones en layouts), usar lib/admin-server.ts
// que tiene la función getAdminUserServer() con acceso a cookies.
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
 * Client-side: verifica si el usuario autenticado actual es admin.
 * Lee la sesión desde el cliente Supabase del browser.
 *
 * Usar desde Client Components (ej: en componentes 'use client' que
 * necesiten saber el currentUserId del admin actual).
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
