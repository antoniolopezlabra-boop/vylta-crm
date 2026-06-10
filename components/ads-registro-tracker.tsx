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
    try {
      const key = `vylta_ads_registro_${userId}`;
      if (window.localStorage.getItem(key)) return;
      reportAdsConversion(ADS_CONVERSION_LABELS.registro);
      window.localStorage.setItem(key, '1');
    } catch {
      // localStorage no disponible (modo privado estricto):
      // reportar de todos modos; Google deduplica por clic.
      reportAdsConversion(ADS_CONVERSION_LABELS.registro);
    }
  }, [userId]);

  return null;
}
