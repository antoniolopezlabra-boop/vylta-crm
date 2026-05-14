import 'server-only';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { AdminUser } from '@/lib/admin';

// ═════════════════════════════════════════════════════════════════════
// Sistema de Administradores VYLTA — utilidades SERVER ONLY
//
// Este archivo NUNCA se debe importar desde Client Components.
// La directiva 'server-only' hace que Next.js falle el build inmediatamente
// si alguien intenta importarlo desde un 'use client'.
//
// Razon: cookies() de next/headers solo funciona en server-side.
// Si esto se bundle al cliente, explotan los imports en webpack.
// ═════════════════════════════════════════════════════════════════════

/**
 * Server-side: verifica si el usuario autenticado actual es admin.
 * Devuelve el registro de admin si lo es, null si no.
 *
 * Usar SOLO desde Server Components (layout, page sin 'use client',
 * Route Handlers) que necesiten hacer redirecciones server-side.
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
