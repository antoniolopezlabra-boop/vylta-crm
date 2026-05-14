import { createClient } from '@/lib/supabase/client';

// ═════════════════════════════════════════════════════════════════════
// Helpers de tenants (negocios) para el panel admin
//
// Un "tenant" es un usuario que se registró en VYLTA y tiene un
// business_profile. Cada tenant tiene:
//   - Un perfil (business_profiles)
//   - Un plan activo (subscription_plans)
//   - Estadísticas (citas, clientes, ingresos)
//   - Estado de actividad (última sesión en user_sessions)
//
// Los planes en el sistema interno se llaman distinto al visible:
//   - 'Gratuito' → Plan Básico visible (gratis, 10 citas/mes)
//   - 'Basico'   → Plan Premium visible ($399/mes)
//   - 'Premium'  → Plan Luxury visible ($799/mes)
//
// ⚠️ COLUMNAS REALES DE business_profiles (confirmado May 14 2026):
// La tabla NO tiene 'owner_name'. Las columnas que sí existen:
//   - id, user_id, business_name, business_type
//   - phone, email
//   - business_slug, business_logo_url, business_address
//   - created_at, updated_at
// ═════════════════════════════════════════════════════════════════════

export interface TenantListItem {
  user_id: string;
  business_name: string;
  business_type: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  plan_type: 'Gratuito' | 'Basico' | 'Premium' | string;
  plan_label: 'Basico' | 'Premium' | 'Luxury';
  plan_price: number;
  is_active_30d: boolean;
  last_seen_at: string | null;
  appointments_count: number;
  clients_count: number;
}

export interface TenantDetail extends TenantListItem {
  business_slug: string | null;
  business_logo_url: string | null;
  business_address: string | null;
  total_revenue: number;
  appointments_this_month: number;
  appointments_paid: number;
  recent_appointments: Array<{
    id: string;
    date: string;
    start_time: string;
    service_name: string;
    status: string;
    service_cost: number | null;
    client_name: string;
  }>;
}

/**
 * Mapea el plan interno al visible. La lógica de precios está
 * documentada en la memoria del proyecto (no cambiar sin actualizar
 * Stripe y dashboards).
 */
export function planInternalToVisible(planType: string | null | undefined): {
  label: 'Basico' | 'Premium' | 'Luxury';
  price: number;
} {
  const normalized = (planType || '').toLowerCase().trim();
  if (normalized === 'premium') return { label: 'Luxury', price: 799 };
  if (normalized === 'basico' || normalized === 'básico') return { label: 'Premium', price: 399 };
  return { label: 'Basico', price: 0 };
}

/**
 * Lista todos los tenants con metadata para el panel admin.
 *
 * Estrategia (replicada de app móvil que ya funciona):
 *   1. SELECT * de business_profiles (no columnas específicas — más robusto)
 *   2. RPC get_all_subscription_plans (SECURITY DEFINER, bypasea RLS)
 *   3. Para cada tenant, count() de clientes y citas en paralelo
 *   4. Lookup de user_sessions para detectar actividad reciente
 */
export async function fetchAllTenants(): Promise<TenantListItem[]> {
  const supabase = createClient();

  const [
    { data: profiles, error: profilesError },
    { data: sessions },
    { data: plans, error: plansError },
  ] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_sessions')
      .select('user_id, last_seen_at')
      .gte('last_seen_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.rpc('get_all_subscription_plans'),
  ]);

  if (profilesError) {
    console.error('[fetchAllTenants] business_profiles error:', profilesError);
  }
  if (plansError) {
    console.error('[fetchAllTenants] plans RPC error:', plansError);
  }

  if (!profiles || profiles.length === 0) return [];

  // Mapas para lookup rápido O(1)
  const sessionMap = new Map<string, string>();
  sessions?.forEach((s: any) => sessionMap.set(s.user_id, s.last_seen_at));

  const planMap = new Map<string, string>();
  plans?.forEach((p: any) => planMap.set(p.user_id, p.plan_type));

  // Hacer count de clientes y citas para cada tenant en paralelo.
  // Esto es el patrón de la app móvil. No es escalable a miles de tenants
  // pero por ahora (con <100 tenants) está bien.
  const tenantsData = await Promise.all(
    profiles.map(async (p: any) => {
      const [{ count: clientsCount }, { count: appointmentsCount }] = await Promise.all([
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.user_id),
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.user_id),
      ]);

      const planType = planMap.get(p.user_id) || 'Gratuito';
      const { label, price } = planInternalToVisible(planType);
      const lastSeen = sessionMap.get(p.user_id) || null;

      return {
        user_id: p.user_id,
        business_name: p.business_name || 'Sin nombre',
        business_type: p.business_type || null,
        email: p.email || null,
        phone: p.phone || null,
        created_at: p.created_at,
        plan_type: planType,
        plan_label: label,
        plan_price: price,
        is_active_30d: !!lastSeen,
        last_seen_at: lastSeen,
        appointments_count: appointmentsCount || 0,
        clients_count: clientsCount || 0,
      };
    }),
  );

  return tenantsData;
}

/**
 * Obtiene el detalle completo de un tenant para la vista individual.
 */
export async function fetchTenantDetail(userId: string): Promise<TenantDetail | null> {
  const supabase = createClient();

  const [
    { data: profile },
    { data: session },
    { data: plans },
    { count: apptCount },
    { count: clientCount },
    { count: apptThisMonth },
    { data: paidAppts },
    { data: recentAppts },
  ] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_sessions')
      .select('last_seen_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.rpc('get_all_subscription_plans'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`),
    supabase
      .from('appointments')
      .select('service_cost, status')
      .eq('user_id', userId)
      .in('status', ['Pagado', 'Completada']),
    supabase
      .from('appointments')
      .select('id, date, start_time, service_name, status, service_cost, client:clients(name), client_name_temp')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(10),
  ]);

  if (!profile) return null;

  const planType = plans?.find((p: any) => p.user_id === userId)?.plan_type || 'Gratuito';
  const { label, price } = planInternalToVisible(planType);
  const lastSeen = (session as any)?.last_seen_at || null;
  const isActive30d = !!lastSeen && new Date(lastSeen) > new Date(Date.now() - 30 * 86400000);

  const totalRevenue = (paidAppts || []).reduce((sum: number, a: any) => sum + (a.service_cost || 0), 0);
  const paidCount = (paidAppts || []).length;

  return {
    user_id: (profile as any).user_id,
    business_name: (profile as any).business_name || 'Sin nombre',
    business_type: (profile as any).business_type || null,
    email: (profile as any).email || null,
    phone: (profile as any).phone || null,
    created_at: (profile as any).created_at,
    business_slug: (profile as any).business_slug || null,
    business_logo_url: (profile as any).business_logo_url || null,
    business_address: (profile as any).business_address || null,
    plan_type: planType,
    plan_label: label,
    plan_price: price,
    is_active_30d: isActive30d,
    last_seen_at: lastSeen,
    appointments_count: apptCount || 0,
    clients_count: clientCount || 0,
    appointments_this_month: apptThisMonth || 0,
    appointments_paid: paidCount,
    total_revenue: totalRevenue,
    recent_appointments: (recentAppts || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      start_time: a.start_time,
      service_name: a.service_name || 'Sin servicio',
      status: a.status,
      service_cost: a.service_cost,
      client_name: a.client?.name || a.client_name_temp || 'Cliente',
    })),
  };
}

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Nunca';
  const date = new Date(lastSeenAt);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffH < 24) return `Hace ${diffH}h`;
  if (diffD < 7) return `Hace ${diffD}d`;
  if (diffD < 30) return `Hace ${Math.floor(diffD / 7)} sem`;
  return `Hace ${Math.floor(diffD / 30)} meses`;
}
