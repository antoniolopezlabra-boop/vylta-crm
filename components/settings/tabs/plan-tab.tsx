import Link from 'next/link';
import { CreditCard, ArrowRight, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsCard } from '../configuracion-shell';
import {
  getPlanDisplayName,
  getPlanBadgeLabel,
  getPlanPrice,
  getPlanDescription,
  getPlanBadgeClass,
  getPlanTier,
} from '@/lib/plan-labels';

interface PlanTabProps {
  plan: { plan_type?: string | null; status?: string | null; price?: number | null; current_period_end?: string | null } | null;
}

const PLAN_FEATURES = [
  { feature: 'Citas y agenda visual',          basico: true,  premium: true, luxury: true },
  { feature: 'Cobros pendientes',              basico: true,  premium: true, luxury: true },
  { feature: 'Link público de citas',          basico: false, premium: true, luxury: true },
  { feature: 'Recordatorios WhatsApp',         basico: false, premium: true, luxury: true },
  { feature: 'Reportes ejecutivos',            basico: false, premium: true, luxury: true },
  { feature: 'Equipo (hasta 5 colaboradores)', basico: false, premium: false, luxury: true },
  { feature: 'Citas simultáneas',              basico: false, premium: false, luxury: true },
  { feature: 'Email marketing',                basico: false, premium: false, luxury: true },
  { feature: 'Cumpleaños automáticos',         basico: false, premium: false, luxury: true },
  { feature: 'Chat IA de soporte',             basico: false, premium: true, luxury: true },
];

export function PlanTab({ plan }: PlanTabProps) {
  // Usa los helpers unificados — mismo mapping que la app móvil
  const rawPlanType = plan?.plan_type;
  const tier = getPlanTier(rawPlanType);
  const planName = getPlanDisplayName(rawPlanType);
  const planBadge = getPlanBadgeLabel(rawPlanType);
  const planPrice = getPlanPrice(rawPlanType);
  const planDescription = getPlanDescription(rawPlanType);
  const planBadgeClass = getPlanBadgeClass(rawPlanType);

  return (
    <div className="space-y-4">
      <SettingsCard icon={CreditCard} title="Tu plan actual" description="Administra tu suscripción de VYLTA.">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">Plan {planName}</span>
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', planBadgeClass)}>{planBadge}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{planDescription}</p>
            {plan?.current_period_end && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Renovación: {new Date(plan.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">{planPrice}</div>
          </div>
        </div>

        {tier !== 'luxury' && (
          <Link
            href="https://vylta.lat#pricing"
            target="_blank"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-vylta-green-500 to-vylta-green-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-vylta-green-500/25 transition hover:shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
            {tier === 'basico' ? 'Activar Premium o Luxury' : 'Mejorar a Luxury'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </SettingsCard>

      {/* Tabla comparativa */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/30 px-4 py-2.5">
          <h3 className="text-sm font-bold">Compara los planes</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-bold">Función</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'basico' && 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400')}>Básico</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'premium' && 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400')}>Premium</th>
              <th className={cn('px-2 py-2 text-center font-bold', tier === 'luxury' && 'bg-vylta-amber-500/10 text-vylta-amber-700 dark:text-amber-400')}>Luxury</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 text-xs">{row.feature}</td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'basico' && 'bg-vylta-green-500/5')}>{row.basico ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}</td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'premium' && 'bg-vylta-green-500/5')}>{row.premium ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}</td>
                <td className={cn('px-2 py-2.5 text-center', tier === 'luxury' && 'bg-vylta-amber-500/5')}>{row.luxury ? <Check className="mx-auto h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
