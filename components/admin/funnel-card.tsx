'use client';

import { Filter, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';
import type { FunnelStep } from '@/hooks/use-admin-growth-metrics';

// ═══════════════════════════════════════════════════════════════════════
// FunnelCard — Funnel de activación de nuevos negocios (May 23 2026)
//
// Muestra cuantos negocios han completado cada paso del onboarding:
//   1. Registrados → 2. Con servicios → 3. Con horario → 4. Primera cita
//   → 5. Primera cita pagada
//
// Cada paso muestra: total, % vs. registrados, y % drop respecto al
// paso anterior. El paso con mayor drop se destaca en rojo.
// ═══════════════════════════════════════════════════════════════════════

interface FunnelCardProps {
  steps: FunnelStep[];
  loading?: boolean;
}

export function FunnelCard({ steps, loading }: FunnelCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
        <div className="h-48 shimmer rounded-lg" />
      </div>
    );
  }

  const baseCount = steps[0]?.count || 0;

  // Calcular el paso con mayor drop (excluyendo el primero que no tiene previo)
  let worstDropIdx = -1;
  let worstDropPct = 0;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].count;
    const curr = steps[i].count;
    if (prev > 0) {
      const dropPct = ((prev - curr) / prev) * 100;
      if (dropPct > worstDropPct) {
        worstDropPct = dropPct;
        worstDropIdx = i;
      }
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg">
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-vylta-luxury/8 blur-[80px]" />

      <div className="relative">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-vylta-luxury" />
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-vylta-bone">
            Funnel de activación
          </h3>
          <DashboardInfo
            title="Funnel de activación"
            description="Muestra cuántos negocios completan cada paso después de registrarse. Es el viaje desde que alguien crea su cuenta hasta que cobra su primera cita."
            metrics={[
              { label: 'Registrados', meaning: 'Negocios que crearon su cuenta. Es el punto de partida (100%).' },
              { label: 'Con servicios', meaning: 'Agregaron al menos un servicio que ofrecen (corte, manicura, consulta, etc).' },
              { label: 'Con horario', meaning: 'Configuraron qué días y horas atienden.' },
              { label: 'Primera cita', meaning: 'Tuvieron al menos una cita agendada por ellos o por un cliente.' },
              { label: 'Primera cita pagada', meaning: 'Marcaron una cita como pagada — están cobrando real con VYLTA.' },
            ]}
            whyMatters="El paso donde más negocios se atoran te dice qué arreglar primero. Si caen mucho entre 'Registrados' y 'Con servicios', el onboarding no los guía bien. Si caen entre 'Con horario' y 'Primera cita', falta enseñarles a usar la app."
          />
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const pctOfBase = baseCount > 0 ? Math.round((step.count / baseCount) * 100) : 0;
            const isWorstDrop = idx === worstDropIdx;
            const dropFromPrev = idx > 0 && steps[idx - 1].count > 0
              ? Math.round(((steps[idx - 1].count - step.count) / steps[idx - 1].count) * 100)
              : null;

            return (
              <div key={step.step}>
                {idx > 0 && (
                  <div className="flex items-center justify-center -my-1.5">
                    <div className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded',
                      isWorstDrop ? 'bg-vylta-rose/15 text-vylta-rose' : 'bg-vylta-muted/10 text-vylta-muted'
                    )}>
                      <ArrowDown className="h-2.5 w-2.5" />
                      {dropFromPrev !== null ? `${dropFromPrev}% drop` : ''}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className={cn(
                    'flex items-center gap-3 rounded-lg border bg-vylta-card/40 px-4 py-3 transition',
                    isWorstDrop ? 'border-vylta-rose/30' : 'border-border/60'
                  )}>
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
                      idx === 0 ? 'bg-vylta-luxury/20 text-vylta-luxury' :
                      isWorstDrop ? 'bg-vylta-rose/15 text-vylta-rose' :
                      'bg-vylta-gold/15 text-vylta-gold'
                    )}>
                      {step.step_order}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-vylta-bone">{step.step}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-vylta-card overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-700',
                            idx === 0 ? 'bg-vylta-luxury' :
                            isWorstDrop ? 'bg-vylta-rose' :
                            'bg-vylta-gold'
                          )}
                          style={{ width: `${pctOfBase}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={cn(
                        'text-2xl font-bold tabular-nums',
                        idx === 0 ? 'text-vylta-luxury' :
                        isWorstDrop ? 'text-vylta-rose' :
                        'text-vylta-gold'
                      )}>
                        {step.count}
                      </div>
                      <div className="text-[10px] text-vylta-subtle tabular-nums">{pctOfBase}%</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {worstDropIdx > 0 && (
          <div className="mt-5 rounded-lg border border-vylta-rose/20 bg-vylta-rose/5 p-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-vylta-rose shrink-0" />
              <div className="text-xs leading-relaxed text-vylta-muted">
                <span className="font-bold text-vylta-rose">Mayor punto de fuga:</span>{' '}
                Entre <span className="text-vylta-bone">"{steps[worstDropIdx - 1].step}"</span> y{' '}
                <span className="text-vylta-bone">"{steps[worstDropIdx].step}"</span> se pierde el{' '}
                <span className="font-bold text-vylta-rose tabular-nums">{Math.round(worstDropPct)}%</span>{' '}
                de los negocios. Aquí hay que enfocar la mejora.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
