'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface EmbajadorResumen {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ref_code: string;
  estatus: string;
  perfil_completo: boolean;
  bienvenida_aceptada: boolean;
  banco: string | null;
  clabe: string | null;
  titular_cuenta: string | null;
  rfc: string | null;
  direccion: string | null;
  clientes_total: number;
  clientes_activos: number;
  nuevos_mes: number;
  comision_total: number;
  por_pagar: number;
}

export interface ClienteReferido {
  business_name: string;
  plan_type: string;
  status: string;
  desde: string | null;
}

async function fetchResumen(): Promise<EmbajadorResumen | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('embajador_mi_resumen');
  if (error) {
    console.error('[Portal] resumen error:', error);
    throw error;
  }
  if (!data || (data as any).error) return null;
  return data as EmbajadorResumen;
}

async function fetchClientes(): Promise<ClienteReferido[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('embajador_mis_clientes');
  if (error) {
    console.error('[Portal] clientes error:', error);
    throw error;
  }
  return (data as ClienteReferido[]) || [];
}

export function useEmbajadorResumen() {
  return useQuery({ queryKey: ['embajador-resumen'], queryFn: fetchResumen, refetchInterval: 60_000 });
}

export function useEmbajadorClientes() {
  return useQuery({ queryKey: ['embajador-clientes'], queryFn: fetchClientes, refetchInterval: 60_000 });
}
