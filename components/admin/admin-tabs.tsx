'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Ticket,
  ShieldCheck,
  Crown,
  Shield,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VyltaLogo } from '@/components/layout/vylta-logo';
import type { AdminRole } from '@/lib/admin';

// ══════════════════════════════════════════
// AdminTabs — Top navigation bar para Control Center
//
// Reemplaza el AdminSidebar anterior. Estilo Linear/Vercel con underline
// animado bajo la tab activa.
//
// VENTAJAS:
//   • Libera ~250px horizontales para el contenido del dashboard
//   • Mejor uso del espacio en pantallas grandes (1440px+)
//   • Menos clicks: todo accesible desde la parte superior
//   • Look profesional ejecutivo (similar a Stripe Dashboard, Linear)
// ══════════════════════════════════════════

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',              label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/tenants',      label: 'Negocios',    icon: Building2 },
  { href: '/admin/embajadores',  label: 'Embajadores', icon: Users },
  { href: '/admin/promo-codes',  label: 'Promos',      icon: Ticket, superAdminOnly: true },
  { href: '/admin/admins',       label: 'Admins',      icon: ShieldCheck, superAdminOnly: true },
];

export function AdminTabs({
  role,
  adminName,
}: {
  role: AdminRole;
  adminName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSuperAdmin = role === 'super_admin';
  const visibleItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error al cerrar sesión');
      return;
    }
    router.push('/login');
    router.refresh();
  }

  const isSuper = role === 'super_admin';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="sticky top-0 z-40 border-b border-vylta-gold/15 bg-vylta-surface/95 backdrop-blur-xl">
      {/* ROW 1: Logo + Branding + Admin info + Logout */}
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/admin" prefetch className="flex items-center gap-2.5">
          <VyltaLogo size={32} />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-none text-vylta-bone">
              VYLTA
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <Crown className="h-2.5 w-2.5 text-vylta-gold" />
              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-vylta-gold">
                Control Center
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-vylta-muted">{timeStr}</span>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1',
              isSuper
                ? 'border-vylta-gold/40 bg-vylta-gold/10 text-vylta-gold'
                : 'border-vylta-sky/40 bg-vylta-sky/10 text-vylta-sky',
            )}
          >
            {isSuper ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isSuper ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <span className="text-sm font-semibold text-vylta-bone">{adminName}</span>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-vylta-card/40 px-2.5 py-1.5 text-xs font-bold text-vylta-muted transition hover:border-vylta-rose/40 hover:bg-vylta-rose/5 hover:text-vylta-rose"
          >
            <LogOut className="h-3 w-3" />
            Salir
          </button>
        </div>
      </div>

      {/* ROW 2: Tabs de navegación con underline animado */}
      <nav className="flex items-center gap-1 px-6">
        {visibleItems.map((item) => {
          const active = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                active
                  ? 'text-vylta-bone'
                  : 'text-vylta-muted hover:text-vylta-bone',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-vylta-gold' : 'text-vylta-subtle group-hover:text-vylta-bone',
                )}
                strokeWidth={active ? 2.25 : 2}
              />
              <span>{item.label}</span>
              {/* Underline animado para tab activa */}
              {active && (
                <span className="absolute -bottom-px left-2 right-2 h-[2px] bg-vylta-gold shadow-[0_0_8px_hsl(45_93%_47%/0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
