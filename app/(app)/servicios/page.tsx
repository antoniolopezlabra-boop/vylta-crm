'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Clock,
  DollarSign,
  Loader2,
  CheckCircle2,
  Circle,
  Pencil,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ServiceFormDialog } from '@/components/services/service-form-dialog';

// ══════════════════════════════════════════════════════════════════════
// /servicios — alineado con schema real:
//   • is_active (no 'active')
//   • NO existe 'color' — lo simulamos en cliente para el avatar
// ══════════════════════════════════════════════════════════════════════

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category?: string | null;
  color?: string | null;
}

const FALLBACK_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#F472B6', '#3B82F6', '#A855F7', '#14B8A6', '#EF4444'];

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  async function reload() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });
    if (error) console.error('[services] reload error:', error);
    setServices((data || []) as Service[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    let result = services;
    if (!showInactive) result = result.filter(s => s.is_active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [services, search, showInactive]);

  const activeCount = services.filter(s => s.is_active).length;
  const totalRevenue = services.filter(s => s.is_active).reduce((sum, s) => sum + (s.price || 0), 0);

  function openCreate() {
    setEditingService(null);
    setFormOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setFormOpen(true);
  }

  function colorForService(s: Service, idx: number): string {
    return s.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Cargando...' : `${activeCount} servicios activos`}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      {!loading && services.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SmallStat label="Total servicios" value={`${services.length}`} icon={Briefcase} />
          <SmallStat label="Activos" value={`${activeCount}`} icon={CheckCircle2} accent="green" />
          <SmallStat label="Valor catálogo" value={formatCurrency(totalRevenue)} icon={DollarSign} accent="green" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar servicios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-vylta-green-500/50 focus:ring-2 focus:ring-vylta-green-500/20"
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50 transition">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-border accent-vylta-green-500"
          />
          <span className="font-medium">Mostrar inactivos</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={search.length > 0 || !showInactive} onCreate={openCreate} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Servicio</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Duración</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((service, idx) => {
                  const color = colorForService(service, idx);
                  return (
                    <tr
                      key={service.id}
                      onClick={() => openEdit(service)}
                      className={cn(
                        'group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-secondary/50',
                        !service.is_active && 'opacity-60',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${color}1A`, color }}
                          >
                            <Briefcase className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{service.name}</div>
                            {service.description && (
                              <div className="truncate text-xs text-muted-foreground">{service.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duration_minutes} min
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                        {formatCurrency(service.price)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {service.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-vylta-green-500/10 px-2 py-0.5 text-xs font-semibold text-vylta-green-700 dark:text-vylta-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            <Circle className="h-3 w-3" />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingService(null);
        }}
        initialService={editingService}
        onSuccess={() => reload()}
      />
    </div>
  );
}

function SmallStat({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: 'green' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', accent === 'green' && 'text-vylta-green-600 dark:text-vylta-green-400')} />
        {label}
      </div>
      <div className={cn('mt-1 text-xl font-bold tabular-nums', accent === 'green' && 'text-vylta-green-600 dark:text-vylta-green-400')}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ hasFilter, onCreate }: { hasFilter: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
        <Briefcase className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">
        {hasFilter ? 'Sin resultados' : 'Aún no tienes servicios'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasFilter
          ? 'Prueba con otra búsqueda o quita los filtros.'
          : 'Agrega los servicios que ofreces para empezar a recibir reservas.'}
      </p>
      {!hasFilter && (
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Crear el primero
        </Button>
      )}
    </div>
  );
}
