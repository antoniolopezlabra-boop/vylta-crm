'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTimeBlocks, type TimeBlock } from '@/lib/time-blocks';

// ══════════════════════════════════════════════════════════════════════
// useTimeBlocks — hook con React Query para bloqueos de horario
//
// SIN realtime (jun 2026): los bloqueos cambian rarísimo, no vale la pena
// mantener una suscripción realtime abierta solo para ellos. En su lugar la
// query se considera "vieja" de inmediato y se refresca:
//   • al montar el componente (entrar a la sección / cambiar de pantalla)
//   • al volver el foco a la pestaña (refetchOnWindowFocus)
// Suficiente para reflejar cambios hechos desde la app móvil sin sobrecargar
// realtime donde no se necesita. Las mutaciones del propio CRM siguen siendo
// inmediatas vía useInvalidateTimeBlocks().
// ══════════════════════════════════════════════════════════════════════

export const TIME_BLOCKS_KEY = 'time-blocks';

export function useTimeBlocks() {
  return useQuery<TimeBlock[]>({
    queryKey: [TIME_BLOCKS_KEY],
    queryFn: fetchTimeBlocks,
    staleTime: 0,                 // siempre "viejo" → refetch al montar y al enfocar
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useInvalidateTimeBlocks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TIME_BLOCKS_KEY] });
}
