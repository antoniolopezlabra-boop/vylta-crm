'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Search,
  LogOut,
  User as UserIcon,
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

// ══════════════════════════════════════════════════════════════════════
// Topbar — búsqueda global (⌘K) + menú de usuario.
//
// ⚡ FIX (May 19 2026): los items "Mi perfil", "Configuración" y
// "Ayuda" del avatar dropdown no navegaban al hacer click.
//
// CAUSA: Radix DropdownMenuItem dispara dos eventos relevantes:
//   • onSelect: se ejecuta DESPUÉS del cierre del menú (lo que queremos)
//   • onClick: corre ANTES del cierre, lo cual puede cancelar la
//     navegación si el unmount del menú ocurre durante el push.
//
// SOLUCIÓN: usar onSelect en lugar de onClick. Es el patrón canónico
// de Radix UI para acciones en items de menú.
//
// Ver: https://www.radix-ui.com/docs/primitives/components/dropdown-menu#item
// ══════════════════════════════════════════════════════════════════════

interface TopbarProps {
  user: {
    email?: string;
    displayName?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
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
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-vylta-black/80 px-5 backdrop-blur-xl">
        {/* Search trigger — abre el command palette */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative flex-1 max-w-md group"
        >
          <div className="relative h-9 w-full rounded-lg border border-border bg-vylta-card/60 pl-9 pr-14 text-left transition-all hover:border-vylta-green/30">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
            <span className="flex h-full items-center text-sm text-vylta-subtle">
              Buscar citas, clientes...
            </span>
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-vylta-surface px-1.5 font-mono text-[10px] font-semibold text-vylta-muted sm:inline-flex">
              ⌘K
            </kbd>
          </div>
        </button>

        <div className="flex-1" />

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
            className="w-60 bg-vylta-card border-border"
          >
            <div className="px-2 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 ring-1 ring-vylta-green/20">
                  <AvatarFallback className="bg-vylta-green/15 text-vylta-green text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-vylta-bone">
                    {displayName}
                  </div>
                  <div className="text-xs text-vylta-muted truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            {/* ⚡ FIX (May 19 2026): onSelect en lugar de onClick.
                Radix DropdownMenuItem ejecuta onSelect después del cierre
                del menú, lo cual permite que router.push() funcione sin
                ser cancelado por el unmount del menu. */}
            <DropdownMenuItem
              onSelect={() => router.push('/configuracion')}
              className="text-vylta-muted focus:text-vylta-bone focus:bg-vylta-surface cursor-pointer"
            >
              <UserIcon className="h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => router.push('/configuracion')}
              className="text-vylta-muted focus:text-vylta-bone focus:bg-vylta-surface cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => window.open('https://vylta.lat#faq', '_blank')}
              className="text-vylta-muted focus:text-vylta-bone focus:bg-vylta-surface cursor-pointer"
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
