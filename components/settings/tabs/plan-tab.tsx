'use client';

import { useState } from 'react';
import {
  CreditCard,
  Check,
  X,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Settings,
  Loader2,
  Calendar,
  Shield,
  Lock,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SettingsCard } from '../configuracion-shell';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  getPlanDisplayName,
  getPlanBadgeLabel,
  getPlanPrice,
  getPlanDescription,
  getPlanBadgeClass,
  getPlanTier,
} from '@/lib/plan-labels';

// ══════════════════════════════════════════════════════════════════════
// PlanTab — Plan actual + activación de plan via Stripe + gestionar
// suscripción via Customer Portal.
//
// Patrón espejo de app/settings/subscription.tsx en móvil:
//   • Botones de activar plan abren los Payment Links de Stripe live
//   • Botón "Gestionar suscripción" llama Edge Function
//     'create-portal-session' que devuelve URL del Customer Portal
//   • Detalles de suscripción: desde/próximo cobro/estado/método
//
// IMPORTANTE: la Edge Function 'create-portal-session' espera el body
// con `user_id` (snake_case), NO `userId`.
//
// Schema real de subscription_plans en BD:
//   plan_type, status, price, features (jsonb), trial_ends_at,
//   stripe_customer_id, stripe_subscription_id, created_at, updated_at
// NO existe `current_period_end`.
// ══════════════════════════════════════════════════════════════════════

// Payment Links (LIVE) — los mismos que usa la app móvil
const STRIPE_LINKS = {
  premium: 'https://buy.stripe.com/7sY5kF5Ym9hm7mw5g938400',  // Plan Premium $399 MXN
  luxury:  'https://buy.stripe.com/8x228t72q65a9uE23X38402',  // Plan Luxury $799 MXN
};

interface PlanTabProps {
  userId: string;
  plan: {
    plan_type?: string | null;
    status?: string | null;
    price?: string | number | null;
    trial_ends_at?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
}

const PLAN_FEATURES = [
  { feature: 'Citas y agenda visual',          basico: true,  premium: true, luxury: true },
  { feature: 'Cobros pendientes',              basico: true,  premium: true, luxury: true },
  { feature: 'Link público de citas',          basico: false, premium: true, luxury: true },
  { feature: 'Recordatorios WhatsApp',         basico: false, premium: true, luxury: true },
  { feature: 'Reportes ejecutivos',            basico: false, premium: true, luxury: true },
  { feature: 'Equipo (hasta 5 colaboradores)', basico: false, premium: false, luxury: true },
  { feature: 'Citas simultáneas',              basico: false, premium: false, luxury: true },
  { feature: 'Email marketing',                basico: false, premium: false, luxury: true },
  { feature: 'Cumpleaños automáticos',         basico: false, premium: false, luxury: true },
  { feature: 'Chat IA de soporte',             basico: false, premium: true, luxury: true },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function PlanTab({ userId, plan }: PlanTabProps) {
  const [portalLoading, setPortalLoading] = useState(false);

  const rawPlanType = plan?.plan_type;
  const tier = getPlanTier(rawPlanType);
  const planName = getPlanDisplayName(rawPlanType);
  const planBadge = getPlanBadgeLabel(rawPlanType);
  const planPrice = getPlanPrice(rawPlanType);
  const planDescription = getPlanDescription(rawPlanType);
  const planBadgeClass = getPlanBadgeClass(rawPlanType);
  const isActive = (plan?.status || '').toLowerCase() === 'active';
  const hasPaidPlan = tier === 'premium' || tier === 'luxury';

  // Pasarle el user_id a Stripe via client_reference_id permite que el webhook
  // sepa qué cuenta actualizar cuando el pago se complete.
  function buildPaymentUrl(target: 'premium' | 'luxury'): string {
    const baseUrl = STRIPE_LINKS[target];
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}client_reference_id=${userId}`;
  }

  async function openCustomerPortal() {
    setPortalLoading(true);
    try {
      const supabase = createClient();
      // IMPORTANTE: la Edge Function espera `user_id` (snake_case),
      // no `userId` (camelCase). Verificado en /supabase/functions/
      // create-portal-session/index.ts del repo móvil.
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No se recibió URL del portal');

      // Abrir Stripe Customer Portal en pestaña nueva
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[PlanTab] Error abriendo portal:', err);
      toast.error('No pudimos abrir el portal de suscripción: ' + (err.message || 'Error desconocido'));
    } finally {
      setPortalLoading(false);
    }
  }

  // Próxima fecha de cobro estimada (updated_at + 30 días) — patrón móvil
  const nextBilling = (() => {
    if (!plan?.updated_at) return null;
    const d = new Date(plan.updated_at);
    d.setDate(d.getDate() + 30);
    return d;
  })();
  const isNextBillingSoon = nextBilling && (nextBilling.getTime() - Date.now()) < 5 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-4">
      {/* ── Plan actual ── */}
      <SettingsCard icon={CreditCard} title="Tu plan actual" description="Administra tu suscripción de VYLTA.">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">Plan {planName}</span>
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', planBadgeClass)}>{planBadge}</span>
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-vylta-green-500/15 px-2 py-0.5 text-[10px] font-bold text-vylta-green-700 dark:text-vylta-green-400">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  ACTIVO
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{planDescription}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">{planPrice}</div>
          </div>
        </div>

        {/* Detalles de suscripción — solo si tiene plan de pago */}
        {hasPaidPlan && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
            <DetailRow
              icon={Calendar}
              label="Suscrito desde"
              value={formatDate(plan?.created_at)}
              iconColor="text-blue-500"
            />
            <DetailRow
              icon={Zap}
              label="Próximo cobro"
              value={
                <span className={cn(isNextBillingSoon && 'text-vylta-amber-700 dark:text-amber-400 font-bold')}>
                  {nextBilling ? formatDate(nextBilling.toISOString()) : '—'}
                  {isNextBillingSoon && ' · pronto'}
                </span>
              }
              iconColor={isNextBillingSoon ? 'text-vylta-amber-500' : 'text-vylta-green-500'}
            />
            <DetailRow
              icon={Shield}
              label="Estado"
              value={
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  isActive
                    ? 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400'
                    : 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-vylta-green-500' : 'bg-vylta-amber-500')} />
                  {isActive ? 'Activa' : (plan?.status || 'Desconocido')}
                </span>
              }
              iconColor="text-vylta-green-500"
            />
            <DetailRow
              icon={CreditCard}
              label="Método de pago"
              value="Administrado por Stripe"
              iconColor="text-indigo-500"
            />
          </div>
        )}

        {/* Botón: Gestionar suscripción (Stripe Customer Portal) */}
        {hasPaidPlan && (
          <div className="mt-4 space-y-2">
            <Button
              onClick={openCustomerPortal}
              disabled={portalLoading}
              variant="outline"
              className="w-full border-indigo-500/30 bg-indigo-500/5 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-700 dark:text-indigo-400"
            >
              {portalLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo portal...</>
              ) : (
                <>
                  <Settings className="h-4 w-4" />
                  Gestionar suscripción
                  <ExternalLink className="h-3 w-3" />
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Cambiar método de pago, ver facturas o cancelar tu suscripción
            </p>
          </div>
        )}

        {/* Banner upgrade — Plan Básico */}
        {tier === 'basico' && (
          <div className="mt-4 rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 p-3">
            <p className="text-xs leading-relaxed text-vylta-green-700 dark:text-vylta-green-400">
              💡 <strong>Tu Plan Básico permite hasta 10 citas al mes</strong> (app + link público combinadas).
              Actualiza al Plan Premium para citas ilimitadas, recordatorios WhatsApp y reportes.
            </p>
          </div>
        )}

        {/* Banner upgrade — Plan Premium */}
        {tier === 'premium' && (
          <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
            <p className="text-xs leading-relaxed text-indigo-700 dark:text-indigo-400">
              ⭐ Mejora al <strong>Plan Luxury</strong> para activar tu equipo de hasta 5 colaboradores,
              email marketing, citas simultáneas y reportes avanzados.
            </p>
          </div>
        )}
      </SettingsCard>

      {/* ── Activar plan: tarjetas de upgrade ── */}
      {tier !== 'luxury' && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Activar un plan
          </h3>

          {/* Plan Premium */}
          {tier === 'basico' && (
            <PlanUpgradeCard
              tier="premium"
              emoji="🚀"
              name="Premium"
              price="$399"
              period="MXN / mes"
              tagline="Para negocios que necesitan citas ilimitadas y WhatsApp"
              features={[
                'Citas ilimitadas (app + link público)',
                'Recordatorios WhatsApp automáticos',
                'Confirmación al agendar + 24h y 2h antes',
                'Reportes ejecutivos completos',
                'Chat IA de soporte',
              ]}
              ctaUrl={buildPaymentUrl('premium')}
              ctaColor="bg-vylta-green-500 hover:bg-vylta-green-600"
            />
          )}

          {/* Plan Luxury */}
          <PlanUpgradeCard
            tier="luxury"
            emoji="⭐"
            name="Luxury"
            price="$799"
            period="MXN / mes"
            tagline="Para salones con equipo y estrategia de marketing"
            features={[
              'Todo lo del Plan Premium',
              'Hasta 5 colaboradores en tu equipo',
              'Citas simultáneas (atención en paralelo)',
              'Email marketing a tus clientes',
              'Recordatorios de cumpleaños',
              'Reportes avanzados del equipo',
              'Soporte prioritario',
            ]}
            ctaUrl={buildPaymentUrl('luxury')}
            ctaColor="bg-indigo-500 hover:bg-indigo-600"
            recommended
          />

          <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Pago seguro procesado por <strong>Stripe</strong>. Puedes cancelar en cualquier momento desde
              "Gestionar suscripción". Sin contratos ni penalidades.
            </p>
          </div>
        </div>
      )}

      {/* ── Tabla comparativa ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/30 px-4 py-2.5">
          <h3 className="text-sm font-bold">Compara los planes</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-bold">Función</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'basico' && 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400')}>Básico</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'premium' && 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400')}>Premium</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'luxury' && 'bg-vylta-amber-500/10 text-vylta-amber-700 dark:text-amber-400')}>Luxury</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 text-xs">{row.feature}</td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'basico' && 'bg-vylta-green-500/5')}>
                  {row.basico ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}
                </td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'premium' && 'bg-vylta-green-500/5')}>
                  {row.premium ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}
                </td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'luxury' && 'bg-vylta-amber-500/5')}>
                  {row.luxury ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  iconColor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary/60">
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function PlanUpgradeCard({
  tier,
  emoji,
  name,
  price,
  period,
  tagline,
  features,
  ctaUrl,
  ctaColor,
  recommended,
}: {
  tier: string;
  emoji: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  ctaUrl: string;
  ctaColor: string;
  recommended?: boolean;
}) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm',
      recommended ? 'border-indigo-500/40' : 'border-border',
    )}>
      {recommended && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-indigo-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          ⭐ Recomendado
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold">{name}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{tagline}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums">{price}</span>
            <span className="text-xs text-muted-foreground">{period}</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Check className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', recommended ? 'text-indigo-500' : 'text-vylta-green-500')} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg',
          ctaColor,
        )}
      >
        <Sparkles className="h-4 w-4" />
        Activar Plan {name}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
