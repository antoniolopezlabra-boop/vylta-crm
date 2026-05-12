import Link from 'next/link';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { formatShortDate } from '@/lib/date-utils';
import type { UpcomingAppointment } from '@/lib/dashboard-stats';

// ══════════════════════════════════════════════════════════════════════
// Panel lateral con las próximas citas
// ══════════════════════════════════════════════════════════════════════

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Confirmada: { bg: 'bg-vylta-green-500/15', text: 'text-vylta-green-600 dark:text-vylta-green-400' },
  Pendiente:  { bg: 'bg-vylta-amber-500/15', text: 'text-vylta-amber-700 dark:text-amber-400' },
};

interface UpcomingPanelProps {
  appointments: UpcomingAppointment[];
}

export function UpcomingPanel({ appointments }: UpcomingPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-vylta-green-500/10">
            <Calendar className="h-3.5 w-3.5 text-vylta-green-600 dark:text-vylta-green-400" />
          </div>
          <h3 className="text-sm font-semibold">Próximas citas</h3>
        </div>
        <Link
          href="/citas"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Sin citas próximas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando agendes citas aparecerán aquí.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {appointments.map((apt) => {
            const status = STATUS_STYLES[apt.status] || STATUS_STYLES.Pendiente;
            const initials = getInitials(apt.client_name);
            return (
              <li key={apt.id}>
                <Link
                  href={`/citas/${apt.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-xs font-bold text-vylta-green-700 dark:text-vylta-green-400">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{apt.client_name}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                          status.bg,
                          status.text,
                        )}
                      >
                        {apt.status}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{apt.service_name}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatShortDate(apt.date)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {apt.start_time}
                      </span>
                    </div>
                  </div>
                  {apt.service_cost && (
                    <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                      {formatCurrency(apt.service_cost)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
