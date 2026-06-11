import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import { GoogleTag } from '@/components/google-tag';
import './globals.css';

// ══════════════════════════════════════════════════════════════════════
// Inter es la fuente oficial de VYLTA según brand guidelines v1.0.
// Cargada con next/font para pre-optimización y cero layout shift.
//
// Pesos cargados:
//   400 Regular   → body
//   500 Medium    → captions, labels
//   600 SemiBold  → UI elements, botones, headings secundarios
//   700 Bold      → display, headings principales
//
// THEME (May 22 2026):
// El CRM Web ahora soporta light + dark mode. Dark sigue siendo el
// default (alineado con brand kit), pero el usuario puede cambiar via
// el toggle en el topbar. La preferencia se persiste en localStorage.
// ══════════════════════════════════════════════════════════════════════
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'VYLTA — Cada cliente regresa',
    template: '%s · VYLTA',
  },
  description: 'La plataforma de citas y clientes para tu negocio. Agenda, recordatorios automáticos por WhatsApp y reportes ejecutivos.',
  keywords: ['agenda', 'citas', 'salón', 'barbería', 'estética', 'CRM', 'México', 'WhatsApp'],
  authors: [{ name: 'VYLTA' }],
  creator: 'VYLTA',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.vylta.lat'),
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    title: 'VYLTA — Cada cliente regresa',
    description: 'Administra tu agenda, clientes y reportes desde cualquier dispositivo.',
    siteName: 'VYLTA',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={inter.variable}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Google Analytics 4 + Google Ads — misma etiqueta que vylta.lat para
            medir el embudo completo (landing → registro → suscripción).
            Subdominios comparten cookie en .vylta.lat, no requiere cross-domain. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DC4M60185V"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DC4M60185V');
            gtag('config', 'AW-591393013');
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            theme="system"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-inter)',
              },
            }}
          />
        </ThemeProvider>
        <GoogleTag />
      </body>
    </html>
  );
}
