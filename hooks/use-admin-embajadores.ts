'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════
// useAdminEmbajadores — KPIs por embajador para el Control Center.
//
// Consume la RPC admin_get_embajadores(), que verifica internamente que
// el caller esta en vylta_admins.is_active = true. Polling cada 60s,
// alineado con el resto del dashboard (sin Realtime).
// ══════════════════════════════════════════

export interface Embajador {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ref_code: string;
  estatus: string;
  perfil_completo: boolean;
  clientes_total: number;
  clientes_activos: number;
  nuevos_mes: number;
  comision_total: number;
  por_pagar: number;
  created_at: string;
}

async function fetchEmbajadores(): Promise<Embajador[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_get_embajadores');
  if (error) {
    console.error('[Embajadores] error:', error);
    throw error;
  }
  return (data as Embajador[]) || [];
}

export function useAdminEmbajadores() {
  return useQuery({
    queryKey: ['admin-embajadores'],
    queryFn: fetchEmbajadores,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
