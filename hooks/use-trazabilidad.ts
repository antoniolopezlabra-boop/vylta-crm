'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// useTrazabilidad — embudo de adquisición de VYLTA en tiempo real.
//
// Consume la RPC funnel_trazabilidad(p_days) que agrega los eventos de
// public.funnel_events (experiencia + páginas de giro) y los cruza con
// registros (business_profiles) y pagos (subscription_plans).
//
// La RPC verifica internamente que el caller esté en vylta_admins.
// Realtime: cada INSERT en funnel_events invalida y refresca el panel.
// ══════════════════════════════════════════════════════════════════════

export interface ScenePoint { scene: number; sessions: number }
export interface GiroPoint { giro: string; sessions: number }
export interface SourcePoint { source: string; sessions: number }
export interface PaidSourcePoint { source: string; customers: number }
export interface PaidGiroPoint { giro: string; customers: number }

export interface TrazabilidadData {
  range_days: number;
  entered: number;
  started: number;
  finished: number;
  cta: number;
  giro_view: number;
  reg_click: number;
  live: number;
  scenes: ScenePoint[];
  by_giro: GiroPoint[];
  by_source: SourcePoint[];
  avg_seconds: number;
  registered: number;
  paid_new: number;
  paid_total: number;
  // Fase 2 — atribución sesión → cliente
  attr_registered: number;
  attr_paid: number;
  paid_by_source: PaidSourcePoint[];
  paid_by_giro: PaidGiroPoint[];
}

async function fetchTrazabilidad(days: number): Promise<TrazabilidadData> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('funnel_trazabilidad', { p_days: days });
  if (error) {
    console.error('[Trazabilidad] RPC error:', error);
    throw error;
  }
  return data as TrazabilidadData;
}

export function useTrazabilidad(days: number) {
  const queryClient = useQueryClient();

  const query = useQuery<TrazabilidadData>({
    queryKey: ['trazabilidad', days],
    queryFn: () => fetchTrazabilidad(days),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Tiempo real: nuevo evento en el embudo → refrescar todos los rangos.
  useSupabaseRealtime(['funnel_events'], () => {
    queryClient.invalidateQueries({ queryKey: ['trazabilidad'] });
  });

  return query;
}
