import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

// ══════════════════════════════════════════════════════════════════════
// Inter como tipografía global — estándar del SaaS moderno.
// Se carga con next/font para que Next pre-optimice y evite layout shift.
// ══════════════════════════════════════════════════════════════════════
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'VYLTA — Plataforma para tu negocio',
    template: '%s · VYLTA',
  },
  description: 'Administra tu agenda, clientes y reportes desde cualquier dispositivo. La plataforma de citas ejecutiva para micro-negocios mexicanos.',
  keywords: ['agenda', 'citas', 'salón', 'barbería', 'CRM', 'México', 'WhatsApp'],
  authors: [{ name: 'VYLTA' }],
  creator: 'VYLTA',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.vylta.lat'),
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    title: 'VYLTA — Plataforma para tu negocio',
    description: 'Administra tu agenda, clientes y reportes desde cualquier dispositivo.',
    siteName: 'VYLTA',
  },
  robots: {
    index: false, // CRM privado, no queremos que Google indexe
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)',  color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: 'var(--font-inter)' },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
