import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLuxuryAccess } from '@/lib/plan-labels';
import { CampaignDetailClient } from './campaign-detail-client';

// ══════════════════════════════════════════════════════════════════════
// /marketing/[id] — Detalle de campaña
//
// ⚡ FASE 3 (May 19 2026):
//   Ver campaña + acciones (editar borrador / duplicar / eliminar).
//
// FETCH:
//   • La campaña por id (con .eq user_id por RLS).
//   • business_name para el preview.
//
// SI NO EXISTE:
//   notFound() → muestra la página 404 de Next.js.
//
// GATE DE PLAN:
//   Requiere Luxury. Si no, redirige a /marketing (que ya tiene su gate).
// ══════════════════════════════════════════════════════════════════════

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    redirect('/marketing');
  }

  // Obtener campaña
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .select('id, subject, body, segment, status, sent_at, recipient_count, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[CampaignDetail] fetch error:', error);
    notFound();
  }

  if (!campaign) {
    notFound();
  }

  // business_name para preview
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <CampaignDetailClient
      campaign={campaign}
      businessName={profile?.business_name || 'Tu Negocio'}
      userId={user.id}
    />
  );
}
