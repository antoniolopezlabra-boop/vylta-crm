import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConfiguracionShell } from '@/components/settings/configuracion-shell';

// ══════════════════════════════════════════════════════════════════════
// /configuracion — ahora con secciones editables alineadas con la app móvil:
//   • Negocio (nombre, teléfono, dirección, descripción)
//   • Plan + suscripción
//   • Link público (activar/desactivar)
//   • Citas simultáneas (toggle, Luxury)
//   • Recordatorios de cumpleaños (Premium/Luxury)
//   • WhatsApp Business (pantalla informativa)
//   • Cuenta (cambiar contraseña)
//
// IMPORTANTE: usamos select('*') en subscription_plans (igual que la app móvil)
// para evitar errores de columnas que no existen en BD. La columna
// 'current_period_end' fue removida del schema y NO debe pedirse explícitamente.
// ══════════════════════════════════════════════════════════════════════

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, planRes, bookingLinkRes] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('booking_links')
      .select('is_active, slug')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return (
    <ConfiguracionShell
      user={{ id: user.id, email: user.email || '' }}
      profile={profileRes.data || null}
      plan={planRes.data || null}
      bookingLink={bookingLinkRes.data || null}
    />
  );
}
