'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useAdminAdmins — Hook con caché para la lista de administradores
//
// Además del useQuery clásico, expone:
//   • useToggleAdminActive: mutation para desactivar/activar admins
//     regulares (NUNCA para super admins; ese check está en la UI también)
// ══════════════════════════════════════════════════════════════════════

export interface AdminMember {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

async function fetchAdmins(): Promise<AdminMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vylta_admins')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[fetchAdmins]', error);
    throw error;
  }
  return (data || []) as AdminMember[];
}

export function useAdminAdmins() {
  return useQuery({
    queryKey: ['admin-admins'],
    queryFn: fetchAdmins,
  });
}

/**
 * Mutation: toggle is_active de un admin regular.
 * NO permite tocar super admins ni al usuario actual (defensa contra auto-bloqueo).
 * Ambos checks se hacen también en la UI antes de invocar el mutation.
 */
export function useToggleAdminActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentlyActive }: { id: string; currentlyActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('vylta_admins')
        .update({ is_active: !currentlyActive })
        .eq('id', id);
      if (error) throw error;
      return { id, newState: !currentlyActive };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    },
  });
}
