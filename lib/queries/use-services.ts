'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// useServices — hook con React Query para la lista de servicios
//
// Estrategia:
//   • Lista de servicios cambia poco (catálogo estable), staleTime 5min
//   • Mutación toggleActive con optimistic update
//   • Realtime no es crítico aquí (servicios cambian raramente)
// ══════════════════════════════════════════════════════════════════════

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category?: string | null;
  color?: string | null;
}

export const SERVICES_KEY = 'services';

async function fetchServices(): Promise<Service[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('user_id', user.id)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.error('[fetchServices] error:', error);
    return [];
  }
  return (data || []) as Service[];
}

export function useServices() {
  const queryClient = useQueryClient();

  const query = useQuery<Service[]>({
    queryKey: [SERVICES_KEY],
    queryFn: fetchServices,
    staleTime: 5 * 60 * 1000, // 5min frescos (servicios cambian poco)
  });

  // Realtime opcional (servicios cambian raramente pero por consistencia)
  useSupabaseRealtime('services', () => {
    queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] });
  });

  return query;
}

export function usePrefetchServices() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.prefetchQuery({
      queryKey: [SERVICES_KEY],
      queryFn: fetchServices,
      staleTime: 5 * 60 * 1000,
    });
  };
}

export function useInvalidateServices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] });
}

/** Toggle activo/inactivo con optimistic update (cambia el estado al instante). */
export function useToggleService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (service: Service) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('services')
        .update({ is_active: !service.is_active, updated_at: new Date().toISOString() })
        .eq('id', service.id);
      if (error) throw error;
    },
    onMutate: async (service) => {
      await queryClient.cancelQueries({ queryKey: [SERVICES_KEY] });
      const previous = queryClient.getQueryData<Service[]>([SERVICES_KEY]);
      // Optimistic: toggle inmediato
      queryClient.setQueryData<Service[]>([SERVICES_KEY], (old = []) =>
        old.map(s => s.id === service.id ? { ...s, is_active: !s.is_active } : s),
      );
      return { previous };
    },
    onError: (_err, _service, context) => {
      if (context?.previous) {
        queryClient.setQueryData([SERVICES_KEY], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_KEY] });
    },
  });
}
