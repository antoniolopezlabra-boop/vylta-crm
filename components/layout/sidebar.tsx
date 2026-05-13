'use client';

import Link from 'next/link';
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

// ══════════════════════════════════════════════════════════════════════
// Sidebar premium + Optimistic UI + Prefetching predictivo
//
// NUEVO EN OPCIÓN 3:
//   • onMouseEnter en items → precarga los datos antes del click
//     Esto significa que para cuando el usuario hace click, los datos
//     ya están en cache y la navegación se siente instantánea.
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
    // Para futuras: reports, etc.
  }

  return (
    <TooltipProvider delayDuration={50}>
      <aside
        className={cn(
          'relative flex shrink-0 flex-col border-r border-border bg-vylta-surface transition-[width] duration-300 ease-out',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center px-4">
          <Link
            href="/dashboard"
            prefetch
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('/dashboard');
            }}
            className="flex items-center gap-2.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-vylta-green/50 focus-visible:ring-offset-2 focus-visible:ring-offset-vylta-surface rounded-lg"
            aria-label="VYLTA — Inicio"
          >
            <VyltaLogo size={36} />
            {!collapsed && (
              <div className="flex flex-col animate-fade-in min-w-0">
                <span className="text-base font-bold tracking-tight leading-none text-vylta-bone">
                  VYLTA
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

          {!collapsed ? (
            <div className="px-4 pb-3 pt-1 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] italic text-vylta-subtle truncate">
                  Cada cliente regresa.
                </p>
                <button
                  onClick={() => setCollapsed(true)}
                  className="shrink-0 rounded-md p-1 text-vylta-subtle transition hover:bg-vylta-card hover:text-vylta-bone"
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
