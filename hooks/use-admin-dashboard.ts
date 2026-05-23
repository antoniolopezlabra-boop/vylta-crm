'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ═══════════════════════════════════════════════════════════════════════
// useAdminDashboard — Hook con caché para el Dashboard admin
//
// ⚡ ACTUALIZACIÓN (May 22 2026):
// Agregados nuevos campos para el Control Center estilo CyberSecure:
//   • totalClients   → clientes totales en BD (suma de clients de todos los negocios)
//   • activeSubscribers → suscriptores ACTIVOS (planes pagados con status='active')
//   • last14DaysAppointments → citas en los últimos 14 días
//   • newBusinessesThisWeek → negocios nuevos en los últimos 7 días
//   • stateData → data agregada para el mapa de calor de México
//
// OPTIMIZADO con TanStack Query:
//   • Cache de 30s: volver al dashboard <30s = instantáneo
//   • Stale-while-revalidate: hasta 5min muestra cache + refresca silente
// ═══════════════════════════════════════════════════════════════════════

export interface StateDataPoint {
  state: string;
  total_businesses: number;
  new_last_30d: number;
  new_last_7d: number;
}

export interface DashboardData {
  // Datos existentes
  totalTenants: number;
  activeTenants: number;
  retentionRate: number;
  totalAppointments: number;
  monthAppointments: number;
  basicCount: number;
  premiumCount: number;
  gratuitoCount: number;
  mrr: number;
  dailyCitas: { label: string; value: number }[];
  weeklyNegocios: { label: string; value: number }[];

  // Nuevos (May 22 2026) — para el Control Center CyberSecure
  totalClients: number;
  activeSubscribers: number;
  last14DaysAppointments: number;
  newBusinessesThisWeek: number;
  stateData: StateDataPoint[];
}

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const todayLocal = new Date();
  const monthStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
  const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

  const fourteenAgo = new Date();
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const fourteenAgoStr = `${fourteenAgo.getFullYear()}-${String(fourteenAgo.getMonth() + 1).padStart(2, '0')}-${String(fourteenAgo.getDate()).padStart(2, '0')}`;

  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);

  const fiftySixAgo = new Date(Date.now() - 56 * 86400000);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000);

  const [
    { count: totalTenants },
    { count: totalAppointments },
    { count: monthAppointments },
    { count: totalClients },
    { count: last14DaysAppointments },
    { count: newBusinessesThisWeek },
    { data: sessions },
    { data: dailyApts },
    { data: weeklyRegs },
    { data: plans, error: plansError },
    { data: stateAgg, error: stateError },
  ] = await Promise.all([
    supabase.from('business_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', monthStartStr),
    // Nuevos counters
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', fourteenAgoStr),
    supabase.from('business_profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenAgo.toISOString()),
    // Sesiones y series
    supabase.from('user_sessions').select('user_id').gte('last_seen_at', thirtyAgo.toISOString()),
    supabase.from('appointments').select('date').gte('date', fourteenAgoStr).order('date'),
    supabase.from('business_profiles').select('created_at').gte('created_at', fiftySixAgo.toISOString()).order('created_at'),
    supabase.rpc('get_all_subscription_plans'),
    // ⚡ NEW: data del mapa de calor agregada por estado
    supabase.from('business_profiles_by_state').select('*'),
  ]);

  if (plansError) console.error('[Admin Dashboard] Plans RPC error:', plansError);
  if (stateError) console.error('[Admin Dashboard] State agg error:', stateError);

  const basicCount = plans?.filter((p: any) =>
    ['basico', 'básico'].includes((p.plan_type || '').toLowerCase().trim())
  ).length || 0;
  const premiumCount = plans?.filter((p: any) =>
    (p.plan_type || '').toLowerCase().trim() === 'premium'
  ).length || 0;
  const gratuitoCount = plans?.filter((p: any) =>
    (p.plan_type || '').toLowerCase().trim() === 'gratuito'
  ).length || 0;

  // Suscriptores activos = todos los planes pagados con status='active'
  // (no incluye Plan Básico que es $0).
  const activeSubscribers = (plans?.filter((p: any) => {
    const planType = (p.plan_type || '').toLowerCase().trim();
    const status = (p.status || '').toLowerCase().trim();
    return ['basico', 'premium', 'vipbasico', 'vippremium'].includes(planType)
        && ['active', 'pending_cancellation'].includes(status);
  }).length) || 0;

  const mrr = basicCount * 399 + premiumCount * 799;
  const activeTenants = sessions?.length || 0;
  const retentionRate = totalTenants ? Math.round((activeTenants / (totalTenants || 1)) * 100) : 0;

  // Citas últimos 14 días (serie diaria)
  const days: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days[`${d.getDate()}/${d.getMonth() + 1}`] = 0;
  }
  dailyApts?.forEach((a: any) => {
    const d = new Date(a.date + 'T12:00:00');
    const key = `${d.getDate()}/${d.getMonth() + 1}`;
    if (days[key] !== undefined) days[key]++;
  });

  // Nuevos negocios últimas 8 semanas (serie semanal)
  const weeks: Record<string, number> = {};
  for (let i = 7; i >= 0; i--) weeks[`S${8 - i}`] = 0;
  weeklyRegs?.forEach((p: any) => {
    const weeksAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (7 * 86400000));
    const key = `S${8 - weeksAgo}`;
    if (weeks[key] !== undefined) weeks[key]++;
  });

  return {
    // Existentes
    totalTenants: totalTenants || 0,
    activeTenants,
    retentionRate,
    totalAppointments: totalAppointments || 0,
    monthAppointments: monthAppointments || 0,
    basicCount,
    premiumCount,
    gratuitoCount,
    mrr,
    dailyCitas: Object.entries(days).map(([label, value]) => ({ label, value })),
    weeklyNegocios: Object.entries(weeks).map(([label, value]) => ({ label, value })),
    // Nuevos
    totalClients: totalClients || 0,
    activeSubscribers,
    last14DaysAppointments: last14DaysAppointments || 0,
    newBusinessesThisWeek: newBusinessesThisWeek || 0,
    stateData: (stateAgg as StateDataPoint[]) || [],
  };
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardData,
    // Hereda staleTime/gcTime del QueryProvider (30s / 5min)
  });
}
