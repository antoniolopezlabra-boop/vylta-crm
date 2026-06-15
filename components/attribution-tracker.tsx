'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Fase 2 — al llegar a /setup (registro nuevo), enlaza la sesión del
// embudo (vylta_attr en localStorage, capturado por AttributionCapture)
// con el user_id recién creado → public.signup_attribution. Eso permite
// atribuir registros y pagos a su sesión, origen y giro reales.
export function AttributionTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;
    try {
      const guard = `vylta_attr_sent_${userId}`;
      if (localStorage.getItem(guard)) return;
      const raw = localStorage.getItem('vylta_attr');
      if (!raw) return;
      const a = JSON.parse(raw);
      if (!a || !a.session_id) return;

      const supabase = createClient();
      supabase
        .from('signup_attribution')
        .upsert(
          {
            user_id: userId,
            session_id: a.session_id,
            giro: a.giro ?? null,
            utm_source: a.utm_source ?? null,
            utm_medium: a.utm_medium ?? null,
            utm_campaign: a.utm_campaign ?? null,
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) console.error('[Attribution]', error);
          else {
            try {
              localStorage.setItem(guard, '1');
            } catch {
              /* noop */
            }
          }
        });
    } catch {
      /* noop */
    }
  }, [userId]);

  return null;
}
