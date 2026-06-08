'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Crown, LogOut, LayoutDashboard, UserCog } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { VyltaLogo } from '@/components/layout/vylta-logo';

export function EmbajadorTopbar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const tabs = [
    { href: '/embajador', label: 'Inicio', icon: LayoutDashboard },
    { href: '/embajador/perfil', label: 'Mi perfil', icon: UserCog },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-vylta-gold/15 bg-vylta-surface/95 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/embajador" className="flex items-center gap-2.5">
          <VyltaLogo size={30} />
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none text-vylta-bone">VYLTA</span>
            <div className="mt-0.5 flex items-center gap-1">
              <Crown className="h-2.5 w-2.5 text-vylta-gold" />
              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-vylta-gold">Embajador</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-semibold text-vylta-bone sm:inline">{nombre}</span>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-vylta-card/40 px-2.5 py-1.5 text-xs font-bold text-vylta-muted transition hover:border-vylta-rose/40 hover:bg-vylta-rose/5 hover:text-vylta-rose"
          >
            <LogOut className="h-3 w-3" /> Salir
          </button>
        </div>
      </div>
      <nav className="flex items-center gap-1 px-5">
        {tabs.map((t) => {
          const active = t.href === '/embajador' ? pathname === '/embajador' : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'text-vylta-bone' : 'text-vylta-muted hover:text-vylta-bone',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-vylta-gold' : 'text-vylta-subtle group-hover:text-vylta-bone')} />
              <span>{t.label}</span>
              {active && <span className="absolute -bottom-px left-2 right-2 h-[2px] bg-vylta-gold" />}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
