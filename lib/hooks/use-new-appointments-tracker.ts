'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// useNewAppointmentsTracker — Detecta INSERTS de citas en tiempo real.
//
// Mantiene un Set<string> con los IDs de citas que entraron en los
// últimos N segundos para que los componentes los animen visualmente
// ("nueva cita" con parpadeo + glow verde).
//
// CARACTERÍSTICAS:
//   • Solo escucha INSERTs filtrados por user_id del usuario actual
//   • Cada cita se considera "nueva" durante NEW_APPT_TTL_MS (default 8s)
//   • Tras el TTL, el ID sale automáticamente del set
//   • Si el componente se desmonta, todos los timers se limpian
//   • Función isNew(id) para que cualquier renderizador decida
//
// REGLA DE ORO:
//   Llamar TODOS los .on() ANTES de .subscribe() — patrón documentado
//   en lib/hooks/use-supabase-realtime.ts. Channel name único por
//   mount para evitar colisiones bajo React Strict Mode.
//
// USO:
//   const { isNew } = useNewAppointmentsTracker();
//   return appointments.map(a => (
//     <Card className={isNew(a.id) ? 'animate-new-pulse' : ''} />
//   ));
// ══════════════════════════════════════════════════════════════════════

// Duración total de la animación visual en ms.
// 8s es suficiente para que el usuario lo note pero no abrumador.
const NEW_APPT_TTL_MS = 8000;

// Anti-flood: si entran 50+ citas en 1s (ej. import masivo), ignoramos
// el resto para no congelar el browser con animaciones simultáneas.
const MAX_NEW_AT_ONCE = 20;

export function useNewAppointmentsTracker() {
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  // Ref para limpieza de timers individuales por ID
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Función estable (no recrea referencias en cada render)
  const isNew = useCallback(
    (id: string): boolean => newIds.has(id),
    [newIds],
  );

  // Función pública para que un componente "marque manualmente" una cita
  // como nueva — útil cuando el usuario AGENDA desde el mismo dispositivo
  // (no llega via realtime porque ya invalidamos el cache localmente).
  const markAsNew = useCallback((id: string) => {
    setNewIds(prev => {
      if (prev.has(id)) return prev; // ya está, no re-disparar timer
      const next = new Set(prev);
      next.add(id);

      // Programar limpieza
      const timer = setTimeout(() => {
        setNewIds(curr => {
          const updated = new Set(curr);
          updated.delete(id);
          return updated;
        });
        timersRef.current.delete(id);
      }, NEW_APPT_TTL_MS);

      timersRef.current.set(id, timer);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    const supabase = createClient();

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Channel name único por mount (matching pattern de
      // use-supabase-realtime.ts para evitar colisiones bajo Strict Mode)
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const channelName = `new-appts:${user.id}:${uniqueId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          // @ts-expect-error — tipos de supabase-js para postgres_changes
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'appointments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { new: { id: string } | null }) => {
            if (cancelled) return;
            const newRow = payload?.new;
            if (!newRow?.id) return;

            // Anti-flood — si ya tenemos muchas animaciones activas,
            // ignoramos las nuevas para no congelar el browser.
            setNewIds(prev => {
              if (prev.size >= MAX_NEW_AT_ONCE) return prev;
              if (prev.has(newRow.id)) return prev;

              const next = new Set(prev);
              next.add(newRow.id);

              const timer = setTimeout(() => {
                setNewIds(curr => {
                  const updated = new Set(curr);
                  updated.delete(newRow.id);
                  return updated;
                });
                timersRef.current.delete(newRow.id);
              }, NEW_APPT_TTL_MS);

              timersRef.current.set(newRow.id, timer);
              return next;
            });
          },
        );

      if (cancelled) return;
      channelRef = channel;

      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useNewAppointmentsTracker] ${channelName}: ${status}`);
        }
      });
    }

    setup();

    return () => {
      cancelled = true;
      if (channelRef) {
        supabase.removeChannel(channelRef).catch(() => {/* ignore */});
        channelRef = null;
      }
      // Limpiar todos los timers pendientes
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return { isNew, markAsNew };
}
