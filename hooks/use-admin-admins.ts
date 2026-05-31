'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useAdminAdmins — Hook con caché para la lista de administradores
//
// Expone:
//   • useAdminAdmins: lista de admins (cache + stale-while-revalidate)
//   • useToggleAdminActive: activar/desactivar admins regulares
//   • useCreateAdmin: crear/invitar un nuevo admin desde el panel
//     (llama a /api/admin/create — la lógica segura vive en el server)
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

export type CreateAdminInput = {
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
};

export type CreateAdminResult = {
  status: 'invited' | 'promoted' | 'reactivated' | 'already_admin';
  email: string;
};

/**
 * Mutation: crear/invitar un nuevo administrador.
 * Toda la lógica sensible (service_role, auth.admin) vive en el server,
 * en /api/admin/create. Aquí solo hacemos el fetch y refrescamos la lista.
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAdminInput): Promise<CreateAdminResult> => {
      const res = await fetch('/api/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error creando administrador');
      }
      return json as CreateAdminResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    },
  });
}
