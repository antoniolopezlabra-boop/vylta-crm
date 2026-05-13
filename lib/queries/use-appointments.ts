'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAppointmentsInRange,
  fetchActiveStaff,
  type AppointmentWithMeta,
} from '@/lib/appointments';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// useAppointments — hook con React Query para citas de una semana
//
// Cada combinación weekStart-weekEnd se cachea por separado, así que si
// el usuario navega entre semanas y regresa, las semanas previas se
// muestran instantáneamente.
//
// Realtime: cuando cambia cualquier cita, invalidamos TODOS los caches
// de appointments (de cualquier semana), así siempre está fresco.
// ══════════════════════════════════════════════════════════════════════

export const APPOINTMENTS_KEY = 'appointments';
export const STAFF_KEY = 'staff';

/** Hook para citas de una semana específica. */
export function useAppointments(weekStart: string, weekEnd: string) {
  const queryClient = useQueryClient();

  const query = useQuery<AppointmentWithMeta[]>({
    queryKey: [APPOINTMENTS_KEY, weekStart, weekEnd],
    queryFn: () => fetchAppointmentsInRange(weekStart, weekEnd),
    staleTime: 30 * 1000, // 30s frescos
  });

  // Realtime: invalidar TODOS los caches de appointments cuando algo cambia
  useSupabaseRealtime('appointments', () => {
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
  });

  return query;
}

/** Hook para lista de staff activo (cambia muy poco, cache más largo). */
export function useActiveStaff() {
  return useQuery({
    queryKey: [STAFF_KEY],
    queryFn: fetchActiveStaff,
    staleTime: 5 * 60 * 1000, // 5min frescos
  });
}

/** Helper para invalidar todos los caches de citas tras una mutación. */
export function useInvalidateAppointments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
}
