'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useSupabaseRealtime — Hook para suscripciones Realtime de Supabase.
//
// REGLA DE ORO de Supabase Realtime:
//   1. Llamar TODOS los .on() ANTES de .subscribe()
//   2. NUNCA reutilizar un channel ya suscrito — Supabase lo rechaza
//   3. Channel name debe ser único por instancia (no por usuario+tabla)
//
// LECCIÓN APRENDIDA (mayo 2026):
//   El error "cannot add postgres_changes callbacks after subscribe()"
//   ocurre por React Strict Mode en dev (Next.js 15) que monta el
//   componente dos veces. Si el channel name es el mismo entre montajes,
//   Supabase reusa el channel YA suscrito y rechaza los nuevos .on().
//
//   FIX: Channel name único por mount usando timestamp + random.
//   Esto garantiza que cada montaje crea un channel completamente nuevo.
//
// USO:
//   useSupabaseRealtime('appointments');
//   useSupabaseRealtime(['appointments', 'clients']);
//   useSupabaseRealtime('appointments', () => refetch());
// ══════════════════════════════════════════════════════════════════════

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export function useSupabaseRealtime(
  tables: string | string[],
  onChange?: () => void,
  options: { event?: RealtimeEvent } = {},
) {
  const router = useRouter();
  // Callback en ref para que cambios no recreen el channel cada render
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const event = options.event || '*';
  const tablesList = Array.isArray(tables) ? tables : [tables];
  const tablesKey = tablesList.sort().join(',');

  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    const supabase = createClient();

    async function setupChannel() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // ── CHANNEL NAME ÚNICO POR MOUNT ──
      // Usar timestamp + random evita colisiones con channels viejos
      // que aún no han sido limpiados por Supabase (especialmente bajo
      // React Strict Mode que monta+desmonta+monta en dev).
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const channelName = `realtime:${user.id}:${tablesKey}:${uniqueId}`;

      let channel = supabase.channel(channelName);

      // ── REGISTRAR TODOS LOS .on() ANTES de .subscribe() ──
      tablesList.forEach((table) => {
        channel = channel.on(
          // @ts-expect-error tipos de supabase-js para postgres_changes
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (cancelled) return;
            if (callbackRef.current) {
              callbackRef.current();
            } else {
              router.refresh();
            }
          },
        );
      });

      // Si el componente se desmontó mientras await getUser(), abortar
      if (cancelled) return;

      // Guardar referencia ANTES de subscribe para que el cleanup pueda
      // removerlo aunque el subscribe falle
      channelRef = channel;

      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useSupabaseRealtime] ${channelName}: ${status}`);
        }
      });
    }

    setupChannel();

    return () => {
      cancelled = true;
      // Cleanup sincrónico si ya tenemos el channel ref
      if (channelRef) {
        supabase.removeChannel(channelRef).catch(() => {
          // Ignorar errores de cleanup (channel ya removido, etc.)
        });
        channelRef = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, event]);
}
