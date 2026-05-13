'use client';

import Link from 'next/link';
import {
  Building2,
  CreditCard,
  MessageCircle,
  Link2,
  Sparkles,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BusinessTab } from './tabs/business-tab';
import { PlanTab } from './tabs/plan-tab';
import { BookingLinkTab } from './tabs/booking-link-tab';
import { OverlapsTab } from './tabs/overlaps-tab';
import { WhatsAppTab } from './tabs/whatsapp-tab';
import { AccountTab } from './tabs/account-tab';
import { hasPremiumAccess, hasLuxuryAccess, getPlanTier } from '@/lib/plan-labels';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// Configuración shell premium — dark VYLTA
//
// Cambios:
//   • Header tipo hero como dashboard, con icono brand y tagline corto
//   • Tabs con underline verde animado (estilo Linear / Vercel)
//   • SettingsCard refinado con halo sutil en el icon
// ══════════════════════════════════════════════════════════════════════

interface ConfigShellProps {
  user: { id: string; email: string };
  profile: any | null;
  plan: any | null;
  bookingLink: { is_active?: boolean | null; slug?: string | null } | null;
}

export function ConfiguracionShell({ user, profile, plan, bookingLink }: ConfigShellProps) {
  const planTier = getPlanTier(plan?.plan_type);
  const isPremiumOrAbove = hasPremiumAccess(plan?.plan_type);
  const isLuxury = hasLuxuryAccess(plan?.plan_type);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
          <SettingsIcon className="h-5 w-5 text-vylta-green" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">
            Configuración
          </h1>
          <p className="text-sm text-vylta-muted">
            Administra tu negocio, suscripción y preferencias.
          </p>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs defaultValue="negocio" className="space-y-6">
        <div className="relative border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
            <ConfigTab value="negocio" icon={Building2} label="Negocio" />
            <ConfigTab value="plan" icon={CreditCard} label="Plan" />
            <ConfigTab value="link" icon={Link2} label="Link público" />
            <ConfigTab value="overlaps" icon={Sparkles} label="Avanzado" />
            <ConfigTab value="whatsapp" icon={MessageCircle} label="WhatsApp" />
            <ConfigTab value="cuenta" icon={Shield} label="Cuenta" />
          </TabsList>
        </div>

        <TabsContent value="negocio" className="focus-visible:outline-none">
          <BusinessTab userId={user.id} profile={profile} />
        </TabsContent>
        <TabsContent value="plan" className="focus-visible:outline-none">
          <PlanTab userId={user.id} plan={plan} />
        </TabsContent>
        <TabsContent value="link" className="focus-visible:outline-none">
          <BookingLinkTab userId={user.id} bookingLink={bookingLink} isPremium={isPremiumOrAbove} />
        </TabsContent>
        <TabsContent value="overlaps" className="focus-visible:outline-none">
          <OverlapsTab userId={user.id} profile={profile} isLuxury={isLuxury} />
        </TabsContent>
        <TabsContent value="whatsapp" className="focus-visible:outline-none">
          <WhatsAppTab planTier={planTier} />
        </TabsContent>
        <TabsContent value="cuenta" className="focus-visible:outline-none">
          <AccountTab email={user.email} userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tab con underline verde animado al estilo Linear/Vercel ──
function ConfigTab({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: any;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        // Reset shadcn defaults
        'relative h-auto rounded-none border-0 bg-transparent px-3 py-2.5 text-sm font-medium shadow-none',
        // Idle
        'text-vylta-muted transition-colors hover:text-vylta-bone',
        // Active state — verde con underline animado
        'data-[state=active]:bg-transparent data-[state=active]:text-vylta-bone data-[state=active]:shadow-none',
        // Underline animado (pseudo-after)
        'after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-vylta-green',
        'after:scale-x-0 after:opacity-0 after:transition-all after:duration-300',
        'data-[state=active]:after:scale-x-100 data-[state=active]:after:opacity-100',
        'data-[state=active]:after:shadow-[0_0_8px_hsl(160_84%_39%/0.5)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}

// ── SettingsCard premium con icon ring y halo sutil ──
export function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  badge,
}: {
  icon: any;
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20 text-vylta-green">
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-vylta-muted">{description}</p>
            )}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}
