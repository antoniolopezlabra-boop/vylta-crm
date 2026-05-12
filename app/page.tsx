import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// ══════════════════════════════════════════════════════════════════════
// Página raíz del CRM web (app.vylta.lat/)
//
// NO es una landing — el marketing y descubrimiento viven en vylta.lat.
// Esta página es solo un router que decide a dónde mandar al usuario:
//
//   ┌─────────────────────┐
//   │ Usuario llega a /   │
//   └──────────┬──────────┘
//              │
//              ▼
//      ¿Tiene sesión?
//        ┌─────┴─────┐
//        SÍ          NO
//        │            │
//        ▼            ▼
//   /dashboard     /login
//
// Esto mantiene una experiencia limpia y profesional, alineada con
// patrones de Stripe, Linear, Notion, etc. — donde el dominio de la app
// nunca muestra contenido de marketing duplicado.
// ══════════════════════════════════════════════════════════════════════

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Con sesión válida → dashboard. Sin sesión → login.
  // El middleware también maneja este redirect, pero hacerlo aquí explícito
  // evita un "flash" de la página durante la hidratación inicial.
  if (user) {
    redirect('/dashboard');
  }

  redirect('/login');
}
