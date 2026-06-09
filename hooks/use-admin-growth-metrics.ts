'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════
// useAdminGrowthMetrics — Hook para los dashboards Fase 1
//
// Cubre 3 RPCs que dan insights accionables:
//   1. get_activation_funnel()          → Funnel de activacion
//   2. get_top_bottom_performers()      → Top 10 + Bottom 10 (+ bloqueado)
//   3. get_business_type_distribution() → Distribucion por business_type
//
// Todas las RPCs verifican internamente que el caller esta en
// vylta_admins.is_active = true.
// ══════════════════════════════════════════════════════════════

export interface FunnelStep {
  step: string;
  count: number;
  step_order: number;
}

export interface Performer {
  user_id: string;
  business_name: string | null;
  state: string | null;
  appointments_30d: number;
  appointments_total: number;
  plan_type: string | null;
  last_session: string | null;
  days_since_last_session: number | null;
  performer_type: 'top' | 'bottom';
  bloqueado: boolean;
}

export interface BusinessTypeDistribution {
  business_type: string;
  total_count: number;
  paid_count: number;
  free_count: number;
}

export interface GrowthMetricsData {
  funnel: FunnelStep[];
  performers: Performer[];
  businessTypes: BusinessTypeDistribution[];
}

async function fetchGrowthMetrics(): Promise<GrowthMetricsData> {
  const supabase = createClient();

  const [
    { data: funnel, error: funnelError },
    { data: performers, error: performersError },
    { data: businessTypes, error: btError },
  ] = await Promise.all([
    supabase.rpc('get_activation_funnel'),
    supabase.rpc('get_top_bottom_performers'),
    supabase.rpc('get_business_type_distribution'),
  ]);

  if (funnelError) console.error('[Growth Metrics] Funnel error:', funnelError);
  if (performersError) console.error('[Growth Metrics] Performers error:', performersError);
  if (btError) console.error('[Growth Metrics] Business types error:', btError);

  return {
    funnel: (funnel as FunnelStep[]) || [],
    performers: (performers as Performer[]) || [],
    businessTypes: (businessTypes as BusinessTypeDistribution[]) || [],
  };
}

export function useAdminGrowthMetrics() {
  return useQuery({
    queryKey: ['admin-growth-metrics'],
    queryFn: fetchGrowthMetrics,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
