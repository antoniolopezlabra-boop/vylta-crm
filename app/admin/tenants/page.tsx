'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  ArrowLeft,
  Loader2,
  Calendar,
  Users,
  Gem,
  Crown,
  Mail,
  Phone,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { fetchAllTenants, formatLastSeen, type TenantListItem } from '@/lib/admin-tenants';
import { cn, getInitials } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// ═════════════════════════════════════════════════════════════════════
// /admin/tenants — Lista de todos los negocios registrados
//
// Features:
//   • Búsqueda en vivo (nombre negocio, tipo, email)
//   • Filtros por plan (Basico / Premium / Luxury / Todos)
//   • Indicador de actividad (activo 30d con pulse)
//   • Stats por negocio: citas, clientes
//   • Click en tenant → navega a /admin/tenants/[id]
// ═════════════════════════════════════════════════════════════════════

type PlanFilter = 'all' | 'Basico' | 'Premium' | 'Luxury';
type SortBy = 'created_desc' | 'created_asc' | 'name_asc' | 'appointments_desc';

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('created_desc');

  useEffect(() => {
    fetchAllTenants()
      .then((data) => setTenants(data))
      .catch((e) => console.error('[Tenants] Error:', e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = tenants;

    // Filtro por plan
    if (planFilter !== 'all') {
      result = result.filter((t) => t.plan_label === planFilter);
    }

    // Búsqueda
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((t) =>
        t.business_name.toLowerCase().includes(q) ||
        (t.business_type || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').includes(q),
      );
    }

    // Sort
    const sorted = [...result];
    if (sortBy === 'created_desc') {
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === 'created_asc') {
      sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) => a.business_name.localeCompare(b.business_name));
    } else if (sortBy === 'appointments_desc') {
      sorted.sort((a, b) => b.appointments_count - a.appointments_count);
    }

    return sorted;
  }, [tenants, search, planFilter, sortBy]);

  const counts = useMemo(() => ({
    all: tenants.length,
    Basico: tenants.filter((t) => t.plan_label === 'Basico').length,
    Premium: tenants.filter((t) => t.plan_label === 'Premium').length,
    Luxury: tenants.filter((t) => t.plan_label === 'Luxury').length,
    active30d: tenants.filter((t) => t.is_active_30d).length,
  }), [tenants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone flex items-center gap-2">
              <Building2 className="h-6 w-6 text-vylta-gold" />
              Negocios
            </h1>
            <p className="text-sm text-vylta-muted mt-0.5">
              {counts.all} {counts.all === 1 ? 'tenant registrado' : 'tenants registrados'} · {counts.active30d} activos en 30d
            </p>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Búsqueda */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negocio, tipo, email..."
            className="pl-10"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="h-10 rounded-lg border border-border bg-vylta-surface px-3 text-sm font-semibold text-vylta-bone outline-none focus:border-vylta-gold/40"
        >
          <option value="created_desc">Más recientes primero</option>
          <option value="created_asc">Más antiguos primero</option>
          <option value="name_asc">Nombre A → Z</option>
          <option value="appointments_desc">Más citas primero</option>
        </select>
      </div>

      {/* PILLS DE PLAN */}
      <div className="flex flex-wrap gap-2">
        <PlanPill
          label="Todos"
          count={counts.all}
          active={planFilter === 'all'}
          onClick={() => setPlanFilter('all')}
          color="bone"
        />
        <PlanPill
          label="Basico"
          sublabel="$0"
          count={counts.Basico}
          active={planFilter === 'Basico'}
          onClick={() => setPlanFilter('Basico')}
          color="subtle"
        />
        <PlanPill
          label="Premium"
          sublabel="$399"
          count={counts.Premium}
          active={planFilter === 'Premium'}
          onClick={() => setPlanFilter('Premium')}
          color="green"
          Icon={Gem}
        />
        <PlanPill
          label="Luxury"
          sublabel="$799"
          count={counts.Luxury}
          active={planFilter === 'Luxury'}
          onClick={() => setPlanFilter('Luxury')}
          color="luxury"
          Icon={Crown}
        />
      </div>

      {/* RESULTADOS */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-vylta-card/30 py-16 text-center">
          <Building2 className="h-10 w-10 text-vylta-subtle mb-3" />
          <h3 className="text-sm font-bold text-vylta-bone">Sin resultados</h3>
          <p className="text-xs text-vylta-muted mt-1">
            Ajusta los filtros o búsqueda para ver más tenants.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-vylta-card/40">
              <tr className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
                <th className="py-3 px-4">Negocio</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4 text-center">Citas</th>
                <th className="py-3 px-4 text-center">Clientes</th>
                <th className="py-3 px-4">Actividad</th>
                <th className="py-3 px-4 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TenantRow key={t.user_id} tenant={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TenantRow({ tenant }: { tenant: TenantListItem }) {
  const planColors = {
    Basico:  'bg-vylta-card/60 text-vylta-muted border-border',
    Premium: 'bg-vylta-green/10 text-vylta-green border-vylta-green/30',
    Luxury:  'bg-vylta-luxury/10 text-vylta-luxury border-vylta-luxury/30',
  }[tenant.plan_label] || 'bg-vylta-card text-vylta-muted border-border';

  const createdDate = new Date(tenant.created_at);
  const createdAgo = (() => {
    const days = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.floor(days / 30)} meses`;
    return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`;
  })();

  return (
    <tr className="group border-b border-border last:border-b-0 transition-colors hover:bg-vylta-card/30">
      {/* Negocio */}
      <td className="py-3 px-4">
        <Link href={`/admin/tenants/${tenant.user_id}`} className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-gold/10 text-[10px] font-bold text-vylta-gold ring-1 ring-vylta-gold/20">
            {getInitials(tenant.business_name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-vylta-bone group-hover:text-vylta-gold transition-colors">
              {tenant.business_name}
            </div>
            {tenant.business_type && (
              <div className="flex items-center gap-1 truncate text-[11px] text-vylta-muted">
                <Briefcase className="h-2.5 w-2.5" />
                {tenant.business_type}
              </div>
            )}
          </div>
        </Link>
      </td>

      {/* Contacto */}
      <td className="py-3 px-4">
        <div className="flex flex-col gap-0.5">
          {tenant.email && (
            <div className="flex items-center gap-1 text-[11px] text-vylta-muted">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{tenant.email}</span>
            </div>
          )}
          {tenant.phone && (
            <div className="flex items-center gap-1 text-[11px] text-vylta-muted">
              <Phone className="h-3 w-3" />
              {tenant.phone}
            </div>
          )}
          {!tenant.email && !tenant.phone && (
            <span className="text-[11px] text-vylta-subtle">Sin contacto</span>
          )}
        </div>
      </td>

      {/* Plan */}
      <td className="py-3 px-4">
        <div className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', planColors)}>
          {tenant.plan_label === 'Premium' && <Gem className="h-2.5 w-2.5" />}
          {tenant.plan_label === 'Luxury' && <Crown className="h-2.5 w-2.5" />}
          {tenant.plan_label}
        </div>
        {tenant.plan_price > 0 && (
          <div className="mt-0.5 text-[10px] tabular-nums text-vylta-subtle">
            ${tenant.plan_price}/mes
          </div>
        )}
      </td>

      {/* Citas */}
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <Calendar className="h-3 w-3 text-vylta-subtle" />
          <span className="text-sm font-bold tabular-nums text-vylta-bone">{tenant.appointments_count}</span>
        </div>
      </td>

      {/* Clientes */}
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <Users className="h-3 w-3 text-vylta-subtle" />
          <span className="text-sm font-bold tabular-nums text-vylta-bone">{tenant.clients_count}</span>
        </div>
      </td>

      {/* Actividad */}
      <td className="py-3 px-4">
        <div className="flex flex-col gap-0.5">
          {tenant.is_active_30d ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-vylta-green/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vylta-green" />
              </span>
              <span className="text-[11px] font-semibold text-vylta-green">
                {formatLastSeen(tenant.last_seen_at)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-vylta-subtle/40" />
              <span className="text-[11px] text-vylta-subtle">Inactivo</span>
            </div>
          )}
          <div className="text-[10px] text-vylta-subtle">Alta: hace {createdAgo}</div>
        </div>
      </td>

      {/* Arrow */}
      <td className="py-3 px-4">
        <ArrowRight className="h-4 w-4 text-vylta-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-vylta-gold" />
      </td>
    </tr>
  );
}

function PlanPill({
  label, sublabel, count, active, onClick, color, Icon,
}: {
  label: string;
  sublabel?: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: 'bone' | 'green' | 'luxury' | 'subtle';
  Icon?: any;
}) {
  const colorMap = {
    bone:   { active: 'border-vylta-bone/40 bg-vylta-bone/10 text-vylta-bone', count: 'bg-vylta-bone/15 text-vylta-bone' },
    green:  { active: 'border-vylta-green/40 bg-vylta-green/10 text-vylta-green', count: 'bg-vylta-green/20 text-vylta-green' },
    luxury: { active: 'border-vylta-luxury/40 bg-vylta-luxury/10 text-vylta-luxury', count: 'bg-vylta-luxury/20 text-vylta-luxury' },
    subtle: { active: 'border-vylta-subtle/40 bg-vylta-subtle/10 text-vylta-muted', count: 'bg-vylta-card text-vylta-muted' },
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
        active
          ? colorMap.active
          : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      <span>{label}</span>
      {sublabel && <span className="text-[10px] tabular-nums opacity-70">{sublabel}</span>}
      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', active ? colorMap.count : 'bg-vylta-card text-vylta-muted')}>
        {count}
      </span>
    </button>
  );
}
