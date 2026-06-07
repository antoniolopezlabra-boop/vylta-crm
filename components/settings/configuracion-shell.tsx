'use client';

import { useState } from 'react';
import {
  Building2,
  CreditCard,
  Link2,
  Sparkles,
  Shield,
  Settings as SettingsIcon,
  Coffee,
  Clock,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { BusinessTab } from './tabs/business-tab';
import { PlanTab } from './tabs/plan-tab';
import { BookingLinkTab } from './tabs/booking-link-tab';
import { OverlapsTab } from './tabs/overlaps-tab';
import { BlocksTab } from './tabs/blocks-tab';
import { AccountTab } from './tabs/account-tab';
import { HoursTab } from './tabs/hours-tab';
import { BookingBlocksCard } from './tabs/booking-blocks-card';
import { hasPremiumAccess, hasLuxuryAccess } from '@/lib/plan-labels';
import { cn } from '@/lib/utils';

// ═════════════════════════════════════════════════════════════════════
// Shell de Configuración — REDISEÑO UI (Jun 2026)
//
// Antes: 7 pestañas diminutas (solo icono en móvil) que no comunicaban
// qué contenían ni parecían navegables.
//
// Ahora: navegación tipo "ajustes premium":
//   • ESCRITORIO (lg+): rail vertical a la izquierda (icono a color +
//     título + descripción) + panel de contenido a la derecha. Rail sticky.
//   • MÓVIL: lista de tarjetas grandes (master-detail). Tocas una sección
//     y entras; botón "← Configuración" para regresar a la lista.
//
// Los formularios internos (BusinessTab, HoursTab, etc.) NO se tocan.
//
// GATING (sin cambios): "Citas simultáneas" es Premium+ (isPremiumOrAbove)
// y "cumpleaños por email" es Luxury (isLuxury); por eso OverlapsTab recibe
// ambos flags. La pestaña WhatsApp sigue oculta (era informativa); su
// contenido se conserva en tabs/whatsapp-tab.tsx por si se restaura.
// ══════════════════════════════════════════════════════════════════════

type AccentKey = 'green' | 'sky' | 'luxury' | 'amber' | 'rose';

const ACCENT: Record<AccentKey, { icon: string; bar: string; activeBg: string }> = {
  green:  { icon: 'bg-vylta-green/10 text-vylta-green ring-vylta-green/20',     bar: 'bg-vylta-green',  activeBg: 'bg-vylta-green/[0.08]' },
  sky:    { icon: 'bg-vylta-sky/10 text-vylta-sky ring-vylta-sky/20',           bar: 'bg-vylta-sky',    activeBg: 'bg-vylta-sky/[0.08]' },
  luxury: { icon: 'bg-vylta-luxury/10 text-vylta-luxury ring-vylta-luxury/20',  bar: 'bg-vylta-luxury', activeBg: 'bg-vylta-luxury/[0.08]' },
  amber:  { icon: 'bg-vylta-amber/10 text-vylta-amber ring-vylta-amber/20',     bar: 'bg-vylta-amber',  activeBg: 'bg-vylta-amber/[0.08]' },
  rose:   { icon: 'bg-vylta-rose/10 text-vylta-rose ring-vylta-rose/20',        bar: 'bg-vylta-rose',   activeBg: 'bg-vylta-rose/[0.08]' },
};

type SectionDef = {
  id: string;
  icon: any;
  label: string;
  desc: string;
  accent: AccentKey;
};

const SECTIONS: SectionDef[] = [
  { id: 'negocio',  icon: Building2,  label: 'Información del negocio', desc: 'Nombre, contacto y logo',       accent: 'green' },
  { id: 'horarios', icon: Clock,      label: 'Horarios de atención',   desc: 'Días y horas de atención',     accent: 'sky' },
  { id: 'plan',     icon: CreditCard, label: 'Tu plan',                desc: 'Suscripción y facturación',   accent: 'luxury' },
  { id: 'link',     icon: Link2,      label: 'Link público',           desc: 'Tu página de autoagenda',     accent: 'green' },
  { id: 'bloqueos', icon: Coffee,     label: 'Bloqueos y descansos',   desc: 'Vacaciones y días libres',    accent: 'amber' },
  { id: 'overlaps', icon: Sparkles,   label: 'Opciones avanzadas',     desc: 'Citas simultáneas y más',     accent: 'luxury' },
  { id: 'cuenta',   icon: Shield,     label: 'Cuenta y seguridad',     desc: 'Contraseña y datos de acceso', accent: 'rose' },
];

interface ConfigShellProps {
  user: { id: string; email: string };
  profile: any | null;
  plan: any | null;
  bookingLink: { is_active?: boolean | null; slug?: string | null } | null;
}

export function ConfiguracionShell({ user, profile, plan, bookingLink }: ConfigShellProps) {
  const isPremiumOrAbove = hasPremiumAccess(plan?.plan_type);
  const isLuxury = hasLuxuryAccess(plan?.plan_type);

  // null = (en móvil) mostrando la lista de secciones.
  // En escritorio se usa 'negocio' por defecto para que siempre haya contenido.
  const [active, setActive] = useState<string | null>(null);
  const current = active ?? 'negocio';

  function renderSection(id: string) {
    switch (id) {
      case 'negocio':
        return <BusinessTab userId={user.id} profile={profile} />;
      case 'horarios':
        return (
          <div className="space-y-6">
            <HoursTab userId={user.id} />
            <BookingBlocksCard userId={user.id} isPremiumOrAbove={isPremiumOrAbove} />
          </div>
        );
      case 'plan':
        return <PlanTab userId={user.id} plan={plan} />;
      case 'link':
        return <BookingLinkTab userId={user.id} bookingLink={bookingLink} isPremium={isPremiumOrAbove} />;
      case 'bloqueos':
        return <BlocksTab userId={user.id} />;
      case 'overlaps':
        return <OverlapsTab userId={user.id} profile={profile} isPremiumOrAbove={isPremiumOrAbove} isLuxury={isLuxury} />;
      case 'cuenta':
        return <AccountTab email={user.email} userId={user.id} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
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

      {/* BODY: rail de navegación + contenido */}
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* NAV (escritorio) / LISTA (móvil) */}
        <nav
          className={cn(
            'lg:sticky lg:top-2 lg:self-start',
            active !== null && 'hidden lg:block',
          )}
          aria-label="Secciones de configuración"
        >
          <ul className="space-y-2 lg:space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = current === s.id;
              const a = ACCENT[s.accent];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all',
                      isActive
                        ? cn('border-transparent', a.activeBg)
                        : 'border-border bg-vylta-surface hover:bg-vylta-card lg:border-transparent lg:bg-transparent lg:hover:bg-vylta-card/70',
                    )}
                  >
                    {/* Barra de acento (visible cuando está activo) */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-200',
                        a.bar,
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
                        a.icon,
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-semibold',
                          isActive ? 'text-vylta-bone' : 'text-vylta-bone/90',
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-vylta-muted">
                        {s.desc}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-vylta-subtle transition-transform group-hover:translate-x-0.5 lg:hidden" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* CONTENIDO */}
        <div className={cn('min-w-0', active === null && 'hidden lg:block')}>
          {/* Volver a la lista (solo móvil) */}
          <button
            type="button"
            onClick={() => setActive(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-vylta-muted transition-colors hover:text-vylta-bone lg:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Configuración
          </button>

          {renderSection(current)}
        </div>
      </div>
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
