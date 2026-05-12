'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Gift,
  Clock,
  Loader2,
  StickyNote,
} from 'lucide-react';
import { fetchClientAppointments, getClientBadge, type Client, type ClientAppointment } from '@/lib/clients';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { formatShortDate, MONTHS_ES } from '@/lib/date-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// ══════════════════════════════════════════════════════════════════════
// Panel lateral — alineado con schema real:
//   • total_visits (no total_appointments)
//   • NO usar tags (no existe)
//   • total_spent viene calculado de fetchClients
// ══════════════════════════════════════════════════════════════════════

interface ClientDetailPanelProps {
  client: Client;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  Confirmada: 'bg-vylta-green-500/15 text-vylta-green-600 dark:text-vylta-green-400',
  Pendiente:  'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
  Completada: 'bg-vylta-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  Pagado:     'bg-vylta-green-500/15 text-vylta-green-600 dark:text-vylta-green-400',
  Reagendada: 'bg-vylta-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  'En espera': 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
  Solicitud:  'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
  Cancelada:  'bg-secondary text-muted-foreground',
  'No asistió': 'bg-vylta-rose-500/15 text-rose-600 dark:text-rose-400',
  Rechazada:  'bg-vylta-rose-500/15 text-rose-600 dark:text-rose-400',
};

export function ClientDetailPanel({ client, onClose }: ClientDetailPanelProps) {
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchClientAppointments(client.id).then((apts) => {
      if (!cancelled) {
        setAppointments(apts);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [client.id]);

  const badge = getClientBadge(client);

  let birthdayLabel: string | null = null;
  if (client.birthday) {
    const d = new Date(client.birthday + 'T12:00:00');
    birthdayLabel = `${d.getDate()} de ${MONTHS_ES[d.getMonth()].toLowerCase()}`;
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
      />

      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-slide-in-right">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-vylta-green-500 to-vylta-green-700 text-base font-bold text-white shadow-md shadow-vylta-green-500/20">
              {getInitials(client.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold">{client.name}</h2>
                {badge && (
                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', badge.color)}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cliente desde {formatShortDate(client.created_at.split('T')[0])}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-2">
              <StatBox
                icon={Calendar}
                label="Citas"
                value={`${client.total_visits || 0}`}
              />
              <StatBox
                icon={DollarSign}
                label="Gastado"
                value={formatCurrency(client.total_spent || 0)}
              />
              <StatBox
                icon={Clock}
                label="Última visita"
                value={client.last_visit ? formatShortDate(client.last_visit) : '—'}
              />
            </div>

            <Section title="Contacto">
              <InfoRow icon={Phone} value={client.phone || 'Sin teléfono'} muted={!client.phone} />
              <InfoRow icon={Mail}  value={client.email || 'Sin email'} muted={!client.email} />
              {birthdayLabel && <InfoRow icon={Gift} value={`Cumple el ${birthdayLabel}`} />}
            </Section>

            {client.notes && (
              <Section title="Notas" icon={StickyNote}>
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-foreground/90 whitespace-pre-wrap">
                  {client.notes}
                </div>
              </Section>
            )}

            <Section title={`Historial de citas (${appointments.length})`}>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : appointments.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Sin citas registradas aún.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {appointments.map((apt) => (
                    <li key={apt.id} className="flex items-center gap-3 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-vylta-green-500/10">
                        <Calendar className="h-3.5 w-3.5 text-vylta-green-600 dark:text-vylta-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{apt.service_name}</span>
                          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', STATUS_STYLES[apt.status] || 'bg-secondary text-muted-foreground')}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(apt.date)} · {apt.start_time}
                        </div>
                      </div>
                      {apt.service_cost && (
                        <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                          {formatCurrency(apt.service_cost)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, value, muted }: { icon: any; value: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 text-sm', muted && 'text-muted-foreground italic')}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </div>
  );
}
