'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  BarChart3,
  Megaphone,
  UserCog,
  Settings,
  ChevronLeft,
  Bot,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VyltaLogo } from './vylta-logo';
import { usePrefetchClients } from '@/lib/queries/use-clients';
import { usePrefetchServices } from '@/lib/queries/use-services';
import { useMobileNav } from './mobile-nav-context';

// ══════════════════════════════════════════════════════════════════════
// Sidebar premium + Optimistic UI + Prefetching predictivo
//
// ⚡ BRANDING DEL CLIENTE (May 19 2026):
//   Header del sidebar ahora muestra logo + nombre del NEGOCIO del
//   cliente (no la marca VYLTA). La marca VYLTA queda en un footer
//   discreto al final del sidebar ("Powered by VYLTA"). Esto hace que
//   el sistema se sienta como propio del negocio del cliente.
//
// FALLBACK SI NO HAY LOGO:
//   Círculo con iniciales del nombre del negocio en verde VYLTA.
//   Ejemplo: "Salón Karen" → "SK"
//
// NUEVO EN OPCIÓN 3:
//   • onMouseEnter en items → precarga los datos antes del click
//     Esto significa que para cuando el usuario hace click, los datos
//     ya están en cache y la navegación se siente instantánea.
//
// ⚡ RESPONSIVE / MÓVIL (Jun 2026):
//   En móvil el sidebar es un CAJÓN (drawer) fijo y deslizable, con
//   backdrop oscuro detrás; se abre con la hamburguesa del Topbar y se
//   cierra al tocar fuera o al navegar. En lg+ vuelve a ser estático y
//   colapsable, idéntico a antes. El estado abierto/cerrado vive en
//   MobileNavContext (compartido con el Topbar).
// ══════════════════════════════════════════════════════════════════════

type BadgeKind = 'luxury' | 'premium';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: BadgeKind;
  /** Si está definido, se llama al hacer hover para precargar datos. */
  prefetchKey?: 'clients' | 'services';
};

const NAV_PRIMARY: NavItem[] = [
  { href: '/dashboard',  label: 'Inicio',      icon: LayoutDashboard },
  { href: '/citas',      label: 'Citas',       icon: Calendar },
  { href: '/clientes',   label: 'Clientes',    icon: Users,     prefetchKey: 'clients' },
  { href: '/servicios',  label: 'Servicios',   icon: Briefcase, prefetchKey: 'services' },
  { href: '/reportes',   label: 'Reportes',    icon: BarChart3 },
];

const NAV_PREMIUM: NavItem[] = [
  { href: '/marketing',  label: 'Marketing',   icon: Megaphone, badge: 'luxury' },
  { href: '/equipo',     label: 'Equipo',      icon: UserCog,   badge: 'luxury' },
  { href: '/chat-ia',    label: 'Chat IA',     icon: Bot,       badge: 'premium' },
];

const NAV_BOTTOM: NavItem[] = [
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

interface SidebarProps {
  /** Nombre del negocio del cliente (null si aún no completó setup). */
  businessName?: string | null;
  /** URL del logo subido por el cliente (null si no tiene logo). */
  logoUrl?: string | null;
}

export function Sidebar({ businessName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  // Prefetch helpers (aún no se invocan hasta el hover)
  const prefetchClients = usePrefetchClients();
  const prefetchServices = usePrefetchServices();

  if (optimisticHref && pathname.startsWith(optimisticHref) && !isPending) {
    queueMicrotask(() => setOptimisticHref(null));
  }

  function handleNavigate(href: string) {
    // Cierra el cajón en móvil (en escritorio no tiene efecto visible).
    setOpen(false);
    if (pathname.startsWith(href)) return;
    setOptimisticHref(href);
    startTransition(() => {
      router.push(href);
    });
  }

  /** Se llama al hacer hover sobre un item: precarga datos en background. */
  function handlePrefetch(item: NavItem) {
    if (item.prefetchKey === 'clients') prefetchClients();
    else if (item.prefetchKey === 'services') prefetchServices();
  }

  return (
    <TooltipProvider delayDuration={50}>
      {/* Backdrop del cajón en móvil — tap para cerrar */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-vylta-surface',
          'transition-transform duration-300 ease-out',
          'lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:shrink-0 lg:transition-[width]',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
        )}
      >
        {/* HEADER: Branding del NEGOCIO DEL CLIENTE (logo + nombre) */}
        <div className="flex h-16 items-center px-4">
          <Link
            href="/dashboard"
            prefetch
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('/dashboard');
            }}
            className="flex items-center gap-2.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-vylta-green/50 focus-visible:ring-offset-2 focus-visible:ring-offset-vylta-surface rounded-lg w-full"
            aria-label={businessName ? `${businessName} — Inicio` : 'Inicio'}
          >
            <BusinessLogo
              logoUrl={logoUrl}
              businessName={businessName}
              size={collapsed ? 40 : 40}
            />
            {!collapsed && (
              <div className="flex flex-col animate-fade-in min-w-0 flex-1">
                <span className="text-sm font-bold tracking-tight leading-tight text-vylta-bone truncate">
                  {businessName || 'Mi negocio'}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-vylta-subtle mt-0.5">
                  CRM
                </span>
              </div>
            )}
          </Link>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && <SectionLabel>Operaciones</SectionLabel>}
          <ul className="space-y-0.5">
            {NAV_PRIMARY.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActiveItem(pathname, item.href, optimisticHref)}
                pending={optimisticHref === item.href && isPending}
                onNavigate={handleNavigate}
                onPrefetch={handlePrefetch}
              />
            ))}
          </ul>

          <div className="mt-5">
            {!collapsed && <SectionLabel>Crecimiento</SectionLabel>}
            <ul className="space-y-0.5">
              {NAV_PREMIUM.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={isActiveItem(pathname, item.href, optimisticHref)}
                  pending={optimisticHref === item.href && isPending}
                  onNavigate={handleNavigate}
                  onPrefetch={handlePrefetch}
                />
              ))}
            </ul>
          </div>
        </nav>

        <div className="border-t border-border">
          <ul className="space-y-0.5 p-3">
            {NAV_BOTTOM.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActiveItem(pathname, item.href, optimisticHref)}
                pending={optimisticHref === item.href && isPending}
                onNavigate={handleNavigate}
                onPrefetch={handlePrefetch}
              />
            ))}
          </ul>

          {/* FOOTER: Branding VYLTA discreto + botón colapsar (colapsar solo en lg+) */}
          {!collapsed ? (
            <div className="px-4 pb-3 pt-1 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <a
                  href="https://vylta.lat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1.5 min-w-0 transition-opacity hover:opacity-100 opacity-60"
                  aria-label="VYLTA — Visitar sitio web"
                >
                  <VyltaLogo size={14} />
                  <span className="text-[10px] text-vylta-subtle group-hover:text-vylta-bone transition-colors truncate">
                    Powered by <span className="font-semibold">VYLTA</span>
                  </span>
                </a>
                <button
                  onClick={() => setCollapsed(true)}
                  className="hidden shrink-0 rounded-md p-1 text-vylta-subtle transition hover:bg-vylta-card hover:text-vylta-bone lg:flex"
                  aria-label="Colapsar menú"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="mx-auto mb-3 mt-1 flex h-7 w-7 items-center justify-center rounded-md text-vylta-subtle transition hover:bg-vylta-card hover:text-vylta-bone"
              aria-label="Expandir menú"
            >
              <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BusinessLogo — Renderiza el logo del NEGOCIO DEL CLIENTE.
//
// Si hay logoUrl: muestra la imagen (Next/Image con optimización).
// Si NO hay logoUrl: muestra un círculo con las iniciales del negocio
// en color VYLTA, similar al avatar fallback de la app.
//
// ⚡ NOTA (May 19 2026): el dominio nhjmwmkaduiaifgztymi.supabase.co YA
// está configurado en next.config.mjs (images.remotePatterns), así que
// Next.js puede optimizar la imagen automáticamente. NO usar
// unoptimized=true (mantiene calidad y reduce ancho de banda).
// ══════════════════════════════════════════════════════════════════════
function BusinessLogo({
  logoUrl,
  businessName,
  size,
}: {
  logoUrl?: string | null;
  businessName?: string | null;
  size: number;
}) {
  if (logoUrl) {
    return (
      <div
        className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-vylta-green/20 bg-vylta-card"
        style={{ width: size, height: size }}
      >
        <Image
          src={logoUrl}
          alt={businessName || 'Logo del negocio'}
          width={size * 2}
          height={size * 2}
          className="h-full w-full object-cover"
          sizes="40px"
        />
      </div>
    );
  }

  // Fallback: círculo con iniciales del negocio en verde VYLTA
  const initials = getBusinessInitials(businessName);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-vylta-green/15 ring-1 ring-vylta-green/30 text-vylta-green font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// Helper: extrae iniciales del nombre del negocio (máx 2 letras).
// Ejemplos:
//   "Salón Karen"        → "SK"
//   "Cris Barber"        → "CB"
//   "Bella"              → "BE"
//   "Beauty Studio"      → "BS"
//   "Mi negocio"         → "MN"
//   null                 → "V" (fallback VYLTA)
function getBusinessInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'V';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function isActiveItem(pathname: string, href: string, optimisticHref: string | null): boolean {
  if (optimisticHref === href) return true;
  if (optimisticHref && optimisticHref !== href) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-vylta-subtle">
        {children}
      </span>
    </div>
  );
}

function Badge({ kind, className }: { kind: BadgeKind; className?: string }) {
  if (kind === 'luxury') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
          'bg-vylta-luxury/10 text-vylta-luxury border border-vylta-luxury/20',
          className,
        )}
      >
        <Sparkles className="h-2.5 w-2.5" />
        Luxury
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
        'bg-vylta-green/10 text-vylta-green border border-vylta-green/20',
        className,
      )}
    >
      Premium
    </span>
  );
}

function SidebarItem({
  item,
  collapsed,
  active,
  pending,
  onNavigate,
  onPrefetch,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  onPrefetch: (item: NavItem) => void;
}) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      prefetch
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item.href);
      }}
      onMouseEnter={() => onPrefetch(item)}
      onFocus={() => onPrefetch(item)}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-vylta-green/10 text-vylta-bone shadow-[inset_0_1px_0_hsl(160_84%_39%/0.15)]'
          : 'text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-vylta-green',
            'shadow-[0_0_8px_hsl(160_84%_39%/0.6)]',
            pending && 'animate-pulse',
          )}
        />
      )}

      {pending ? (
        <Loader2
          className="h-[18px] w-[18px] shrink-0 animate-spin text-vylta-green"
          strokeWidth={2.5}
        />
      ) : (
        <Icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors',
            active ? 'text-vylta-green' : 'text-vylta-subtle group-hover:text-vylta-bone',
          )}
          strokeWidth={active ? 2.25 : 2}
        />
      )}

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && <Badge kind={item.badge} />}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={12}
            className="flex items-center gap-2 bg-vylta-card border-border"
          >
            <span className="text-vylta-bone">{item.label}</span>
            {item.badge && <Badge kind={item.badge} />}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{linkContent}</li>;
}
