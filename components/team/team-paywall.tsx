import Link from 'next/link';
import { Crown, Users, Calendar, Clock, BarChart3, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Paywall para Equipo cuando el usuario no tiene plan Luxury.
export function TeamPaywall() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-vylta-amber-500/20 to-vylta-amber-500/5">
          <Crown className="h-8 w-8 text-vylta-amber-700 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de equipo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Disponible en el <span className="font-bold text-foreground">Plan Luxury</span>. Registra hasta 5 colaboradores con sus propios horarios y agenda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Feature
          icon={Users}
          title="Hasta 5 colaboradores"
          description="Cada uno con nombre, rol, color identificador y avatar propio."
        />
        <Feature
          icon={Clock}
          title="Horarios independientes"
          description="Cada persona define sus propios días y horas de atención."
        />
        <Feature
          icon={Calendar}
          title="Citas asignadas"
          description="Asigna citas a un colaborador específico desde el calendario."
        />
        <Feature
          icon={Share2}
          title="Selección en link público"
          description="Los clientes eligen con qué colaborador agendar al reservar."
        />
        <Feature
          icon={BarChart3}
          title="Reportes por persona"
          description="Ve los ingresos y citas de cada colaborador por separado."
        />
        <Feature
          icon={Crown}
          title="Citas simultáneas"
          description="Permite que dos colaboradores atiendan en paralelo."
        />
      </div>

      <div className="rounded-2xl border border-vylta-amber-500/30 bg-gradient-to-br from-vylta-amber-500/5 via-card to-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-vylta-amber-700 dark:text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-vylta-amber-700 dark:text-amber-400">Plan Luxury</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">$799</span>
              <span className="text-sm text-muted-foreground">MXN / mes</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Todo lo de Premium + equipo + marketing
            </p>
          </div>
          <Link
            href="https://vylta.lat#pricing"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-vylta-amber-500 to-vylta-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
          >
            Ver planes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vylta-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
