import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLuxuryAccess } from '@/lib/plan-labels';
import { ComingSoon } from '@/components/coming-soon';
import { NewCampaignClient } from './new-campaign-client';

// ══════════════════════════════════════════════════════════════════════
// /marketing/new — Crear nueva campaña de email marketing.
//
// ⚡ FASE 2 (May 19 2026):
//   Solo CREAR campañas nuevas. Editar borradores existentes y duplicar
//   campañas enviadas se hace en Fase 3 (cuando exista /marketing/[id]).
//
// GATE DE PLAN:
//   Requiere Luxury. El botón "Nueva campaña" del listado solo aparece
//   si el usuario ya pasó el gate de /marketing, pero igual lo validamos
//   por seguridad en caso de URL directa.
//
// PROPS AL CLIENT:
//   • userId       → para queries y envío via Edge Function
//   • businessName → para preview del email ("De: Karen Nails…")
// ══════════════════════════════════════════════════════════════════════

export default async function NewMarketingCampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verificar plan
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!hasLuxuryAccess(plan?.plan_type)) {
    return (
      <ComingSoon
        title="Marketing"
        description="Envía emails masivos a tus clientes con promociones, cupones de descuento y felicitaciones de cumpleaños."
        planRequired="Luxury"
        features={[
          'Campañas masivas por email a todos tus clientes',
          'Segmentación: todos / activos / inactivos',
          'Variables dinámicas: {{nombre}}, {{negocio}}',
          'Vista previa antes de enviar',
        ]}
      />
    );
  }

  // Obtener business_name para preview
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <NewCampaignClient
      userId={user.id}
      businessName={profile?.business_name || 'Tu Negocio'}
    />
  );
}
