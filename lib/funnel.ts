import { createClient } from '@/lib/supabase/client';

// Eventos del embudo en app.vylta.lat (registro). Se guardan en la misma tabla
// que usa vylta.lat (funnel_events) con la sesión y los utm que trajo el enlace,
// para ver dónde se cae quien llega de un anuncio: vista → envío → error / éxito.
// Nunca rompe el flujo: cualquier falla se ignora.
export function trackFunnel(event: string, extra: { giro?: string | null; detalle?: string } = {}) {
  try {
    const sp = new URLSearchParams(window.location.search);
    let attr: Record<string, string | null> = {};
    try { attr = JSON.parse(localStorage.getItem('vylta_attr') || '{}'); } catch { /* sin atribución */ }
    const sid = sp.get('vf_sid') || attr.session_id || null;
    if (!sid) return;
    void createClient().from('funnel_events').insert({
      session_id: sid,
      event_name: event,
      giro: extra.giro ?? sp.get('vf_giro') ?? attr.giro ?? null,
      utm_source: sp.get('utm_source') ?? attr.utm_source ?? null,
      utm_medium: sp.get('utm_medium') ?? attr.utm_medium ?? null,
      utm_campaign: sp.get('utm_campaign') ?? attr.utm_campaign ?? null,
      path: window.location.pathname,
      referrer: extra.detalle ?? (document.referrer || null),
    }).then(() => undefined, () => undefined);
  } catch { /* noop */ }
}
