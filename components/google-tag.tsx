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
      {/* Meta Pixel (2584977208329904) — para que Facebook optimice por
          conversiones. PageView aquí; CompleteRegistration en AdsRegistroTracker. */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          try{fbq('init','2584977208329904');fbq('track','PageView');}catch(e){}
        `}
      </Script>
    </>
  );
}
