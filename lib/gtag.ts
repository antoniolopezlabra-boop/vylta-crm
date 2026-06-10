// Helpers de Google Ads para el CRM de VYLTA.
// La etiqueta base se carga en components/google-tag.tsx (RootLayout).

export const GOOGLE_ADS_ID = 'AW-591393013';

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

// Reporta una conversion de Google Ads desde el cliente.
// `label` es la etiqueta de la accion de conversion (se obtiene en
// Google Ads > Objetivos > Conversiones, formato corto tipo 'AbCdEfGh').
// Uso previsto:
//   reportAdsConversion(ADS_CONVERSION_LABELS.registro)
export function reportAdsConversion(label: string, value?: number) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    ...(value !== undefined ? { value, currency: 'MXN' } : {}),
  });
}

// Etiquetas de conversion. PENDIENTE: completar cuando las acciones de
// conversion esten creadas en Google Ads (Registro y Suscripcion).
export const ADS_CONVERSION_LABELS = {
  registro: '', // TODO: etiqueta de la accion 'Registro VYLTA'
} as const;
