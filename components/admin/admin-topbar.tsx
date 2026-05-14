'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Crown, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/lib/admin';

// ═════════════════════════════════════════════════════════════════════
// Admin Topbar — con badge de rol y logout
// ═════════════════════════════════════════════════════════════════════

export function AdminTopbar({
  adminName,
  role,
}: {
  adminName: string;
  role: AdminRole;
}) {
  const router = useRouter();
  const isSuper = role === 'super_admin';

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

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-vylta-gold/15 bg-vylta-surface px-6">
      <div className="flex items-center gap-3">
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
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-mono tabular-nums text-vylta-muted">{timeStr}</span>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-vylta-card/40 px-2.5 py-1.5 text-xs font-bold text-vylta-muted transition hover:border-vylta-rose/40 hover:bg-vylta-rose/5 hover:text-vylta-rose"
        >
          <LogOut className="h-3 w-3" />
          Salir
        </button>
      </div>
    </header>
  );
}
