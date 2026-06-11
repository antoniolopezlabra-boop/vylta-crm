// Helpers de Google Ads para el CRM de VYLTA.
// La etiqueta base se carga en components/google-tag.tsx (RootLayout).

export const GOOGLE_ADS_ID = 'AW-591393013';

// Propiedad GA4 "VYLTA Web" (analytics.google.com, cuenta VYLTA).
// Mide el embudo completo: landing (vylta.lat) → registro → suscripción.
export const GA4_ID = 'G-DC4M60185V';

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

// Reporta una conversion de Google Ads desde el cliente.
// `label` es la etiqueta de la accion de conversion (Google Ads >
// Objetivos > Conversiones > fragmento de evento).
export function reportAdsConversion(label: string, value?: number) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    ...(value !== undefined ? { value, currency: 'MXN' } : {}),
  });
}

// Etiquetas de conversion creadas en la cuenta 136-048-3356:
// - registro: accion "Registro" (evento manual, se dispara en /setup).
// - La accion "Suscripcion" NO requiere etiqueta: es por URL
//   (vylta.lat/success.html) y la detecta la etiqueta base de Google.
export const ADS_CONVERSION_LABELS = {
  registro: 'W9TQCLvbprwcEPXh_5kC',
} as const;
