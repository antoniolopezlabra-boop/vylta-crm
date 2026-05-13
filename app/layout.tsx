import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
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
    index: false, // CRM privado
    follow: false,
  },
};

export const viewport: Viewport = {
  // Theme color = Negro VYLTA oficial (#0A0E1A)
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
      // Forzamos dark mode permanente para matchear identidad VYLTA dark-first.
      // El `dark` aquí + `forcedTheme` en el provider hacen imposible que
      // accidentalmente se renderice en light en SSR.
      className={`${inter.variable} dark`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-inter)',
                background: 'hsl(228 35% 14%)',
                border: '1px solid hsl(217 19% 17%)',
                color: 'hsl(210 40% 96%)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
