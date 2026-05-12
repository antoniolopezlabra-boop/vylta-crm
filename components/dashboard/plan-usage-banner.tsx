import Link from 'next/link';
import { CalendarCheck, AlertTriangle, Ban, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanUsage } from '@/lib/home-stats';

// ══════════════════════════════════════════════════════════════════════
// Banner de uso del plan Básico (gratuito) — semáforo verde/amarillo/rojo.
//   < 80%  : verde (informativo)
//   80-99% : ámbar (advertencia)
//   >= 100%: rojo (bloqueo)
// ══════════════════════════════════════════════════════════════════════

export function PlanUsageBanner({ usage }: { usage: PlanUsage }) {
  let scheme: { border: string; bg: string; text: string; bar: string; icon: any; title: string; desc: string };

  if (usage.isAtLimit) {
    scheme = {
      border: 'border-destructive/50',
      bg: 'bg-destructive/5',
      text: 'text-destructive',
      bar: 'bg-destructive',
      icon: Ban,
      title: 'Límite mensual alcanzado',
      desc: 'No puedes crear más citas este mes. Mejora a Premium para citas ilimitadas + WhatsApp automático.',
    };
  } else if (usage.isNearLimit) {
    scheme = {
      border: 'border-vylta-amber-500/50',
      bg: 'bg-vylta-amber-500/5',
      text: 'text-vylta-amber-700 dark:text-amber-400',
      bar: 'bg-vylta-amber-500',
      icon: AlertTriangle,
      title: `Solo te quedan ${usage.remaining} cita${usage.remaining !== 1 ? 's' : ''}`,
      desc: 'Te estás acercando al límite mensual. Considera actualizar a Premium para no perder reservas.',
    };
  } else {
    scheme = {
      border: 'border-vylta-green-500/40',
      bg: 'bg-vylta-green-500/5',
      text: 'text-vylta-green-700 dark:text-vylta-green-400',
      bar: 'bg-vylta-green-500',
      icon: CalendarCheck,
      title: `${usage.used} de ${usage.limit} citas usadas este mes`,
      desc: 'Plan Básico · Mejora a Premium para citas ilimitadas y WhatsApp automático.',
    };
  }

  const Icon = scheme.icon;

  return (
    <Link
      href="https://vylta.lat#pricing"
      target="_blank"
      className={cn(
        'block rounded-xl border-2 p-4 shadow-sm transition hover:shadow-md',
        scheme.border,
        scheme.bg,
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', scheme.bg, scheme.text)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className={cn('text-sm font-bold', scheme.text)}>{scheme.title}</div>
          <p className="text-[11px] text-muted-foreground">{scheme.desc}</p>
        </div>
        <ArrowRight className={cn('h-4 w-4 shrink-0', scheme.text)} />
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full rounded-full transition-all duration-500', scheme.bar)}
            style={{ width: `${Math.min(100, usage.percentage)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className={scheme.text}>{usage.used} / {usage.limit}</span>
          <span className="text-muted-foreground">
            {usage.isAtLimit ? 'Sin disponibles' : `${usage.remaining} disponibles`}
          </span>
        </div>
      </div>
    </Link>
  );
}
