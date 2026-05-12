'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  ArrowUpDown,
  ChevronDown,
  Loader2,
  Phone,
  Mail,
  UserPlus,
} from 'lucide-react';
import { fetchClients, getClientBadge, type Client, type ClientFilters } from '@/lib/clients';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { formatShortDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientDetailPanel } from '@/components/clients/client-detail-panel';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';

type Segment = NonNullable<ClientFilters['segment']>;

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'todos',      label: 'Todos' },
  { value: 'vip',        label: 'VIP' },
  { value: 'nuevos',     label: 'Nuevos' },
  { value: 'inactivos',  label: 'Inactivos' },
  { value: 'cumple-mes', label: 'Cumple este mes' },
];

type SortKey = NonNullable<ClientFilters['sortBy']>;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name',         label: 'Nombre (A-Z)' },
  { value: 'last_visit',   label: 'Última visita' },
  { value: 'total_spent',  label: 'Total gastado' },
  { value: 'created_at',   label: 'Más recientes' },
];

export default function ClientesPage() {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('todos');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function reload() {
    setLoading(true);
    const clients = await fetchClients({});
    setAllClients(clients);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    return applyFilters(allClients, { search, segment, sortBy, sortDir });
  }, [allClients, search, segment, sortBy, sortDir]);

  const currentSort = SORT_OPTIONS.find(s => s.value === sortBy);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Cargando...' : `${filtered.length} de ${allClients.length} clientes`}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setFormOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-vylta-green-500/50 focus:ring-2 focus:ring-vylta-green-500/20"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="h-10 shrink-0">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{currentSort?.label}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => {
                  if (sortBy === opt.value) {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy(opt.value);
                    setSortDir(opt.value === 'name' ? 'asc' : 'desc');
                  }
                }}
              >
                {opt.label}
                {sortBy === opt.value && (
                  <span className="ml-auto text-xs text-vylta-green-600">
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.value}
            onClick={() => setSegment(seg.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              segment === seg.value
                ? 'border-vylta-green-500 bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400'
                : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
            )}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasSearch={search.length > 0 || segment !== 'todos'}
            onCreate={() => setFormOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Contacto</Th>
                  <Th className="text-right">Citas</Th>
                  <Th className="text-right">Gastado</Th>
                  <Th>Última visita</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const badge = getClientBadge(client);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        'group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-secondary/50',
                        selectedClient?.id === client.id && 'bg-vylta-green-500/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-xs font-bold text-vylta-green-700 dark:text-vylta-green-400">
                            {getInitials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{client.name}</span>
                              {badge && (
                                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', badge.color)}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {client.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </span>
                          )}
                          {client.email && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                        {client.total_visits || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                        {formatCurrency(client.total_spent || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {client.last_visit ? formatShortDate(client.last_visit) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => reload()}
      />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </th>
  );
}

function EmptyState({ hasSearch, onCreate }: { hasSearch: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">
        {hasSearch ? 'Sin resultados' : 'Aún no tienes clientes'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasSearch
          ? 'Prueba con otra búsqueda o quita los filtros.'
          : 'Agrega tu primer cliente o espera a que agenden desde tu link público.'}
      </p>
      {!hasSearch && (
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <UserPlus className="h-4 w-4" />
          Agregar el primero
        </Button>
      )}
    </div>
  );
}

function applyFilters(clients: Client[], filters: ClientFilters): Client[] {
  let result = clients;

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q),
    );
  }

  if (filters.segment && filters.segment !== 'todos') {
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const currentMonth = new Date().getMonth();

    result = result.filter(c => {
      switch (filters.segment) {
        case 'vip':
          return (c.total_visits || 0) >= 5 || (c.total_spent || 0) >= 5000;
        case 'nuevos':
          return new Date(c.created_at).getTime() >= thirtyDaysAgo;
        case 'inactivos':
          if (!c.last_visit) return false;
          return new Date(c.last_visit).getTime() < sixtyDaysAgo;
        case 'cumple-mes':
          if (!c.birthday) return false;
          return new Date(c.birthday + 'T12:00:00').getMonth() === currentMonth;
        default:
          return true;
      }
    });
  }

  const sortBy = filters.sortBy || 'name';
  const dir = filters.sortDir === 'desc' ? -1 : 1;
  result = [...result].sort((a, b) => {
    let av: any = a[sortBy as keyof Client];
    let bv: any = b[sortBy as keyof Client];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });

  return result;
}
