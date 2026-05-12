'use client';

import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// RealtimeListener — Componente invisible que activa Realtime en una
// página Server Component.
//
// Cuando hay cambios en las tablas indicadas (citas o clientes), llama
// router.refresh() para que el Server Component padre re-ejecute sus
// queries y se actualicen los datos SIN recargar la página.
//
// USO:
//   En el Server Component:
//     import { RealtimeListener } from '@/components/realtime-listener';
//     <RealtimeListener tables={['appointments', 'clients']} />
// ══════════════════════════════════════════════════════════════════════

export function RealtimeListener({ tables }: { tables: string | string[] }) {
  useSupabaseRealtime(tables);
  return null;
}
