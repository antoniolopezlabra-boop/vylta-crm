'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  Crown,
  Shield,
  Info,
  Calendar,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAdminUserClient } from '@/lib/admin';
import { cn, getInitials } from '@/lib/utils';
import { MONTHS_ES } from '@/lib/date-utils';
import {
  useAdminAdmins,
  useToggleAdminActive,
  type AdminMember,
} from '@/hooks/use-admin-admins';

// ═════════════════════════════════════════════════════════════════════
// /admin/admins — Gestión de administradores del sistema
//
// OPTIMIZADO con TanStack Query (May 2026):
//   • useAdminAdmins() para la lista — cache + stale-while-revalidate
//   • useToggleAdminActive() mutation con invalidación automática
//   • Botón refresh con isFetching spinner
//
// IMPORTANTE: agregar admins requiere user_id de auth.users (UUID).
// Como esto no se puede hacer por email desde el cliente con seguridad,
// agregar un admin DEBE hacerse manualmente en Supabase Table Editor.
// Esta pantalla permite:
//   • Ver lista de admins
//   • Toggle is_active (activar/desactivar)
//   • Identificar roles (super_admin/superadmin vs admin regular)
//
// Super admins NO se pueden desactivar desde aquí (defensa contra
// auto-bloqueo): debe hacerse desde Supabase directamente.
// ══════════════════════════════════════════════════════════════════════

export default function AdminAdminsPage() {
  const { data: admins = [], isLoading, isFetching, refetch } = useAdminAdmins();
  const toggleMutation = useToggleAdminActive();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getAdminUserClient().then((u) => setCurrentUserId(u?.user_id || null));
  }, []);

  async function toggleActive(admin: AdminMember) {
    // Defensa: no permitir auto-desactivación
    if (admin.user_id === currentUserId) {
      toast.error('No puedes desactivarte a ti mismo');
      return;
    }
    // Defensa: super admins NO se pueden desactivar desde UI
    if (isSuperAdminRole(admin.role)) {
      toast.error('Super admins solo se pueden modificar desde Supabase directamente');
      return;
    }

    try {
      await toggleMutation.mutateAsync({
        id: admin.id,
        currentlyActive: admin.is_active,
      });
      toast.success(
        admin.is_active
          ? `${admin.name || 'Admin'} desactivado`
          : `${admin.name || 'Admin'} activado`,
      );
    } catch {
      toast.error('Error actualizando');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  const supers = admins.filter((a) => isSuperAdminRole(a.role));
  const regulars = admins.filter((a) => !isSuperAdminRole(a.role));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            prefetch
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-vylta-gold" />
              Administradores
            </h1>
            <p className="text-sm text-vylta-muted mt-0.5">
              {admins.length} {admins.length === 1 ? 'admin' : 'admins'} · {supers.length} super, {regulars.length} regulares
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-xs font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
          aria-label="Refrescar lista"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* INFO BANNER — cómo agregar admin */}
      <div className="rounded-xl border border-vylta-sky/25 bg-vylta-sky/5 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-vylta-sky mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-bold text-vylta-sky">¿Cómo agregar un admin?</div>
            <p className="text-xs text-vylta-muted mt-1">
              Por seguridad, agregar admins requiere el <code className="px-1 rounded bg-vylta-card text-vylta-bone">user_id</code> de Supabase Auth.
              Hazlo manual en{' '}
              <span className="font-bold text-vylta-bone">Supabase → Table Editor → vylta_admins</span>{' '}
              insertando: <code className="px-1 rounded bg-vylta-card text-vylta-bone">user_id, name, email, role, is_active=true</code>.
              Roles válidos: <code className="px-1 rounded bg-vylta-card text-vylta-gold">super_admin</code> o <code className="px-1 rounded bg-vylta-card text-vylta-sky">admin</code>.
            </p>
          </div>
        </div>
      </div>

      {/* SUPER ADMINS */}
      {supers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-3.5 w-3.5 text-vylta-gold" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-gold">Super Admins</h2>
            <span className="rounded-full bg-vylta-gold/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-vylta-gold">
              {supers.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {supers.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                isCurrentUser={admin.user_id === currentUserId}
                onToggleActive={() => toggleActive(admin)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ADMINS REGULARES */}
      {regulars.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-3.5 w-3.5 text-vylta-sky" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-sky">Admins regulares</h2>
            <span className="rounded-full bg-vylta-sky/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-vylta-sky">
              {regulars.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {regulars.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                isCurrentUser={admin.user_id === currentUserId}
                onToggleActive={() => toggleActive(admin)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state si no hay admins (no debería pasar pero por si acaso) */}
      {admins.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-vylta-card/30 py-16 text-center">
          <ShieldCheck className="h-10 w-10 text-vylta-subtle mb-3" />
          <h3 className="text-sm font-bold text-vylta-bone">Sin admins registrados</h3>
          <p className="text-xs text-vylta-muted mt-1">Esto es inusual. Agrega un admin desde Supabase.</p>
        </div>
      )}
    </div>
  );
}

function AdminCard({
  admin, isCurrentUser, onToggleActive,
}: {
  admin: AdminMember;
  isCurrentUser: boolean;
  onToggleActive: () => void;
}) {
  const isSuper = isSuperAdminRole(admin.role);
  const createdDate = new Date(admin.created_at);
  const createdLabel = `${createdDate.getDate()} ${MONTHS_ES[createdDate.getMonth()].slice(0, 3)} ${createdDate.getFullYear()}`;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-vylta-surface p-4 shadow-card transition-all',
        isSuper
          ? 'border-vylta-gold/30'
          : admin.is_active
            ? 'border-vylta-sky/25'
            : 'border-border opacity-60',
      )}
    >
      {isSuper && (
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-vylta-gold/8 blur-2xl" />
      )}

      <div className="relative flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1',
            isSuper
              ? 'bg-vylta-gold/10 text-vylta-gold ring-vylta-gold/30'
              : 'bg-vylta-sky/10 text-vylta-sky ring-vylta-sky/30',
          )}
        >
          {admin.name ? getInitials(admin.name) : <Shield className="h-5 w-5" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-vylta-bone truncate">
              {admin.name || 'Sin nombre'}
            </h3>
            {isCurrentUser && (
              <span className="shrink-0 rounded bg-vylta-green/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-green">
                Tú
              </span>
            )}
            {!admin.is_active && (
              <span className="shrink-0 rounded bg-vylta-card px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-muted">
                Inactivo
              </span>
            )}
          </div>
          {admin.email && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-vylta-muted">
              <Mail className="h-2.5 w-2.5" />
              <span className="truncate">{admin.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border',
                isSuper
                  ? 'bg-vylta-gold/10 text-vylta-gold border-vylta-gold/30'
                  : 'bg-vylta-sky/10 text-vylta-sky border-vylta-sky/30',
              )}
            >
              {isSuper ? <Crown className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
              {isSuper ? 'Super Admin' : 'Admin'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-vylta-subtle">
              <Calendar className="h-2.5 w-2.5" />
              {createdLabel}
            </span>
          </div>
        </div>

        {/* Toggle */}
        {!isSuper && !isCurrentUser && (
          <button
            onClick={onToggleActive}
            className={cn(
              'shrink-0 rounded px-2 py-1 text-[10px] font-bold transition',
              admin.is_active
                ? 'bg-vylta-rose/10 text-vylta-rose hover:bg-vylta-rose/20'
                : 'bg-vylta-green/10 text-vylta-green hover:bg-vylta-green/20',
            )}
          >
            {admin.is_active ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Helper: acepta tanto 'super_admin' (snake_case) como 'superadmin' (sin)
 * porque la app móvil usa el segundo y queremos compatibilidad total.
 */
function isSuperAdminRole(role: string): boolean {
  const normalized = (role || '').toLowerCase().replace('_', '');
  return normalized === 'superadmin';
}
