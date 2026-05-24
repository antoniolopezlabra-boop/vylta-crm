'use client';

import { Trophy, AlertTriangle, MapPin, Calendar, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';
import type { Performer } from '@/hooks/use-admin-growth-metrics';

// ═══════════════════════════════════════════════════════════════════════
// TopBottomPerformers — Tabla doble de mejores y peores negocios
// (May 23 2026)
//
// MUESTRA:
//   • TOP 10 negocios ordenados por citas en ultimos 30 dias (DESC)
//   • BOTTOM 10 negocios ordenados por menos citas + sesion mas antigua
//
// Cada fila muestra: nombre, ubicacion, plan, citas 30d, dias desde
// ultima sesion. Click no implementado (futuro: abrir detalle).
// ═══════════════════════════════════════════════════════════════════════

interface TopBottomPerformersProps {
  performers: Performer[];
  loading?: boolean;
}

export function TopBottomPerformers({ performers, loading }: TopBottomPerformersProps) {
  const top = performers.filter(p => p.performer_type === 'top');
  const bottom = performers.filter(p => p.performer_type === 'bottom');

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
          description="Dos listas lado a lado: los 10 negocios más activos y los 10 menos activos en los últimos 30 días. Es la forma rápida de saber con quién hablar."
          metrics={[
            { label: 'Top 10', meaning: 'Los que más citas han agendado en los últimos 30 días. Son los embajadores naturales de VYLTA.' },
            { label: 'Bottom 10', meaning: 'Los que casi no usan la plataforma. Si están pagando, son candidatos a cancelar (churn) pronto.' },
            { label: 'Citas 30d', meaning: 'Cuántas citas crearon en los últimos 30 días.' },
            { label: 'Último acceso', meaning: 'Hace cuántos días entró el dueño del negocio por última vez.' },
          ]}
          whyMatters="Los Top te enseñan qué funciona — pregúntales qué les gusta de VYLTA para amplificar eso. Los Bottom te dicen dónde está el riesgo — contáctalos antes de que cancelen para entender qué les está fallando."
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
                  <PerformerRow key={p.user_id} performer={p} rank={idx + 1} variant="top" />
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
              <h3 className="text-sm font-bold text-vylta-bone">Bottom 10 — riesgo de churn</h3>
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
                  <PerformerRow key={p.user_id} performer={p} rank={idx + 1} variant="bottom" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformerRow({
  performer,
  rank,
  variant,
}: {
  performer: Performer;
  rank: number;
  variant: 'top' | 'bottom';
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
        variant === 'top' ? 'bg-vylta-green/15 text-vylta-green' : 'bg-vylta-rose/15 text-vylta-rose'
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-vylta-bone truncate">
          {performer.business_name || 'Sin nombre'}
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
            variant === 'top' ? 'text-vylta-green' : 'text-vylta-subtle'
          )}>
            {performer.appointments_30d}
          </span>
        </div>
        <div className={cn('flex items-center gap-1 justify-end mt-0.5 text-[10px] tabular-nums', daysClass)}>
          <Activity className="h-2.5 w-2.5" />
          {daysLabel}
        </div>
      </div>
    </div>
  );
}
