'use client';

import { useEffect } from 'react';

// Fase 2 — captura la atribución del embudo al llegar a app.vylta.lat.
// El enlace de registro trae ?vf_sid (sesión de la experiencia) + utm/giro.
// localStorage NO cruza de vylta.lat a app.vylta.lat (orígenes distintos),
// por eso lo persistimos aquí para leerlo luego en /setup tras el signup.
export function AttributionCapture() {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const sid = sp.get('vf_sid');
      if (!sid) return;
      const data = {
        session_id: sid,
        giro: sp.get('vf_giro') || sp.get('utm_campaign') || null,
        utm_source: sp.get('utm_source'),
        utm_medium: sp.get('utm_medium'),
        utm_campaign: sp.get('utm_campaign'),
      };
      localStorage.setItem('vylta_attr', JSON.stringify(data));
    } catch {
      /* localStorage no disponible */
    }
  }, []);

  return null;
}
