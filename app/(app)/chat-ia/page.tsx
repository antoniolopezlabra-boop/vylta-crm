import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPremiumAccess } from '@/lib/plan-labels';
import { ComingSoon } from '@/components/coming-soon';
import { ChatClient } from './chat-client';

// ══════════════════════════════════════════════════════════════════════
// /chat-ia — Asistente IA de soporte VYLTA
//
// ⚡ ACTIVACIÓN FASE 1 (May 21 2026):
//   Replica el chat IA que existe en la app móvil (settings/support-chat.tsx).
//   Reutiliza la MISMA Edge Function `ai-chat` ya deployada en Supabase.
//   No requiere infraestructura nueva (ANTHROPIC_API_KEY ya configurada).
//
// GATE DE PLAN:
//   Requiere Premium o superior (Premium / Luxury / VIP Premium / VIP Luxury).
//   La verificación principal la hace la Edge Function server-side.
//   Aquí solo gateamos la UI para no mostrar la interfaz a usuarios Básico.
//
// MEMORIA:
//   Por sesión (igual que en la app móvil). Al recargar la página, el
//   historial se pierde. No requiere tabla nueva en BD.
// ══════════════════════════════════════════════════════════════════════

export default async function ChatIaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verificar plan
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!hasPremiumAccess(plan?.plan_type)) {
    return (
      <ComingSoon
        title="Chat IA"
        description="Tu asistente personal 24/7 que conoce VYLTA al detalle. Resuelve dudas al instante."
        planRequired="Premium"
        features={[
          'Disponible 24/7 en español',
          'Responde dudas sobre cómo usar la app',
          'Te explica diferencias entre planes',
          'Te guía en configuración y reportes',
          'Te orienta con WhatsApp y link público',
          'Respuestas instantáneas — sin esperas',
          'Si no sabe algo, te dirige a soporte humano',
        ]}
      />
    );
  }

  return <ChatClient />;
}
