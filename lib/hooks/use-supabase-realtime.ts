'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useSupabaseRealtime — Hook reutilizable para escuchar cambios en una
// tabla de Supabase y refrescar automáticamente los datos del server
// component padre.
//
// Funciona en combinación con Server Components de Next.js 15:
//   • Cuando Supabase notifica un cambio en la tabla, llamamos
//     router.refresh() que re-ejecuta los queries del Server Component
//     SIN recargar la página completa.
//   • Solo escucha cambios del usuario autenticado (filtro user_id).
//
// USO:
//   useSupabaseRealtime('appointments');
//   useSupabaseRealtime('clients');
//
// Soporta múltiples tablas pasando un array:
//   useSupabaseRealtime(['appointments', 'clients']);
//
// Para casos donde NO quieres usar router.refresh sino un callback custom:
//   useSupabaseRealtime('appointments', () => loadData());
//
// REGLA DE ORO (lección aprendida con Hermes/Android en app móvil):
//   Crear el channel UNA sola vez al montar y limpiar al desmontar.
//   Si las deps cambian innecesariamente se crean varios channels
//   duplicados y Supabase los rechaza.
// ══════════════════════════════════════════════════════════════════════

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export function useSupabaseRealtime(
  tables: string | string[],
  onChange?: () => void,
  options: { event?: RealtimeEvent } = {},
) {
  const router = useRouter();
  // Guardamos el callback en una ref para que cambios en él no creen un
  // nuevo channel cada render.
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const event = options.event || '*';
  const tablesList = Array.isArray(tables) ? tables : [tables];
  // Serializamos para usarlo como key estable en el useEffect.
  const tablesKey = tablesList.sort().join(',');

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function setupChannel() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return null;

      // Nombre único del channel: incluye user_id + tablas para evitar
      // colisiones si el mismo usuario abre varios componentes.
      const channelName = `realtime:${user.id}:${tablesKey}`;

      let channel = supabase.channel(channelName);

      // Suscribir a cada tabla con filtro user_id
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
            // Ejecutar callback custom si existe, sino router.refresh
            if (callbackRef.current) {
              callbackRef.current();
            } else {
              router.refresh();
            }
          },
        );
      });

      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useSupabaseRealtime] channel ${channelName}: ${status}`);
        }
      });

      return channel;
    }

    const channelPromise = setupChannel();

    return () => {
      cancelled = true;
      channelPromise.then((channel) => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, event]);
}
