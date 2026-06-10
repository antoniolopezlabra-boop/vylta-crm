import Script from 'next/script';
import { GOOGLE_ADS_ID } from '@/lib/gtag';

// Etiqueta de Google Ads (gtag.js) para medir conversiones de campañas.
// Se monta una sola vez en el RootLayout. ID de cuenta: 136-048-3356.
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
        `}
      </Script>
    </>
  );
}
