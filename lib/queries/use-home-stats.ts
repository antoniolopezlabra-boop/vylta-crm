'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getHomeStatsClient } from '@/lib/home-stats-client';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';
import type { HomeStats } from '@/lib/home-stats';

// ══════════════════════════════════════════════════════════════════════
// useHomeStats — hook con React Query para stats del Dashboard
//
// Magia:
//   • 1ra carga: ~600ms (igual que antes)
//   • 2da+ carga (navegando de regreso): instantáneo (< 30ms) desde cache
//   • staleTime 60s: si vuelves en menos de 60s, no re-fetch
//   • Realtime: si alguien crea cita en móvil, invalidamos cache y
//     React Query recarga automáticamente
//   • Background refetch: muestra datos viejos mientras carga nuevos
//
// Esto es lo que hace que Linear/Notion se sientan instantáneos.
// ══════════════════════════════════════════════════════════════════════

export const HOME_STATS_KEY = ['home-stats'] as const;

export function useHomeStats() {
  const queryClient = useQueryClient();

  const query = useQuery<HomeStats>({
    queryKey: HOME_STATS_KEY,
    queryFn: getHomeStatsClient,
    staleTime: 60 * 1000, // 60s frescos (dashboard cambia poco)
  });

  // ── Realtime: cuando cambia algo en BD, invalidar cache ──
  // Esto hace que React Query refresque automáticamente cuando alguien
  // crea/edita una cita o cliente desde la app móvil u otra pestaña.
  useSupabaseRealtime(['appointments', 'clients'], () => {
    queryClient.invalidateQueries({ queryKey: HOME_STATS_KEY });
  });

  return query;
}

/** Helper para invalidar manualmente desde una mutación (ej: marcar cita como pagada) */
export function useInvalidateHomeStats() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: HOME_STATS_KEY });
}
