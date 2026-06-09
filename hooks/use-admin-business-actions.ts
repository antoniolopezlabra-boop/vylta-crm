'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════
// useAdminBusinessAction — Bloquear / desbloquear / eliminar un negocio.
//
// Invoca la Edge Function admin-business-action (service role + validacion
// de admin). Al terminar refresca los dashboards del Control Center.
// ══════════════════════════════════════════════════════════════

export type BusinessAction = 'block' | 'unblock' | 'delete';

export interface BusinessActionResult {
  success: boolean;
  action?: BusinessAction;
  nombre?: string;
  warning?: string;
  warnings?: string[];
  error?: string;
}

export function useAdminBusinessAction() {
  const queryClient = useQueryClient();

  return useMutation<BusinessActionResult, Error, { action: BusinessAction; userId: string }>({
    mutationFn: async ({ action, userId }) => {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('admin-business-action', {
        body: { action, userId },
      });
      if (error) throw new Error(error.message || 'No se pudo contactar al servidor.');
      const result = data as BusinessActionResult;
      if (!result || result.success === false) {
        throw new Error(result?.error || 'La acción no se completó.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-growth-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });
}
