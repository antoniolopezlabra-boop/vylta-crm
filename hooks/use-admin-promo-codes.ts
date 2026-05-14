'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useAdminPromoCodes — Hook con caché para códigos promocionales
//
// Beneficios vs. patron useState/useEffect:
//   • Caché entre navegaciones (volver a la página = instantáneo)
//   • Stale-while-revalidate (datos viejos mostrados + refresh silente)
//   • Mutations con invalidación automática (toggle, create → refetch lista)
//   • isFetching != isLoading (spinner solo en primera carga)
// ══════════════════════════════════════════════════════════════════════

export interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  duration_days: number | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  notes: string | null;
  stripe_promo_code_id: string | null;
  created_at: string;
}

async function fetchPromoCodes(): Promise<PromoCode[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[fetchPromoCodes]', error);
    throw error;
  }
  return (data || []) as PromoCode[];
}

export function useAdminPromoCodes() {
  return useQuery({
    queryKey: ['admin-promo-codes'],
    queryFn: fetchPromoCodes,
  });
}

/**
 * Mutation: toggle is_active de un código.
 * Al completar exitosamente, invalida la lista para que se refetcheee.
 */
export function useTogglePromoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentlyActive }: { id: string; currentlyActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !currentlyActive })
        .eq('id', id);
      if (error) throw error;
      return { id, newState: !currentlyActive };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
  });
}

/**
 * Mutation: crear código nuevo vía Edge Function (que sincroniza con Stripe).
 * Al completar exitosamente, invalida la lista.
 */
export function useCreatePromoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      code: string;
      discountType: 'full' | 'percent';
      discountValue: number;
      durationMonths: number | null;
      maxUses: number;
      notes: string;
      createdBy: string | undefined;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('create-promo-code', {
        body: params,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
  });
}
