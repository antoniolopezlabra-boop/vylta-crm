'use client';

import { useState } from 'react';
import {
  Trophy, AlertTriangle, MapPin, Calendar, Activity,
  Ban, Trash2, ShieldCheck, Loader2, X, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';
import { useAdminBusinessAction, type BusinessAction } from '@/hooks/use-admin-business-actions';
import type { Performer } from '@/hooks/use-admin-growth-metrics';

// ══════════════════════════════════════════════════════════
// TopBottomPerformers — Mejores y peores negocios + acciones de admin
//
//   • TOP 10 negocios por citas en ultimos 30 dias (mas activos)
//   • BOTTOM 10 por menos actividad (riesgo de churn)
//   • Cada fila permite Bloquear/Desbloquear y Eliminar al negocio,
//     via la Edge Function admin-business-action (con confirmacion).
// ══════════════════════════════════════════════════════════

interface TopBottomPerformersProps {
  performers: Performer[];
  loading?: boolean;
}

type Pending = { performer: Performer; action: BusinessAction } | null;

export function TopBottomPerformers({ performers, loading }: TopBottomPerformersProps) {
  const top = performers.filter((p) => p.performer_type === 'top');
  const bottom = performers.filter((p) => p.performer_type === 'bottom');
  const [pending, setPending] = useState<Pending>(null);
  const mutation = useAdminBusinessAction();

  const handleAction = (performer: Performer, action: BusinessAction) => setPending({ performer, action });

  const confirmAction = () => {
    if (!pending) return;
    const { performer, action } = pending;
    const name = performer.business_name || 'El negocio';
    mutation.mutate(
      { action, userId: performer.user_id },
      {
        onSuccess: (data) => {
          toast.success(
            action === 'delete' ? `${name} fue eliminado`
              : action === 'block' ? `${name} fue bloqueado`
              : `${name} fue desbloqueado`,
          );
          if (data?.warning) toast.warning(data.warning);
          setPending(null);
        },
        onError: (e) => toast.error(e?.message || 'No se pudo completar la acción'),
      },
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-96 rounded-2xl border border-border bg-vylta-surface shimmer" />
        <div className="h-96 rounded-2xl border border-border bg-vylta-surface shimmer" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="h-px w-5 bg-vylta-gold/40" />
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">
          Mejores y peores negocios
        </h2>
        <DashboardInfo
          title="Mejores y peores negocios"
          description="Dos listas lado a lado: los 10 negocios más activos y los 10 con mayor riesgo de churn en los últimos 30 días. Desde aquí puedes bloquear o eliminar a un negocio."
          metrics={[
            { label: 'Top 10', meaning: 'Los que más citas han agendado en los últimos 30 días. Son los embajadores naturales de VYLTA.' },
            { label: 'Riesgo de churn', meaning: 'Los que casi no usan la plataforma. Si están pagando, son candidatos a cancelar pronto.' },
            { label: 'Bloquear', meaning: 'Impide que el negocio inicie sesión en VYLTA. Es reversible: puedes desbloquearlo cuando quieras.' },
            { label: 'Eliminar', meaning: 'Borra al negocio y TODOS sus datos de forma permanente. Úsalo para usuarios temporales o de prueba.' },
          ]}
          whyMatters="Los Top te enseñan qué funciona. Los de riesgo te dicen a quién contactar antes de que cancele. Y para los usuarios que solo fueron de prueba, puedes limpiarlos aquí mismo."
        />
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* TOP 10 */}
        <div className="relative overflow-hidden rounded-2xl border border-vylta-green/25 bg-vylta-surface p-5 shadow-card-lg">
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-vylta-green/10 blur-[60px]" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-vylta-green" />
              <h3 className="text-sm font-bold text-vylta-bone">Top 10 más activos</h3>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-vylta-green">
                Embajadores
              </span>
            </div>

            {top.length === 0 ? (
              <div className="text-sm text-vylta-subtle italic py-8 text-center">
                Sin datos suficientes
              </div>
            ) : (
              <div className="space-y-1.5">
                {top.map((p, idx) => (
                  <PerformerRow key={p.user_id} performer={p} rank={idx + 1} variant="top" onAction={handleAction} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM 10 */}
        <div className="relative overflow-hidden rounded-2xl border border-vylta-rose/25 bg-vylta-surface p-5 shadow-card-lg">
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-vylta-rose/10 blur-[60px]" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-vylta-rose" />
              <h3 className="text-sm font-bold text-vylta-bone">10 con riesgo de churn</h3>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-vylta-rose">
                Contactar
              </span>
            </div>

            {bottom.length === 0 ? (
              <div className="text-sm text-vylta-subtle italic py-8 text-center">
                Sin datos suficientes
              </div>
            ) : (
              <div className="space-y-1.5">
                {bottom.map((p, idx) => (
                  <PerformerRow key={p.user_id} performer={p} rank={idx + 1} variant="bottom" onAction={handleAction} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pending && (
        <ConfirmModal
          pending={pending}
          loading={mutation.isPending}
          onCancel={() => { if (!mutation.isPending) setPending(null); }}
          onConfirm={confirmAction}
        />
      )}
    </div>
  );
}

function PerformerRow({
  performer,
  rank,
  variant,
  onAction,
}: {
  performer: Performer;
  rank: number;
  variant: 'top' | 'bottom';
  onAction: (performer: Performer, action: BusinessAction) => void;
}) {
  const planColor =
    performer.plan_type?.toLowerCase().includes('premium') ? 'text-vylta-luxury' :
    performer.plan_type?.toLowerCase().includes('basico') ? 'text-vylta-green' :
    'text-vylta-subtle';

  const planLabel =
    performer.plan_type?.toLowerCase() === 'basico' ? 'Premium' :
    performer.plan_type?.toLowerCase() === 'premium' ? 'Luxury' :
    performer.plan_type?.toLowerCase() === 'gratuito' ? 'Básico' :
    performer.plan_type?.toLowerCase().includes('vippremium') ? 'VIP Luxury' :
    performer.plan_type?.toLowerCase().includes('vipbasico') ? 'VIP Premium' :
    performer.plan_type || 'Básico';

  const daysLabel =
    performer.days_since_last_session === null ? 'Nunca' :
    performer.days_since_last_session === 0 ? 'Hoy' :
    performer.days_since_last_session === 1 ? 'Ayer' :
    `Hace ${performer.days_since_last_session}d`;

  const daysClass =
    performer.days_since_last_session === null || performer.days_since_last_session > 14 ? 'text-vylta-rose' :
    performer.days_since_last_session > 7 ? 'text-vylta-gold' :
    'text-vylta-green';

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border/40 bg-vylta-card/30 px-3 py-2 transition hover:border-vylta-gold/30 hover:bg-vylta-card/50">
      <div className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums shrink-0',
        variant === 'top' ? 'bg-vylta-green/15 text-vylta-green' : 'bg-vylta-rose/15 text-vylta-rose',
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-vylta-bone truncate">
            {performer.business_name || 'Sin nombre'}
          </span>
          {performer.bloqueado && (
            <span className="inline-flex items-center gap-1 rounded bg-vylta-rose/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-rose shrink-0">
              <Lock className="h-2.5 w-2.5" /> Bloqueado
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {performer.state && (
            <span className="inline-flex items-center gap-1 text-[10px] text-vylta-muted">
              <MapPin className="h-2.5 w-2.5" />
              {performer.state}
            </span>
          )}
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', planColor)}>
            {planLabel}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 justify-end">
          <Calendar className="h-3 w-3 text-vylta-subtle" />
          <span className={cn(
            'text-sm font-bold tabular-nums',
            variant === 'top' ? 'text-vylta-green' : 'text-vylta-subtle',
          )}>
            {performer.appointments_30d}
          </span>
        </div>
        <div className={cn('flex items-center gap-1 justify-end mt-0.5 text-[10px] tabular-nums', daysClass)}>
          <Activity className="h-2.5 w-2.5" />
          {daysLabel}
        </div>
      </div>

      {/* Acciones de admin */}
      <div className="flex items-center gap-0.5 pl-1 shrink-0 opacity-50 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onAction(performer, performer.bloqueado ? 'unblock' : 'block')}
          title={performer.bloqueado ? 'Desbloquear' : 'Bloquear'}
          className={cn(
            'rounded-md p-1.5 text-vylta-subtle transition',
            performer.bloqueado
              ? 'hover:bg-vylta-green/10 hover:text-vylta-green'
              : 'hover:bg-vylta-gold/10 hover:text-vylta-gold',
          )}
        >
          {performer.bloqueado ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onAction(performer, 'delete')}
          title="Eliminar"
          className="rounded-md p-1.5 text-vylta-subtle transition hover:bg-vylta-rose/10 hover:text-vylta-rose"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({
  pending,
  loading,
  onCancel,
  onConfirm,
}: {
  pending: { performer: Performer; action: BusinessAction };
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { performer, action } = pending;
  const name = performer.business_name || 'este negocio';

  const cfg = {
    delete: {
      title: 'Eliminar negocio',
      cta: 'Eliminar definitivamente',
      Icon: Trash2,
      tone: 'rose' as const,
      body: `Vas a eliminar a “${name}” y TODA su información: citas, clientes, servicios, horarios, suscripción y su cuenta de acceso. Esta acción no se puede deshacer.`,
    },
    block: {
      title: 'Bloquear negocio',
      cta: 'Bloquear',
      Icon: Ban,
      tone: 'gold' as const,
      body: `“${name}” ya no podrá iniciar sesión ni usar VYLTA. Es reversible: puedes desbloquearlo cuando quieras.`,
    },
    unblock: {
      title: 'Desbloquear negocio',
      cta: 'Desbloquear',
      Icon: ShieldCheck,
      tone: 'green' as const,
      body: `“${name}” volverá a tener acceso normal a VYLTA.`,
    },
  }[action];

  const toneClasses = {
    rose: { ring: 'border-vylta-rose/30', chip: 'bg-vylta-rose/15 text-vylta-rose', btn: 'bg-vylta-rose text-white hover:bg-vylta-rose/90' },
    gold: { ring: 'border-vylta-gold/30', chip: 'bg-vylta-gold/15 text-vylta-gold', btn: 'bg-vylta-gold text-vylta-bg hover:bg-vylta-gold/90' },
    green: { ring: 'border-vylta-green/30', chip: 'bg-vylta-green/15 text-vylta-green', btn: 'bg-vylta-green text-white hover:bg-vylta-green/90' },
  }[cfg.tone];

  const Icon = cfg.Icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className={cn('relative w-full max-w-md rounded-2xl border bg-vylta-surface p-6 shadow-card-lg', toneClasses.ring)}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 rounded-md p-1 text-vylta-subtle transition hover:text-vylta-bone disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className={cn('mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl', toneClasses.chip)}>
          <Icon className="h-5 w-5" />
        </div>

        <h3 className="text-lg font-bold text-vylta-bone">{cfg.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-vylta-muted">{cfg.body}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-vylta-muted transition hover:bg-vylta-card disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-60', toneClasses.btn)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {cfg.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
