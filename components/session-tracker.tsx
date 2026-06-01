'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ======================================================================
// SessionTracker - Componente invisible que registra la ultima conexion
// del usuario en la tabla user_sessions.
//
// CONTEXTO (Jun 2026):
// El panel admin (seccion "Mejores y peores negocios") muestra la "ultima
// conexion" de cada negocio leyendo user_sessions.last_seen_at (ver
// lib/admin-tenants.ts -> formatLastSeen). La app movil ya registra ahi
// en cada sesion (contexts/AuthContext.tsx -> trackSession), pero el CRM
// Web NO lo hacia. Resultado: los negocios que solo usan el CRM Web
// aparecian como "Nunca" aunque si se conectaran.
//
// Este componente replica EXACTAMENTE el mismo upsert que la app movil
// para que el dato sea consistente entre ambas plataformas:
//   upsert({ user_id, last_seen_at }, { onConflict: 'user_id' })
//
// Se monta una sola vez en el layout autenticado (app/(app)/layout.tsx),
// asi que se ejecuta cuando el dueno entra a cualquier pantalla del CRM.
// Es fire-and-forget: si falla, solo se loguea; nunca rompe la UI.
// ======================================================================

export function SessionTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        await supabase.from('user_sessions').upsert(
          { user_id: userId, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      } catch (e) {
        if (!cancelled) {
          // No critico: el peor caso es que la "ultima conexion" no se
          // actualice esta vez. No debe afectar la experiencia del usuario.
          console.warn('[SessionTracker] No se pudo registrar la sesion:', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return null;
}
