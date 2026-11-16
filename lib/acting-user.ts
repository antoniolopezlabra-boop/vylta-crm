import type { SupabaseClient, User } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════
// Usuario "actuante" (nov 2026) — ASISTENTES en el CRM web
//
// El CRM filtra todo por user_id = user.id (el dueño del negocio). Una
// asistente inicia sesión con SU propia cuenta, pero trabaja con los datos
// del negocio de su jefe. getActingUser() devuelve el usuario autenticado
// con `id` = id del DUEÑO cuando quien entra es una asistente activa, y el
// usuario tal cual en cualquier otro caso.
//
// Solo se usa en las secciones permitidas a la asistente (Citas, Clientes).
// La seguridad real la ponen las políticas RLS (assistant_org_id()).
// ══════════════════════════════════════════════════════════════════════

// Caché SOLO en el navegador (en servidor podría mezclar usuarios).
let cache: { authId: string; orgId: string | null } | null = null;

export async function getAssistantOrgId(supabase: SupabaseClient, authId: string): Promise<string | null> {
  if (typeof window !== 'undefined' && cache?.authId === authId) return cache.orgId;
  const { data } = await supabase.rpc('assistant_org_id');
  const orgId = (data as string | null) ?? null;
  if (typeof window !== 'undefined') cache = { authId, orgId };
  return orgId;
}

export async function getActingUser(supabase: SupabaseClient): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const orgId = await getAssistantOrgId(supabase, user.id);
  return orgId ? ({ ...user, id: orgId } as User) : user;
}
