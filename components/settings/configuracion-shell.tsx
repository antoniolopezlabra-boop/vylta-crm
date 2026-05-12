'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CreditCard,
  Link2,
  Cake,
  MessageCircle,
  Shield,
  Bell,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BusinessTab } from './tabs/business-tab';
import { PlanTab } from './tabs/plan-tab';
import { BookingLinkTab } from './tabs/booking-link-tab';
import { OverlapsTab } from './tabs/overlaps-tab';
import { WhatsAppTab } from './tabs/whatsapp-tab';
import { AccountTab } from './tabs/account-tab';
import { cn } from '@/lib/utils';

interface ConfigShellProps {
  user: { id: string; email: string };
  profile: any | null;
  plan: { plan_type?: string | null; status?: string | null; price?: number | null; current_period_end?: string | null } | null;
  bookingLink: { is_active?: boolean | null; slug?: string | null } | null;
}

export function ConfiguracionShell({ user, profile, plan, bookingLink }: ConfigShellProps) {
  const planTier = (plan?.plan_type || 'gratuito').toLowerCase();
  const isPremium = planTier === 'basico' || planTier === 'premium';
  const isLuxury = planTier === 'premium';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra tu negocio, suscripción y preferencias.
        </p>
      </div>

      <Tabs defaultValue="negocio" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="negocio">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Negocio</span>
          </TabsTrigger>
          <TabsTrigger value="plan">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Plan</span>
          </TabsTrigger>
          <TabsTrigger value="link">
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Link público</span>
          </TabsTrigger>
          <TabsTrigger value="overlaps">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Avanzado</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="cuenta">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cuenta</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="negocio">
          <BusinessTab userId={user.id} profile={profile} />
        </TabsContent>
        <TabsContent value="plan">
          <PlanTab plan={plan} />
        </TabsContent>
        <TabsContent value="link">
          <BookingLinkTab userId={user.id} bookingLink={bookingLink} isPremium={isPremium} />
        </TabsContent>
        <TabsContent value="overlaps">
          <OverlapsTab userId={user.id} profile={profile} isLuxury={isLuxury} />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTab planTier={planTier} />
        </TabsContent>
        <TabsContent value="cuenta">
          <AccountTab email={user.email} userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-vylta-green-600 dark:text-vylta-green-400">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}
