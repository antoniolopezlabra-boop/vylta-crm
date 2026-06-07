'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Menu,
  Search,
  LogOut,
  Settings,
  HelpCircle,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { toast } from 'sonner';
import { CommandPalette } from './command-palette';
import { ThemeToggle } from '@/components/theme-toggle';
import { useMobileNav } from './mobile-nav-context';

// ══════════════════════════════════════════════════════════════════════
// Topbar — búsqueda global (⌘K) + theme toggle + menú de usuario.
//
// ⚡ FIX (May 19 2026): los items del avatar dropdown ahora usan onSelect
// en lugar de onClick para que Radix navegue correctamente.
//
// ⚡ THEME TOGGLE (May 22 2026): agregado <ThemeToggle /> entre Bell y
// Avatar para permitir al usuario cambiar entre modo claro y oscuro.
//
// ⚡ RESPONSIVE (Jun 2026): botón hamburguesa a la izquierda, visible solo
// en móvil (lg:hidden), que abre el cajón de navegación.
// ══════════════════════════════════════════════════════════════════════

interface TopbarProps {
  user: {
    email?: string;
    displayName?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const { setOpen } = useMobileNav();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K para abrir el command palette
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('No pudimos cerrar tu sesión. Intenta de nuevo.');
      return;
    }
    toast.success('Hasta pronto 👋');
    router.push('/login');
    router.refresh();
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'Usuario';
  const initials = getInitials(displayName);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 sm:px-5 backdrop-blur-xl">
        {/* Hamburguesa — solo móvil, abre el cajón de navegación */}
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        {/* Search trigger — abre el command palette */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative flex-1 max-w-md group"
        >
          <div className="relative h-9 w-full rounded-lg border border-border bg-card/60 pl-9 pr-14 text-left transition-all hover:border-vylta-green/30">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
            <span className="flex h-full items-center text-sm text-vylta-subtle truncate">
              Buscar citas, clientes...
            </span>
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-semibold text-vylta-muted sm:inline-flex">
              ⌘K
            </kbd>
          </div>
        </button>

        <div className="hidden flex-1 sm:block" />

        {/* ⚡ NEW (May 22 2026): Toggle de tema claro/oscuro */}
        <ThemeToggle />

        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-vylta-card focus:outline-none focus-visible:ring-2 focus-visible:ring-vylta-green/50">
              <Avatar className="h-8 w-8 ring-1 ring-vylta-green/20">
                <AvatarFallback className="bg-vylta-green/15 text-vylta-green text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-vylta-subtle" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 bg-popover border-border"
          >
            <div className="px-2 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 ring-1 ring-vylta-green/20">
                  <AvatarFallback className="bg-vylta-green/15 text-vylta-green text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-foreground">
                    {displayName}
                  </div>
                  <div className="text-xs text-vylta-muted truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onSelect={() => router.push('/configuracion')}
              className="text-vylta-muted focus:text-vylta-bone focus:bg-secondary cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => window.open('https://vylta.lat#faq', '_blank')}
              className="text-vylta-muted focus:text-vylta-bone focus:bg-secondary cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              Ayuda
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
