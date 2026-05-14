'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAllTenants, fetchTenantDetail } from '@/lib/admin-tenants';

// ══════════════════════════════════════════════════════════════════════
// useAdminTenants — Lista de tenants con caché
// useAdminTenantDetail — Detalle de un tenant específico con caché
//
// Estos hooks aprovechan TanStack Query para:
//   • Cache compartido entre componentes (navegar atrás = instantáneo)
//   • Stale-while-revalidate (muestra data vieja mientras refresca)
//   • Prefetch automático al hacer hover en links con Link prefetch
//   • Deduplicación: si 2 componentes piden lo mismo, 1 sola query
// ══════════════════════════════════════════════════════════════════════

export function useAdminTenants() {
  return useQuery({
    queryKey: ['admin-tenants'],
    queryFn: fetchAllTenants,
  });
}

export function useAdminTenantDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin-tenant', userId],
    queryFn: () => fetchTenantDetail(userId!),
    enabled: !!userId, // No fetch hasta que tengamos el ID
  });
}
