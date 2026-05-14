'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Ticket,
  ShieldCheck,
  ChevronLeft,
  Crown,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VyltaLogo } from '@/components/layout/vylta-logo';
import type { AdminRole } from '@/lib/admin';

// ═════════════════════════════════════════════════════════════════════
// Sidebar admin — Control Center
//
// Branding dorado/gold para diferenciar visualmente del CRM normal.
// Botón inferior "Salir a CRM normal" permite a admins ver el CRM de
// un usuario regular (con su misma sesión) si necesitan testear cosas.
// (Nota: el layout (app) los redirigirá de vuelta a /admin automático,
// así que para realmente entrar al CRM como usuario necesitarían otra
// cuenta. Pero al menos no quedan atrapados visualmente.)
// ═════════════════════════════════════════════════════════════════════

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',              label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/admin/tenants',      label: 'Negocios',   icon: Building2 },
  { href: '/admin/promo-codes',  label: 'Promo codes', icon: Ticket, superAdminOnly: true },
  { href: '/admin/admins',       label: 'Admins',     icon: ShieldCheck, superAdminOnly: true },
];

export function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const isSuperAdmin = role === 'super_admin';

  const visibleItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-r border-vylta-gold/15 bg-vylta-surface transition-[width] duration-300 ease-out',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* HEADER — logo + branding gold */}
      <div className="flex h-16 items-center px-4">
        <Link
          href="/admin"
          prefetch
          className="flex items-center gap-2.5 overflow-hidden focus:outline-none"
        >
          <VyltaLogo size={36} />
          {!collapsed && (
            <div className="flex flex-col animate-fade-in min-w-0">
              <span className="text-base font-bold tracking-tight leading-none text-vylta-bone">
                VYLTA
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <Crown className="h-2.5 w-2.5 text-vylta-gold" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-vylta-gold">
                  Control Center
                </span>
              </div>
            </div>
          )}
        </Link>
      </div>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-vylta-gold/20 to-transparent" />

      {/* NAV ITEMS */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <div className="px-2.5 pb-1.5 pt-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-vylta-gold/70">
              Administración
            </span>
          </div>
        )}
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-vylta-gold/15 text-vylta-bone shadow-[inset_0_1px_0_hsl(45_93%_47%/0.2)]'
                      : 'text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
                  )}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-vylta-gold shadow-[0_0_8px_hsl(45_93%_47%/0.6)]" />
                  )}
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      active ? 'text-vylta-gold' : 'text-vylta-subtle group-hover:text-vylta-bone',
                    )}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* FOOTER */}
      <div className="border-t border-vylta-gold/10">
        {!collapsed ? (
          <div className="px-4 py-3 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] italic text-vylta-gold/60 truncate">
                Sistema VYLTA
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
            className="mx-auto my-3 flex h-7 w-7 items-center justify-center rounded-md text-vylta-subtle transition hover:bg-vylta-card hover:text-vylta-bone"
            aria-label="Expandir menú"
          >
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>
    </aside>
  );
}
