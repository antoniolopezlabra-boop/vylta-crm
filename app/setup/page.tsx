import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetupWizard } from '@/components/setup-wizard';

export const metadata: Metadata = {
  title: 'Configura tu negocio',
  description: 'Termina de configurar tu cuenta VYLTA en unos minutos.',
};

// ══════════════════════════════════════════════════════════════════════
// /setup — Wizard de onboarding para usuarios nuevos.
//
// Cuándo se entra aquí:
//   • Después de crear cuenta en /register (router.push('/setup'))
//   • Si el middleware detecta usuario logueado SIN business_profile
//     (futura mejora — Fase 3)
//
// Cuándo NO se debe entrar:
//   • Usuario sin sesión → middleware lo manda a /login
//   • Usuario que ya completó el setup → redirigir a /dashboard
//     (lo hacemos aquí en server para evitar flash visual)
//
// Estructura del wizard (4 pasos, espejo de la app móvil):
//   1. Negocio: nombre, tipo, teléfono
//   2. Primer servicio: nombre, duración, precio
//   3. Horarios de atención: días + rangos
//   4. Listo: link público generado + invitación a compartir
//
// Diseño: dark premium consistente con /login y /register, con stepper
// arriba que indica progreso (1/4 · 2/4 · etc).
// ══════════════════════════════════════════════════════════════════════

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/setup');
  }

  // Si ya tiene business_profile completo → directo a dashboard.
  // Usamos maybeSingle() en lugar de single() para que NO arroje
  // si el row no existe (caso normal en usuarios nuevos).
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, business_type')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAlreadySetup = !!(profile?.business_name && profile?.business_type);

  if (isAlreadySetup) {
    redirect('/dashboard');
  }

  // Pasamos el nombre del usuario al wizard para personalizar saludo.
  const userName =
    (user.user_metadata?.full_name as string | undefined)?.trim().split(' ')[0]
    || user.email?.split('@')[0]
    || '';

  return <SetupWizard userId={user.id} userName={userName} />;
}
