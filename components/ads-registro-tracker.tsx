'use client';

import { useEffect } from 'react';
import { reportAdsConversion, ADS_CONVERSION_LABELS } from '@/lib/gtag';

// Dispara la conversion "Registro" de Google Ads una sola vez por
// navegador cuando un usuario nuevo llega al wizard de onboarding.
// /setup solo se renderiza para cuentas sin setup completo, por lo que
// equivale a un registro nuevo. La guardia en localStorage mas el
// recuento "Una" configurado en Google Ads evitan dobles conteos.
export function AdsRegistroTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;
    // Meta Pixel: conversión de registro (para que Facebook optimice por
    // registros, no por clics). Mismo punto y misma deduplicación que Ads.
    const reportMeta = () => {
      try { (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'CompleteRegistration'); } catch { /* noop */ }
    };
    try {
      const key = `vylta_ads_registro_${userId}`;
      if (window.localStorage.getItem(key)) return;
      reportAdsConversion(ADS_CONVERSION_LABELS.registro);
      reportMeta();
      window.localStorage.setItem(key, '1');
    } catch {
      // localStorage no disponible (modo privado estricto):
      // reportar de todos modos; Google/Meta deduplican.
      reportAdsConversion(ADS_CONVERSION_LABELS.registro);
      reportMeta();
    }
  }, [userId]);

  return null;
}
