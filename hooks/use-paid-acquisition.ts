'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// usePaidAcquisition — adquisición pagada (Facebook/Instagram + Google) en
// tiempo real. Consume la RPC admin_paid_acquisition(p_days) que agrega los
// eventos de landing /empieza (ld_open/ld_cta_web) por canal (utm_source) y
// campaña (utm_campaign), y los cruza con registros (signup_attribution) y
// pagos (subscription_plans). La RPC valida vylta_admins internamente.
// ══════════════════════════════════════════════════════════════════════

export interface PaidSourceRow { source: string; visitas: number; cta: number; registros: number; pago: number }
export interface PaidCampaignRow { campaign: string; source: string; visitas: number; cta: number }
export interface PaidDailyRow { dia: string; fb: number; google: number; directo: number }

export interface PaidAcquisitionData {
  range_days: number;
  by_source: PaidSourceRow[];
  by_campaign: PaidCampaignRow[];
  daily: PaidDailyRow[];
  totals: { visitas: number; cta: number; registros: number; pago: number };
}

async function fetchPaid(days: number): Promise<PaidAcquisitionData> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_paid_acquisition', { p_days: days });
  if (error) {
    console.error('[PaidAcq] RPC error:', error);
    throw error;
  }
  return data as PaidAcquisitionData;
}

export function usePaidAcquisition(days: number) {
  const queryClient = useQueryClient();

  const query = useQuery<PaidAcquisitionData>({
    queryKey: ['paid-acquisition', days],
    queryFn: () => fetchPaid(days),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Tiempo real: nuevo evento de landing → refrescar.
  useSupabaseRealtime(['funnel_events'], () => {
    queryClient.invalidateQueries({ queryKey: ['paid-acquisition'] });
  });

  return query;
}
