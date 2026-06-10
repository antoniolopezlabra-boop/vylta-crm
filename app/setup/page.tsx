import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetupWizard } from '@/components/setup-wizard';
import { AdsRegistroTracker } from '@/components/ads-registro-tracker';

export const metadata: Metadata = {
  title: 'Configura tu negocio',
  description: 'Termina de configurar tu cuenta VYLTA en unos minutos.',
};

// ══════════════════════════════════════════════════════════════════════
// /setup — Wizard de onboarding para usuarios nuevos.
//
// ⚡ HOTFIX (May 19 2026): la lógica anterior detectaba "setup completo"
// si existía un row en business_profiles con business_name lleno.
// PROBLEMA: Supabase tiene un trigger SQL (handle_new_user u otro) que
// pre-crea un row en business_profiles al hacer signUp, con
// business_name vacío o con valor default. Esto causaba que usuarios
// recién registrados fueran redirigidos al dashboard SIN haber pasado
// por el wizard.
//
// SOLUCIÓN ROBUSTA: detectar "setup completo" verificando si el usuario
// tiene al menos 1 servicio activo. Esto es algo que SOLO se crea
// cuando el wizard se completa (o cuando el usuario lo crea manualmente
// desde Configuración en la app móvil — caso retrocompatible).
//
// Ventajas de este enfoque:
//   • Inmune a triggers SQL que pre-creen rows en business_profiles
//   • Retrocompatible: usuarios viejos con servicios siguen
//     yendo directo al dashboard
//   • Funciona aunque otro proceso (admin panel, app móvil) modifique
//     business_profiles sin completar setup
//   • Simple: 1 query a services count
// ══════════════════════════════════════════════════════════════════════

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/setup');
  }

  // ⚡ Detección de setup completo: ¿tiene al menos 1 servicio?
  //
  // Si tiene → ya pasó por el wizard (en mobile o web) → dashboard
  // Si no   → es nuevo o saltó el wizard → mostrar wizard
  //
  // Usamos head:true + count para evitar traer las columnas — más rápido.
  // Filtramos por is_active para no contar servicios eliminados/inactivos.
  const { count: servicesCount } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const hasCompletedSetup = (servicesCount ?? 0) > 0;

  if (hasCompletedSetup) {
    redirect('/dashboard');
  }

  // Pasamos el nombre del usuario al wizard para personalizar saludo.
  const userName =
    (user.user_metadata?.full_name as string | undefined)?.trim().split(' ')[0]
    || (user.user_metadata?.name as string | undefined)?.trim().split(' ')[0]
    || user.email?.split('@')[0]
    || '';

  return (
    <>
      {/* Conversion "Registro" de Google Ads: /setup solo se muestra a cuentas nuevas */}
      <AdsRegistroTracker userId={user.id} />
      <SetupWizard userId={user.id} userName={userName} />
    </>
  );
}
