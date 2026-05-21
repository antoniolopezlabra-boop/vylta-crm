import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLuxuryAccess } from '@/lib/plan-labels';
import { ComingSoon } from '@/components/coming-soon';
import { MarketingPageClient } from './marketing-page-client';

// ══════════════════════════════════════════════════════════════════════
// /marketing — Listado de campañas de email marketing.
//
// ⚡ FASE 1 (May 19 2026):
//   Solo el listado. Crear/editar/ver detalle viene en Fase 2.
//
// GATE DE PLAN:
//   Requiere Luxury (o VIP Luxury). Si el usuario tiene Premium o
//   inferior, se muestra <ComingSoon> con el upsell.
//
// FETCH:
//   - email_campaigns ordenado desc por created_at
//   - business_name del usuario para la cabecera y links de upgrade
// ══════════════════════════════════════════════════════════════════════

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Obtener plan del usuario
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .maybeSingle();

  const isLuxury = hasLuxuryAccess(plan?.plan_type);

  // Si no tiene Luxury, mostrar el upsell (sigue siendo restricted)
  if (!isLuxury) {
    return (
      <ComingSoon
        title="Marketing"
        description="Envía emails masivos a tus clientes con promociones, cupones de descuento y felicitaciones de cumpleaños — todo desde tu CRM."
        planRequired="Luxury"
        features={[
          'Campañas masivas por email a todos tus clientes',
          'Segmentación: todos / activos / inactivos',
          'Cupones de descuento con códigos personalizables',
          'Emails de felicitación de cumpleaños',
          'Variables dinámicas: {{nombre}}, {{negocio}}',
          'Vista previa antes de enviar',
          'Borradores para preparar campañas con calma',
          'Métricas: enviados, abiertos, conversiones',
        ]}
      />
    );
  }

  // Usuario con Luxury — obtener campañas
  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('id, subject, body, segment, status, sent_at, recipient_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <MarketingPageClient initialCampaigns={campaigns || []} />;
}
