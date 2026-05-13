'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTimeBlocks, type TimeBlock } from '@/lib/time-blocks';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// useTimeBlocks — hook con React Query para bloqueos de horario
//
// staleTime alto (10 min): los bloqueos cambian rarísimo. El usuario los
// configura una sola vez y los deja vivir. Realtime es backup por si los
// edita desde móvil.
// ══════════════════════════════════════════════════════════════════════

export const TIME_BLOCKS_KEY = 'time-blocks';

export function useTimeBlocks() {
  const queryClient = useQueryClient();

  const query = useQuery<TimeBlock[]>({
    queryKey: [TIME_BLOCKS_KEY],
    queryFn: fetchTimeBlocks,
    staleTime: 10 * 60 * 1000, // 10min frescos (cambian poco)
  });

  useSupabaseRealtime('time_blocks', () => {
    queryClient.invalidateQueries({ queryKey: [TIME_BLOCKS_KEY] });
  });

  return query;
}

export function useInvalidateTimeBlocks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TIME_BLOCKS_KEY] });
}
