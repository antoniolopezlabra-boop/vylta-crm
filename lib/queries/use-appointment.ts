'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAppointmentById, type Appointment } from '@/lib/appointments';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// useAppointment(id) — hook React Query para el detalle de UNA cita.
//
// Realtime: si otro dispositivo (móvil) cambia esta cita, invalidamos
// cache. Esto evita pisar cambios concurrentes en el detail page.
//
// staleTime corto (15s): el detail es la pantalla donde más importa
// que los datos estén al día (cobros, status, asignaciones).
// ══════════════════════════════════════════════════════════════════════

export const APPOINTMENT_KEY = 'appointment';

export function useAppointment(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<Appointment | null>({
    queryKey: [APPOINTMENT_KEY, id],
    queryFn: () => (id ? fetchAppointmentById(id) : Promise.resolve(null)),
    staleTime: 15 * 1000,
    enabled: !!id,
  });

  // Cuando cambia cualquier cita en BD, invalidamos esta query específica
  // (la lista de citas también se invalida via use-appointments separadamente)
  useSupabaseRealtime('appointments', () => {
    if (id) queryClient.invalidateQueries({ queryKey: [APPOINTMENT_KEY, id] });
  });

  return query;
}

export function useInvalidateAppointment(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    if (id) queryClient.invalidateQueries({ queryKey: [APPOINTMENT_KEY, id] });
  };
}
