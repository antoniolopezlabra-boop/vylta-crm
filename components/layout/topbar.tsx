'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Search,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User as UserIcon,
  Settings,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { toast } from 'sonner';

// ══════════════════════════════════════════════════════════════════════
// Topbar del CRM ejecutivo
//
// Características:
//   • Search global con ⌘K shortcut (placeholder por ahora)
//   • Theme toggle (light/dark/system)
//   • Avatar + dropdown de perfil con logout funcional
//   • Altura fija de 56px (h-14)
// ══════════════════════════════════════════════════════════════════════

interface TopbarProps {
  user: {
    email?: string;
    displayName?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes pone el theme correcto solo en cliente — evita hydration mismatch
  useEffect(() => setMounted(true), []);

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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4 backdrop-blur-sm">
      {/* Search global */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar citas, clientes..."
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-vylta-green-500/50 focus:ring-2 focus:ring-vylta-green-500/20"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      {/* Theme toggle */}
      {mounted && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Cambiar tema</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="h-4 w-4" />
              Claro
              {theme === 'light' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="h-4 w-4" />
              Oscuro
              {theme === 'dark' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="h-4 w-4" />
              Sistema
              {theme === 'system' && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Avatar + dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-secondary">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
          <div className="px-2 pb-2">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/configuracion')}>
            <UserIcon className="h-4 w-4" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/configuracion')}>
            <Settings className="h-4 w-4" />
            Configuración
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open('https://vylta.lat#faq', '_blank')}>
            <HelpCircle className="h-4 w-4" />
            Ayuda
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
