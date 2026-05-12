'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
  Sparkles,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ══════════════════════════════════════════════════════════════════════
// Sidebar del CRM ejecutivo — estilo Linear/Vercel
//
// Características:
//   • 240px de ancho cuando expandido, 64px cuando colapsado
//   • Logo arriba con badge "CRM"
//   • Navegación agrupada con iconos lucide-react
//   • Estado activo con indicador verde a la izquierda
//   • Tooltips cuando está colapsado para no perder context
//   • Toggle de colapsar en el footer
//   • Item activo se detecta con pathname (next/navigation)
// ══════════════════════════════════════════════════════════════════════

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'Inicio',         icon: LayoutDashboard },
  { href: '/citas',         label: 'Citas',          icon: Calendar },
  { href: '/clientes',      label: 'Clientes',       icon: Users },
  { href: '/servicios',     label: 'Servicios',      icon: Briefcase },
  { href: '/reportes',      label: 'Reportes',       icon: BarChart3 },
  { href: '/marketing',     label: 'Marketing',      icon: Megaphone, badge: 'Luxury' },
  { href: '/equipo',        label: 'Equipo',         icon: UserCog,    badge: 'Luxury' },
  { href: '/chat-ia',       label: 'Chat IA',        icon: Bot,        badge: 'Premium' },
];

const NAV_BOTTOM: NavItem[] = [
  { href: '/configuracion', label: 'Configuración',  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo + marca */}
        <div className="flex h-14 items-center border-b border-border px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 overflow-hidden"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-vylta-green-500 to-vylta-green-700 text-white shadow-md shadow-vylta-green-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <span className="text-base font-bold tracking-tight">VYLTA</span>
                <span className="rounded-md bg-vylta-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-vylta-green-600 dark:text-vylta-green-400">
                  CRM
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </ul>
        </nav>

        {/* Items inferiores */}
        <div className="border-t border-border p-3">
          <ul className="space-y-0.5">
            {NAV_BOTTOM.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </ul>

          {/* Toggle colapsar */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 flex w-full items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform',
                collapsed && 'rotate-180',
              )}
            />
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

// ── Item individual del sidebar ──

function SidebarItem({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {/* Indicador activo a la izquierda */}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-vylta-green-500" />
      )}

      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active && 'text-vylta-green-600 dark:text-vylta-green-400',
        )}
      />

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded bg-vylta-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-vylta-green-600 dark:text-vylta-green-400">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  // Si está colapsado, envolver con tooltip para no perder el label
  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-1.5">
            {item.label}
            {item.badge && (
              <span className="rounded bg-vylta-green-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-vylta-green-600 dark:text-vylta-green-400">
                {item.badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{linkContent}</li>;
}
