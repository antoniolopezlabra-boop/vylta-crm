'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useAdminDashboard — Hook con caché para el Dashboard admin
//
// Reemplaza el patrón useState/useEffect/loadData() que recargaba todo
// en cada navegación. Con TanStack Query:
//   • Primera carga: ejecuta queries normalmente
//   • Segunda visita (<30s): retorna instantáneo desde caché
//   • Tercera visita (>30s pero <5min): muestra caché + refresh silencioso
//   • Después de 5min: GC limpia el caché y vuelve a fetchear
// ══════════════════════════════════════════════════════════════════════

export interface DashboardData {
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
}

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const todayLocal = new Date();
  const monthStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
  const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

  const fourteenAgo = new Date();
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const fourteenAgoStr = `${fourteenAgo.getFullYear()}-${String(fourteenAgo.getMonth() + 1).padStart(2, '0')}-${String(fourteenAgo.getDate()).padStart(2, '0')}`;

  const fiftySixAgo = new Date(Date.now() - 56 * 86400000);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000);

  const [
    { count: totalTenants },
    { count: totalAppointments },
    { count: monthAppointments },
    { data: sessions },
    { data: dailyApts },
    { data: weeklyRegs },
    { data: plans, error: plansError },
  ] = await Promise.all([
    supabase.from('business_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', monthStartStr),
    supabase.from('user_sessions').select('user_id').gte('last_seen_at', thirtyAgo.toISOString()),
    supabase.from('appointments').select('date').gte('date', fourteenAgoStr).order('date'),
    supabase.from('business_profiles').select('created_at').gte('created_at', fiftySixAgo.toISOString()).order('created_at'),
    supabase.rpc('get_all_subscription_plans'),
  ]);

  if (plansError) console.error('[Admin Dashboard] Plans RPC error:', plansError);

  const basicCount = plans?.filter((p: any) =>
    ['basico', 'básico'].includes((p.plan_type || '').toLowerCase().trim())
  ).length || 0;
  const premiumCount = plans?.filter((p: any) =>
    (p.plan_type || '').toLowerCase().trim() === 'premium'
  ).length || 0;
  const gratuitoCount = plans?.filter((p: any) =>
    (p.plan_type || '').toLowerCase().trim() === 'gratuito'
  ).length || 0;

  const mrr = basicCount * 399 + premiumCount * 799;
  const activeTenants = sessions?.length || 0;
  const retentionRate = totalTenants ? Math.round((activeTenants / (totalTenants || 1)) * 100) : 0;

  // Citas últimos 14 días
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

  // Nuevos negocios últimas 8 semanas
  const weeks: Record<string, number> = {};
  for (let i = 7; i >= 0; i--) weeks[`S${8 - i}`] = 0;
  weeklyRegs?.forEach((p: any) => {
    const weeksAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (7 * 86400000));
    const key = `S${8 - weeksAgo}`;
    if (weeks[key] !== undefined) weeks[key]++;
  });

  return {
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
  };
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardData,
    // Hereda staleTime/gcTime del QueryProvider (30s / 5min)
  });
}
