import Link from 'next/link';
import { ArrowRight, BarChart3, Users, Calendar, Sparkles } from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════
// Landing temporal del CRM web — para usuarios que llegan a app.vylta.lat
// sin sesión y sin venir desde el dominio principal vylta.lat.
//
// Si el usuario ya tiene sesión, el middleware lo redirige a /dashboard.
// Si no la tiene, ve esta pantalla con CTA para iniciar sesión.
// ══════════════════════════════════════════════════════════════════════

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decoración de fondo: gradiente sutil */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-vylta-green-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-vylta-green-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vylta-green-500 text-white shadow-lg shadow-vylta-green-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">VYLTA</span>
            <span className="ml-2 rounded-full bg-vylta-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-vylta-green-600 dark:text-vylta-green-400">
              CRM
            </span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-vylta-green-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-vylta-green-500/20 transition hover:bg-vylta-green-600"
          >
            Iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* Hero */}
        <div className="mt-24 flex flex-1 flex-col items-center text-center">
          <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-vylta-green-500/20 bg-vylta-green-500/5 px-4 py-1.5 text-sm font-medium text-vylta-green-600 dark:text-vylta-green-400">
            <Sparkles className="h-3.5 w-3.5" />
            Tu negocio, ahora desde la computadora
          </div>

          <h1 className="animate-slide-up mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            La plataforma ejecutiva
            <br />
            <span className="bg-gradient-to-r from-vylta-green-500 to-vylta-green-700 bg-clip-text text-transparent">
              para tu micro-negocio
            </span>
          </h1>

          <p className="animate-slide-up mt-6 max-w-xl text-lg text-muted-foreground">
            Administra tu agenda, clientes y reportes desde cualquier dispositivo.
            Pensado para dueños y sus equipos.
          </p>

          <div className="animate-slide-up mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vylta-green-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-vylta-green-500/25 transition hover:bg-vylta-green-600 hover:shadow-xl hover:shadow-vylta-green-500/30"
            >
              Entrar a mi cuenta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://vylta.lat"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold transition hover:bg-secondary"
            >
              Conoce VYLTA
            </a>
          </div>

          {/* Feature cards */}
          <div className="mt-24 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
            {[
              { icon: Calendar, title: 'Agenda visual', desc: 'Vista calendario semanal/mensual estilo Google Calendar.' },
              { icon: Users, title: 'CRM de clientes', desc: 'Toda la información de tus clientes en un solo lugar.' },
              { icon: BarChart3, title: 'Reportes ejecutivos', desc: 'Dashboards expandidos con insights automáticos.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="animate-fade-in rounded-xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-vylta-green-500/30 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-vylta-green-500/10 text-vylta-green-600 dark:text-vylta-green-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VYLTA — Hecho en México 🇲🇽
        </footer>
      </div>
    </div>
  );
}
