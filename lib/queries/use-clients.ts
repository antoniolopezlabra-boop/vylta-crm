'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchClients, type Client } from '@/lib/clients';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';
import { createClient as createSupabase } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useClients — hook con React Query para la lista de clientes
//
// Estrategia:
//   • 1 sola query trae TODOS los clientes (search/filter/sort se hace en cliente)
//     Esto es óptimo porque el catálogo de clientes de un negocio pequeño-mediano
//     rara vez excede los 5000 registros. Filtros client-side son instantáneos.
//   • staleTime 60s: clientes cambian poco minuto a minuto
//   • Realtime: cuando se crea/edita/borra un cliente en móvil, invalida cache
//   • Prefetch helper para precargar al hacer hover en sidebar
// ══════════════════════════════════════════════════════════════════════

export const CLIENTS_KEY = 'clients';

export function useClients() {
  const queryClient = useQueryClient();

  const query = useQuery<Client[]>({
    queryKey: [CLIENTS_KEY],
    queryFn: () => fetchClients({}),
    staleTime: 60 * 1000,
  });

  // Realtime: invalidar cache cuando cualquier cliente cambia
  useSupabaseRealtime('clients', () => {
    queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
  });

  return query;
}

/** Helper para precargar la lista de clientes (usado en sidebar hover). */
export function usePrefetchClients() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.prefetchQuery({
      queryKey: [CLIENTS_KEY],
      queryFn: () => fetchClients({}),
      staleTime: 60 * 1000,
    });
  };
}

/** Helper para invalidar manualmente tras una mutación. */
export function useInvalidateClients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
}

// ══════════════════════════════════════════════════════════════════════
// Mutaciones con optimistic updates
// ══════════════════════════════════════════════════════════════════════

/** Borrar cliente con optimistic update (desaparece de la lista al instante). */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const supabase = createSupabase();
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
    },
    onMutate: async (clientId) => {
      await queryClient.cancelQueries({ queryKey: [CLIENTS_KEY] });
      const previous = queryClient.getQueryData<Client[]>([CLIENTS_KEY]);
      // Optimistic: remover el cliente del cache inmediatamente
      queryClient.setQueryData<Client[]>([CLIENTS_KEY], (old = []) =>
        old.filter(c => c.id !== clientId),
      );
      return { previous };
    },
    onError: (_err, _clientId, context) => {
      // Si falla, restaurar el estado previo
      if (context?.previous) {
        queryClient.setQueryData([CLIENTS_KEY], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
    },
  });
}
