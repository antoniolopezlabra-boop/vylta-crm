import Script from 'next/script';
import { GA4_ID, GOOGLE_ADS_ID } from '@/lib/gtag';

// Etiqueta de Google (gtag.js): Google Ads (conversiones de campañas) +
// GA4 (analítica del embudo). Se monta una sola vez en el RootLayout.
// Cuenta Ads: 136-048-3356 · Propiedad GA4: VYLTA Web.
export function GoogleTag() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
          gtag('config', '${GA4_ID}');
        `}
      </Script>
    </>
  );
}
