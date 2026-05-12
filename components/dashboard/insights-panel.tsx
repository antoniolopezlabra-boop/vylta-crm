import { Zap, Sparkles, ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '@/lib/dashboard-stats';

// ══════════════════════════════════════════════════════════════════════
// Insights ejecutivos rule-based (sin LLM)
//
// Mismas reglas que la app móvil para consistencia entre plataformas.
// ══════════════════════════════════════════════════════════════════════

type InsightAccent = 'green' | 'amber' | 'blue' | 'purple';

interface Insight {
  id: string;
  accent: InsightAccent;
  title: string;
  subtitle: string;
  href?: string;
}

const ACCENT_CLASSES: Record<InsightAccent, { bar: string; bg: string; icon: string }> = {
  green:  { bar: 'bg-vylta-green-500',  bg: 'bg-vylta-green-500/5',  icon: 'text-vylta-green-600 dark:text-vylta-green-400' },
  amber:  { bar: 'bg-vylta-amber-500',  bg: 'bg-vylta-amber-500/5',  icon: 'text-vylta-amber-700 dark:text-amber-400' },
  blue:   { bar: 'bg-vylta-indigo-500', bg: 'bg-vylta-indigo-500/5', icon: 'text-indigo-600 dark:text-indigo-400' },
  purple: { bar: 'bg-vylta-rose-500',   bg: 'bg-vylta-rose-500/5',   icon: 'text-rose-600 dark:text-rose-400' },
};

export function InsightsPanel({ stats }: { stats: DashboardStats }) {
  const insights: Insight[] = [];

  // 1. Mejor día de la semana (>=20% de los ingresos)
  if (stats.bestWeekday && stats.bestWeekday.percent >= 20) {
    insights.push({
      id: 'best-day',
      accent: 'green',
      title: `Tu mejor día es ${stats.bestWeekday.name}`,
      subtitle: `${stats.bestWeekday.percent}% de tus ingresos del mes`,
    });
  }

  // 2. Servicio estrella (>=15% del revenue)
  if (stats.topService && stats.monthRevenue > 0) {
    const percent = Math.round((stats.topService.amount / stats.monthRevenue) * 100);
    if (percent >= 15) {
      insights.push({
        id: 'top-service',
        accent: 'purple',
        title: `Servicio estrella: ${stats.topService.name}`,
        subtitle: `${percent}% de tus ingresos · ${formatCurrency(stats.topService.amount)}`,
      });
    }
  }

  // 3. Clientes inactivos (>=3 con 60+ días sin venir)
  if (stats.inactiveClientsCount >= 3) {
    insights.push({
      id: 'inactive',
      accent: 'blue',
      title: `${stats.inactiveClientsCount} clientes sin venir 60+ días`,
      subtitle: 'Reactivar con campaña de email',
      href: '/marketing?segment=inactivos',
    });
  }

  // 4. Si hay ingresos pendientes por cobrar
  if (stats.pendingRevenue > 0) {
    insights.push({
      id: 'pending',
      accent: 'amber',
      title: `${formatCurrency(stats.pendingRevenue)} por cobrar`,
      subtitle: 'Servicios completados sin pago registrado',
    });
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-vylta-amber-500/15">
          <Zap className="h-3.5 w-3.5 text-vylta-amber-700 dark:text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold">Insights de tu negocio</h3>
      </div>

      <ul className="mt-4 space-y-2">
        {insights.map((insight) => {
          const accent = ACCENT_CLASSES[insight.accent];
          const content = (
            <div
              className={cn(
                'group flex items-center gap-3 overflow-hidden rounded-lg p-3 transition-colors',
                accent.bg,
                insight.href && 'cursor-pointer hover:bg-opacity-100',
              )}
            >
              <div className={cn('h-10 w-1 shrink-0 rounded-full', accent.bar)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{insight.title}</div>
                <div className="text-xs text-muted-foreground">{insight.subtitle}</div>
              </div>
              {insight.href && (
                <ArrowRight className={cn('h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5', accent.icon)} />
              )}
            </div>
          );

          return (
            <li key={insight.id}>
              {insight.href ? <Link href={insight.href}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
