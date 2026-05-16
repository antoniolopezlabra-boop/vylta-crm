'use client';

import { useEffect, useState } from 'react';
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
  Crown,
  Diamond,
  MessageCircle,
  Award,
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
  getPlanTier,
  isVipTier,
} from '@/lib/plan-labels';

// ══════════════════════════════════════════════════════════════════════
// PlanTab — Plan actual + activación via Stripe + Customer Portal.
// Brand Kit VYLTA v1.0: morado #A78BFA para Luxury (NO indigo).
// Branding VIP (May 2026): negro #0A0A0A + dorado #D4AF37.
//
// Mismo flow que app móvil:
//   • Payment Links live para activar Premium / Luxury / VIP Premium / VIP Luxury
//   • Edge Function 'create-portal-session' (body: user_id snake_case)
//   • Detalles desde subscription_plans (created_at, updated_at, status, billing_cycle, is_vip, vip_expires_at)
//
// Narrativa pública del equipo directivo (May 16 2026):
//   ✅ "El CEO" / "El equipo directivo de VYLTA"
//   ❌ NO usar nombres propios ("Antonio López")
//   ❌ NO usar "Director de Operaciones" / "desarrollador"
//   Mantiene consistencia con landing vylta.lat + prompt IA + app móvil.
// ══════════════════════════════════════════════════════════════════════

const STRIPE_LINKS = {
  premium:     'https://buy.stripe.com/7sY5kF5Ym9hm7mw5g938400',
  luxury:      'https://buy.stripe.com/8x228t72q65a9uE23X38402',
  vip_premium: 'https://buy.stripe.com/8x2fZjaeCeBGayI7oh38403', // VIP Premium $4,390/año
  vip_luxury:  'https://buy.stripe.com/14A7sN5YmgJOdKU23X38404', // VIP Luxury  $8,790/año
};

// ═══════ Paleta VIP (negro + dorado) ═══════
const VIP_GOLD = '#D4AF37';
const VIP_GOLD_SOFT = '#E8C76C';
const VIP_BLACK = '#0A0A0A';

// ═══════ Lista oficial de beneficios VIP (fuente de verdad: vylta-docs/pricing/PLANS.md) ═══════
// IMPORTANTE: Esta lista debe ser idéntica en 4 lugares:
//   1. app/settings/subscription.tsx (app móvil)
//   2. components/settings/tabs/plan-tab.tsx (este archivo)
//   3. vylta-web/index.html (landing pública)
//   4. supabase/functions/ai-chat/index.ts (prompt IA)
// Si se cambia, actualizar los 4.
const VIP_BENEFITS = [
  'Comunicación directa con el CEO por WhatsApp',
  'Capacitación 1-a-1 sobre el uso de la herramienta',
  'Sesiones estratégicas de crecimiento para tu negocio',
  'Configuración inicial asistida (servicios, horarios, plantillas)',
  'Capacitación personalizada para tu equipo',
  'Capacitación para 1 colaborador adicional sin costo',
  'Acceso anticipado a nuevas funciones',
  '1 mes GRATIS al pagar la anualidad completa',
];

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
    // ─── Campos VIP (May 2026) ───
    billing_cycle?: string | null;
    is_vip?: boolean | null;
    vip_expires_at?: string | null;
    onboarding_call_scheduled_at?: string | null;
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

// ── Mapping de plan tier a estética visual ──
function getTierVisual(tier: 'basico' | 'premium' | 'luxury' | 'vip_premium' | 'vip_luxury') {
  switch (tier) {
    case 'vip_luxury':
    case 'vip_premium':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        ring: 'ring-amber-500/30',
        border: 'border-amber-500/40',
        badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
        cellBg: 'bg-amber-500/5',
        headerBg: 'bg-amber-500/10 text-amber-500',
      };
    case 'luxury':
      return {
        text: 'text-vylta-luxury',
        bg: 'bg-vylta-luxury/10',
        ring: 'ring-vylta-luxury/20',
        border: 'border-vylta-luxury/30',
        badge: 'bg-vylta-luxury/15 text-vylta-luxury border-vylta-luxury/20',
        cellBg: 'bg-vylta-luxury/5',
        headerBg: 'bg-vylta-luxury/10 text-vylta-luxury',
      };
    case 'premium':
      return {
        text: 'text-vylta-green',
        bg: 'bg-vylta-green/10',
        ring: 'ring-vylta-green/20',
        border: 'border-vylta-green/30',
        badge: 'bg-vylta-green/15 text-vylta-green border-vylta-green/20',
        cellBg: 'bg-vylta-green/5',
        headerBg: 'bg-vylta-green/10 text-vylta-green',
      };
    default:
      return {
        text: 'text-vylta-muted',
        bg: 'bg-vylta-card',
        ring: 'ring-border',
        border: 'border-border',
        badge: 'bg-vylta-card text-vylta-muted border-border',
        cellBg: 'bg-vylta-card/40',
        headerBg: 'bg-vylta-card/60 text-vylta-bone',
      };
  }
}

export function PlanTab({ userId, plan }: PlanTabProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [businessName, setBusinessName] = useState<string>('');

  const rawPlanType = plan?.plan_type;
  const tier = getPlanTier(rawPlanType);
  const planName = getPlanDisplayName(rawPlanType);
  const planBadge = getPlanBadgeLabel(rawPlanType);
  const planPrice = getPlanPrice(rawPlanType);
  const planDescription = getPlanDescription(rawPlanType);
  const isActive = (plan?.status || '').toLowerCase() === 'active';
  const isVip = isVipTier(rawPlanType) || !!plan?.is_vip;
  const isAnnual = plan?.billing_cycle === 'annual';
  const hasPaidPlan = tier === 'premium' || tier === 'luxury' || isVip;
  const visual = getTierVisual(tier);

  // Cargar business_name del usuario para el mensaje WhatsApp pre-llenado
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.business_name) setBusinessName(data.business_name);
    })();
  }, [userId]);

  function buildPaymentUrl(target: 'premium' | 'luxury' | 'vip_premium' | 'vip_luxury'): string {
    const baseUrl = STRIPE_LINKS[target];
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}client_reference_id=${userId}`;
  }

  // Abre WhatsApp con el equipo directivo de VYLTA (número exclusivo VIP).
  // El número +52 1 56 3433 0814 NO se publica en landing pública; solo aquí
  // dentro del flujo post-compra para clientes que ya activaron un plan VIP.
  function openVipTeamWhatsApp() {
    const businessLabel = businessName?.trim() || '[mi negocio]';
    const message = `Hola, soy ${businessLabel} cliente VIP de VYLTA.`;
    const url = `https://wa.me/525634330814?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function openCustomerPortal() {
    setPortalLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No se recibió URL del portal');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[PlanTab] Error abriendo portal:', err);
      toast.error('No pudimos abrir el portal: ' + (err.message || 'Error desconocido'));
    } finally {
      setPortalLoading(false);
    }
  }

  // Próximo cobro: anual (1 año) vs mensual (30 días)
  const nextBilling = (() => {
    if (!plan?.updated_at) return null;
    const d = new Date(plan.updated_at);
    if (isAnnual) {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setDate(d.getDate() + 30);
    }
    return d;
  })();
  const isNextBillingSoon = nextBilling && (nextBilling.getTime() - Date.now()) < 5 * 24 * 60 * 60 * 1000;

  // Días hasta expiración VIP
  const daysUntilVipExpiry = plan?.vip_expires_at
    ? Math.max(0, Math.ceil((new Date(plan.vip_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-4">
      {/* ══════════ PLAN ACTUAL ══════════ */}
      <SettingsCard
        icon={CreditCard}
        title="Tu plan actual"
        description="Administra tu suscripción de VYLTA."
      >
        {/* Card del plan con halo del tier */}
        <div className={cn(
          'relative overflow-hidden rounded-xl border p-5',
          visual.border,
          isVip ? 'bg-amber-500/[0.05]' : tier === 'luxury' ? 'bg-vylta-luxury/[0.04]' : tier === 'premium' ? 'bg-vylta-green/[0.04]' : 'bg-vylta-card/40',
        )}>
          {/* Halo decorativo del color del tier */}
          {tier !== 'basico' && (
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-30"
              style={{ background: isVip ? VIP_GOLD : tier === 'luxury' ? '#A78BFA' : '#10B981' }}
            />
          )}

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-vylta-bone">Plan {planName}</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  visual.badge,
                )}>
                  {isVip && <Diamond className="h-2.5 w-2.5" />}
                  {!isVip && tier === 'luxury' && <Sparkles className="h-2.5 w-2.5" />}
                  {planBadge}
                </span>
                {isActive && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-vylta-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-green">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Activo
                  </span>
                )}
                {isAnnual && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Anual
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-vylta-muted">{planDescription}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className={cn('text-3xl font-bold tabular-nums tracking-tightest', visual.text)}>
                {planPrice}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ PANEL EXCLUSIVO VIP — contacto directo con el equipo directivo ══════════ */}
        {isVip && (
          <div
            className="mt-4 overflow-hidden rounded-xl border p-5"
            style={{ background: VIP_BLACK, borderColor: VIP_GOLD }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4" style={{ color: VIP_GOLD }} />
              <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: VIP_GOLD }}>
                Tu contacto directo
              </span>
            </div>
            <p className="text-sm text-white mb-3">
              El <strong style={{ color: VIP_GOLD }}>equipo directivo</strong> de VYLTA está disponible para ti por WhatsApp.
            </p>
            <button
              onClick={openVipTeamWhatsApp}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition hover:opacity-90"
              style={{ borderColor: VIP_GOLD, color: VIP_GOLD, background: '#1A1A1A' }}
            >
              <MessageCircle className="h-4 w-4" />
              Contactar al equipo directivo
              <ExternalLink className="h-3 w-3" />
            </button>
            {daysUntilVipExpiry !== null && (
              <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: VIP_GOLD_SOFT }}>
                <Calendar className="h-3.5 w-3.5" />
                Tu plan VIP se renueva en {daysUntilVipExpiry} días
              </div>
            )}
          </div>
        )}

        {/* Detalles de suscripción */}
        {hasPaidPlan && (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-vylta-card/40 p-4">
            <DetailRow
              icon={Calendar}
              label="Suscrito desde"
              value={<span className="text-vylta-bone">{formatDate(plan?.created_at)}</span>}
              iconClass="text-vylta-sky bg-vylta-sky/10 ring-vylta-sky/20"
            />
            <DetailRow
              icon={Zap}
              label={isAnnual ? 'Renovación anual' : 'Próximo cobro'}
              value={
                <span className={cn(
                  isNextBillingSoon ? 'text-vylta-amber font-bold' : 'text-vylta-bone',
                )}>
                  {nextBilling ? formatDate(nextBilling.toISOString()) : '—'}
                  {isNextBillingSoon && ' · pronto'}
                </span>
              }
              iconClass={
                isNextBillingSoon
                  ? 'text-vylta-amber bg-vylta-amber/10 ring-vylta-amber/20'
                  : 'text-vylta-green bg-vylta-green/10 ring-vylta-green/20'
              }
            />
            <DetailRow
              icon={Shield}
              label="Estado"
              value={
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                  isActive
                    ? 'bg-vylta-green/15 text-vylta-green'
                    : 'bg-vylta-amber/15 text-vylta-amber',
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isActive ? 'bg-vylta-green' : 'bg-vylta-amber',
                  )} />
                  {isActive ? 'Activa' : (plan?.status || 'Desconocido')}
                </span>
              }
              iconClass="text-vylta-green bg-vylta-green/10 ring-vylta-green/20"
            />
            <DetailRow
              icon={CreditCard}
              label="Método de pago"
              value={<span className="text-vylta-bone">Administrado por Stripe</span>}
              iconClass="text-vylta-luxury bg-vylta-luxury/10 ring-vylta-luxury/20"
            />
          </div>
        )}

        {/* Botón Customer Portal */}
        {hasPaidPlan && (
          <div className="mt-4 space-y-2">
            <Button
              onClick={openCustomerPortal}
              disabled={portalLoading}
              variant="outline"
              className="w-full h-10 border-vylta-luxury/30 bg-vylta-luxury/5 text-vylta-luxury hover:bg-vylta-luxury/10 hover:text-vylta-luxury-light hover:border-vylta-luxury/50"
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
            <p className="text-center text-[11px] text-vylta-muted">
              Cambiar método de pago, ver facturas o cancelar tu suscripción
            </p>
          </div>
        )}

        {/* Banner upgrade — Básico */}
        {tier === 'basico' && (
          <div className="mt-4 rounded-xl border border-vylta-green/30 bg-vylta-green/5 p-3.5">
            <p className="text-xs leading-relaxed text-vylta-green-light">
              💡 <strong className="text-vylta-green">Tu Plan Básico permite hasta 10 citas al mes</strong> (app + link público combinadas).
              Actualiza al Plan Premium para citas ilimitadas, recordatorios WhatsApp y reportes.
            </p>
          </div>
        )}

        {/* Banner upgrade — Premium */}
        {tier === 'premium' && (
          <div className="mt-4 rounded-xl border border-vylta-luxury/30 bg-vylta-luxury/5 p-3.5">
            <p className="text-xs leading-relaxed text-vylta-luxury-light">
              ⭐ Mejora al <strong className="text-vylta-luxury">Plan Luxury</strong> para activar tu equipo de hasta 5 colaboradores,
              email marketing, citas simultáneas y reportes avanzados.
            </p>
          </div>
        )}
      </SettingsCard>

      {/* ══════════ TARJETAS DE UPGRADE — Planes mensuales ══════════ */}
      {!isVip && tier !== 'luxury' && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">
            Activar un plan mensual
          </h3>

          {tier === 'basico' && (
            <PlanUpgradeCard
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
              accent="green"
            />
          )}

          <PlanUpgradeCard
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
            accent="luxury"
            recommended
          />

          <div className="flex items-start gap-2 rounded-xl border border-border bg-vylta-card/40 p-3.5">
            <Lock className="h-3.5 w-3.5 shrink-0 text-vylta-muted mt-0.5" />
            <p className="text-[11px] text-vylta-muted leading-relaxed">
              Pago seguro procesado por <strong className="text-vylta-bone">Stripe</strong>. Puedes cancelar en cualquier momento desde
              "Gestionar suscripción". Sin contratos ni penalidades.
            </p>
          </div>
        </div>
      )}

      {/* ══════════ TARJETAS VIP ANUALES (negro + dorado) ══════════ */}
      {!isVip && (
        <div className="space-y-4 mt-6">
          {/* Divisor visual */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-amber-500/40" />
            <div className="flex items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">
              <Diamond className="h-3 w-3" />
              Planes VIP · Anuales
              <Diamond className="h-3 w-3" />
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-500/40 to-amber-500/40" />
          </div>

          {/* Card con los 8 beneficios VIP */}
          <div
            className="overflow-hidden rounded-xl border p-5"
            style={{ background: VIP_BLACK, borderColor: VIP_GOLD }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4" style={{ color: VIP_GOLD }} />
              <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: VIP_GOLD }}>
                Beneficios exclusivos VIP
              </span>
            </div>
            <ul className="space-y-2">
              {VIP_BENEFITS.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white leading-relaxed">
                  <Sparkles className="h-3 w-3 shrink-0 mt-0.5" style={{ color: VIP_GOLD }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cards VIP — Premium + Luxury */}
          <VipPlanCard
            name="VIP Premium"
            icon={<Diamond className="h-5 w-5" />}
            price="$4,390"
            period="MXN / año"
            equiv="Equivalente a $399 × 11 meses (1 mes gratis)"
            badge="AHORRAS 1 MES"
            includesBaseLabel="Todo lo del Plan Premium"
            ctaUrl={buildPaymentUrl('vip_premium')}
          />

          <VipPlanCard
            name="VIP Luxury"
            icon={<Crown className="h-5 w-5" />}
            price="$8,790"
            period="MXN / año"
            equiv="Equivalente a $799 × 11 meses (1 mes gratis)"
            badge="EXCLUSIVO"
            includesBaseLabel="Todo lo del Plan Luxury (5 colaboradores, etc.)"
            ctaUrl={buildPaymentUrl('vip_luxury')}
            recommended
          />

          <div
            className="flex items-start gap-2 rounded-xl border p-3.5"
            style={{ background: '#1A1A1A', borderColor: 'rgba(212,175,55,0.3)' }}
          >
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: VIP_GOLD_SOFT }} />
            <p className="text-[11px] leading-relaxed" style={{ color: VIP_GOLD_SOFT }}>
              Pago anual seguro procesado por <strong style={{ color: VIP_GOLD }}>Stripe</strong>. Renovación automática. Puedes cancelar
              la renovación en cualquier momento desde "Gestionar suscripción" sin perder los beneficios del año en curso.
            </p>
          </div>
        </div>
      )}

      {/* ══════════ TABLA COMPARATIVA ══════════ */}
      <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        <div className="border-b border-border bg-vylta-card/40 px-5 py-3">
          <h3 className="text-sm font-bold text-vylta-bone">Compara los planes mensuales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-vylta-card/30 text-[10px] uppercase tracking-[0.15em] text-vylta-muted">
                <th className="px-4 py-2.5 text-left font-bold">Función</th>
                <th className={cn('px-3 py-2.5 text-center font-bold', tier === 'basico' && getTierVisual('basico').headerBg)}>
                  Básico
                </th>
                <th className={cn('px-3 py-2.5 text-center font-bold', tier === 'premium' && getTierVisual('premium').headerBg)}>
                  Premium
                </th>
                <th className={cn('px-3 py-2.5 text-center font-bold', tier === 'luxury' && getTierVisual('luxury').headerBg)}>
                  Luxury
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0 hover:bg-vylta-card/20">
                  <td className="px-4 py-2.5 text-xs text-vylta-bone">{row.feature}</td>
                  <td className={cn('px-3 py-2.5 text-center', tier === 'basico' && getTierVisual('basico').cellBg)}>
                    {row.basico
                      ? <Check className="mx-auto h-4 w-4 text-vylta-green" strokeWidth={2.5} />
                      : <X className="mx-auto h-3.5 w-3.5 text-vylta-subtle/50" />}
                  </td>
                  <td className={cn('px-3 py-2.5 text-center', tier === 'premium' && getTierVisual('premium').cellBg)}>
                    {row.premium
                      ? <Check className="mx-auto h-4 w-4 text-vylta-green" strokeWidth={2.5} />
                      : <X className="mx-auto h-3.5 w-3.5 text-vylta-subtle/50" />}
                  </td>
                  <td className={cn('px-3 py-2.5 text-center', tier === 'luxury' && getTierVisual('luxury').cellBg)}>
                    {row.luxury
                      ? <Check className="mx-auto h-4 w-4 text-vylta-luxury" strokeWidth={2.5} />
                      : <X className="mx-auto h-3.5 w-3.5 text-vylta-subtle/50" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Componentes internos
// ══════════════════════════════════════════════════════════════════════

function DetailRow({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', iconClass)}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function PlanUpgradeCard({
  emoji,
  name,
  price,
  period,
  tagline,
  features,
  ctaUrl,
  accent,
  recommended,
}: {
  emoji: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  ctaUrl: string;
  accent: 'green' | 'luxury';
  recommended?: boolean;
}) {
  const accentMap = {
    green: {
      border: 'border-vylta-green/30',
      borderHover: 'hover:border-vylta-green/50',
      text: 'text-vylta-green',
      check: 'text-vylta-green',
      cta: 'bg-vylta-green hover:bg-vylta-green-light',
      haloHex: '#10B981',
      glow: 'glow-primary',
    },
    luxury: {
      border: 'border-vylta-luxury/40',
      borderHover: 'hover:border-vylta-luxury/60',
      text: 'text-vylta-luxury',
      check: 'text-vylta-luxury',
      cta: 'bg-vylta-luxury hover:bg-vylta-luxury-light',
      haloHex: '#A78BFA',
      glow: 'glow-luxury',
    },
  }[accent];

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-xl border bg-vylta-surface p-5 shadow-card transition-all hover:-translate-y-0.5',
      accentMap.border,
      accentMap.borderHover,
      recommended && accentMap.glow,
    )}>
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40"
        style={{ background: accentMap.haloHex }}
      />

      {recommended && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-vylta-luxury px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
          ⭐ Recomendado
        </div>
      )}

      <div className="relative flex items-start gap-3">
        <div className="text-3xl leading-none mt-1">{emoji}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold tracking-tightest text-vylta-bone">{name}</h3>
          <p className="mt-0.5 text-xs text-vylta-muted">{tagline}</p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className={cn('text-3xl font-bold tabular-nums tracking-tightest', accentMap.text)}>
              {price}
            </span>
            <span className="text-xs text-vylta-muted">{period}</span>
          </div>
        </div>
      </div>

      <ul className="relative mt-4 space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-vylta-bone">
            <Check className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', accentMap.check)} strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-card transition hover:shadow-card-lg',
          accentMap.cta,
        )}
      >
        <Sparkles className="h-4 w-4" />
        Activar Plan {name}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// VipPlanCard — Tarjeta exclusiva VIP (negro + dorado premium)
// ══════════════════════════════════════════════════════════════════════
function VipPlanCard({
  name,
  icon,
  price,
  period,
  equiv,
  badge,
  includesBaseLabel,
  ctaUrl,
  recommended,
}: {
  name: string;
  icon: React.ReactNode;
  price: string;
  period: string;
  equiv: string;
  badge: string;
  includesBaseLabel: string;
  ctaUrl: string;
  recommended?: boolean;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border-2 p-5 transition-all hover:-translate-y-0.5"
      style={{
        background: VIP_BLACK,
        borderColor: recommended ? VIP_GOLD : 'rgba(212,175,55,0.6)',
        boxShadow: recommended ? `0 0 30px rgba(212,175,55,0.2)` : `0 0 20px rgba(212,175,55,0.1)`,
      }}
    >
      {/* Halo dorado */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-25 transition-opacity group-hover:opacity-50"
        style={{ background: VIP_GOLD }}
      />

      {/* Badge */}
      <div
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
        style={{
          background: recommended ? VIP_GOLD : 'rgba(212,175,55,0.15)',
          color: recommended ? VIP_BLACK : VIP_GOLD,
          border: recommended ? 'none' : `1px solid ${VIP_GOLD}`,
        }}
      >
        <Diamond className="h-2.5 w-2.5" />
        {badge}
      </div>

      <div className="relative flex items-start gap-3">
        <div style={{ color: VIP_GOLD }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold tracking-tightest" style={{ color: VIP_GOLD }}>{name}</h3>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums tracking-tightest text-white">
              {price}
            </span>
            <span className="text-xs" style={{ color: VIP_GOLD_SOFT }}>{period}</span>
          </div>
          <p className="mt-1 text-[11px] italic" style={{ color: VIP_GOLD_SOFT }}>{equiv}</p>
        </div>
      </div>

      <ul className="relative mt-4 space-y-1.5">
        <li className="flex items-start gap-2 text-xs text-white">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: VIP_GOLD }} strokeWidth={2.5} />
          <span>{includesBaseLabel}</span>
        </li>
        <li className="flex items-start gap-2 text-xs text-white">
          <Award className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: VIP_GOLD }} strokeWidth={2.5} />
          <span>+ los 8 beneficios VIP exclusivos arriba</span>
        </li>
      </ul>

      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition hover:opacity-90"
        style={{ background: VIP_GOLD, color: VIP_BLACK }}
      >
        <Crown className="h-4 w-4" />
        Activar Plan {name}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
