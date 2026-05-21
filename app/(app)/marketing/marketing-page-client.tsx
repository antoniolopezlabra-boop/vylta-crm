'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Mail,
  Plus,
  CheckCircle2,
  Pencil,
  XCircle,
  Users,
  Clock,
  Send,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';

// ══════════════════════════════════════════════════════════════════════
// MarketingPageClient — UI del listado de campañas.
//
// Estado interno:
//   • filter: 'todas' | 'enviadas' | 'borradores' | 'fallidas'
//
// Diseño:
//   Header con icono + título + stats inline (al estilo /clientes).
//   Stats cards arriba de la tabla.
//   Tabla con: Asunto, Segmento, Estado, Destinatarios, Fecha.
//   Empty state si no hay campañas.
//   Filter chips arriba de la tabla.
// ══════════════════════════════════════════════════════════════════════

interface Campaign {
  id: string;
  subject: string;
  body: string;
  segment: 'todos' | 'activos' | 'inactivos';
  status: 'enviada' | 'borrador' | 'fallida';
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  todos: 'Todos los clientes',
  activos: 'Solo activos',
  inactivos: 'Solo inactivos',
};

type FilterValue = 'todas' | 'enviadas' | 'borradores' | 'fallidas';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'enviadas', label: 'Enviadas' },
  { value: 'borradores', label: 'Borradores' },
  { value: 'fallidas', label: 'Fallidas' },
];

export function MarketingPageClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [filter, setFilter] = useState<FilterValue>('todas');

  // Stats globales (independientes del filtro activo)
  const stats = useMemo(() => {
    const sent = initialCampaigns.filter(c => c.status === 'enviada');
    const drafts = initialCampaigns.filter(c => c.status === 'borrador');
    const totalRecipients = sent.reduce((s, c) => s + (c.recipient_count || 0), 0);
    return {
      total: initialCampaigns.length,
      sent: sent.length,
      drafts: drafts.length,
      recipients: totalRecipients,
    };
  }, [initialCampaigns]);

  // Filtrado
  const filtered = useMemo(() => {
    if (filter === 'todas') return initialCampaigns;
    if (filter === 'enviadas') return initialCampaigns.filter(c => c.status === 'enviada');
    if (filter === 'borradores') return initialCampaigns.filter(c => c.status === 'borrador');
    return initialCampaigns.filter(c => c.status === 'fallida');
  }, [initialCampaigns, filter]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Megaphone className="h-5 w-5 text-vylta-green" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">Marketing</h1>
            <p className="text-sm text-vylta-muted">
              Campañas de email para llegar a tus clientes
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/marketing/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nueva campaña
            </Button>
          </Link>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Total"
          value={stats.total}
          accent="green"
        />
        <StatCard
          icon={Send}
          label="Enviadas"
          value={stats.sent}
          accent="green"
        />
        <StatCard
          icon={Pencil}
          label="Borradores"
          value={stats.drafts}
          accent="amber"
        />
        <StatCard
          icon={Users}
          label="Destinatarios"
          value={stats.recipients}
          accent="green"
        />
      </div>

      {/* FILTER CHIPS */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              filter === f.value
                ? 'border-vylta-green/40 bg-vylta-green/10 text-vylta-green'
                : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* TABLA / EMPTY STATE */}
      <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        {filtered.length === 0 ? (
          <EmptyState hasFilter={filter !== 'todas'} hasAnyCampaigns={initialCampaigns.length > 0} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-vylta-card/40">
                <tr>
                  <Th>Asunto</Th>
                  <Th>Segmento</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Destinatarios</Th>
                  <Th>Fecha</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <CampaignRow key={c.id} campaign={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CampaignRow — fila de la tabla
// ─────────────────────────────────────────────────────────────────────
function CampaignRow({ campaign }: { campaign: Campaign }) {
  const statusMeta = STATUS_META[campaign.status] || STATUS_META.borrador;
  const StatusIcon = statusMeta.icon;

  return (
    <tr className="group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-vylta-card/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Mail className="h-4 w-4 text-vylta-green" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-vylta-bone">
              {campaign.subject || '(Sin asunto)'}
            </div>
            <div className="truncate text-xs text-vylta-muted mt-0.5">
              {campaign.body ? truncate(campaign.body, 60) : '(Sin contenido)'}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-vylta-muted">
          {SEGMENT_LABELS[campaign.segment] || campaign.segment}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            statusMeta.className,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {statusMeta.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-vylta-bone">
        {campaign.status === 'enviada' ? (campaign.recipient_count || 0) : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-vylta-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatShortDate(campaign.sent_at || campaign.created_at)}
        </span>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StatCard — KPI card al estilo dashboard
// ─────────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: 'green' | 'amber';
}) {
  const accentClass =
    accent === 'amber'
      ? 'bg-vylta-amber-500/10 text-vylta-amber-500 ring-vylta-amber-500/20'
      : 'bg-vylta-green/10 text-vylta-green ring-vylta-green/20';

  const valueClass = accent === 'amber' ? 'text-vylta-amber-500' : 'text-vylta-bone';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', accentClass)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vylta-muted">
          {label}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Th — header de tabla (mismo patrón que /clientes)
// ─────────────────────────────────────────────────────────────────────
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted', className)}>
      {children}
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ hasFilter, hasAnyCampaigns }: { hasFilter: boolean; hasAnyCampaigns: boolean }) {
  // Caso 1: hay campañas pero el filtro no matchea ninguna
  if (hasFilter && hasAnyCampaigns) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-vylta-card ring-1 ring-border">
          <Inbox className="h-6 w-6 text-vylta-muted" />
        </div>
        <h3 className="text-base font-semibold text-vylta-bone">Sin resultados</h3>
        <p className="mt-1 max-w-sm text-sm text-vylta-muted">
          No hay campañas con este filtro. Prueba con otro o quita el filtro.
        </p>
      </div>
    );
  }

  // Caso 2: no hay NINGUNA campaña aún
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
        <Megaphone className="h-6 w-6 text-vylta-green" />
      </div>
      <h3 className="text-base font-semibold text-vylta-bone">Sin campañas aún</h3>
      <p className="mt-1 max-w-md text-sm text-vylta-muted">
        Crea tu primera campaña y envía promociones, descuentos o
        novedades a tus clientes directamente a su email.
      </p>
      <div className="mt-4 flex gap-2">
        <Link href="/marketing/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Crear primera campaña
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trim() + '…';
}

const STATUS_META: Record<
  string,
  { label: string; icon: any; className: string }
> = {
  enviada: {
    label: 'Enviada',
    icon: CheckCircle2,
    className: 'bg-vylta-green/10 text-vylta-green ring-1 ring-vylta-green/20',
  },
  borrador: {
    label: 'Borrador',
    icon: Pencil,
    className: 'bg-vylta-amber-500/10 text-vylta-amber-500 ring-1 ring-vylta-amber-500/20',
  },
  fallida: {
    label: 'Fallida',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
  },
};
