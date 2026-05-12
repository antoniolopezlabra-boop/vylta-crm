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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ══════════════════════════════════════════════════════════════════════
// /servicios — Catálogo de servicios del negocio
//
// Tabla con: nombre, duración, precio, estado (activo/inactivo).
// Búsqueda en vivo + botón agregar.
// ══════════════════════════════════════════════════════════════════════

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
  category: string | null;
  color: string | null;
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
        .order('active', { ascending: false })
        .order('name', { ascending: true });
      if (!cancelled) {
        setServices((data || []) as Service[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = services;
    if (!showInactive) result = result.filter(s => s.active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [services, search, showInactive]);

  const activeCount = services.filter(s => s.active).length;
  const totalRevenue = services.filter(s => s.active).reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Cargando...' : `${activeCount} servicios activos`}
          </p>
        </div>
        <Button size="sm" className="shrink-0">
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      {/* Stats */}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SmallStat label="Total servicios" value={`${services.length}`} icon={Briefcase} />
          <SmallStat label="Activos" value={`${activeCount}`} icon={CheckCircle2} accent="green" />
          <SmallStat label="Valor catálogo" value={formatCurrency(totalRevenue)} icon={DollarSign} accent="green" />
        </div>
      )}

      {/* Search + filtros */}
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

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={search.length > 0 || !showInactive} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Servicio</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Duración</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((service) => (
                  <tr
                    key={service.id}
                    className={cn(
                      'group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-secondary/50',
                      !service.active && 'opacity-60',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `${service.color || '#10B981'}1A`,
                            color: service.color || '#10B981',
                          }}
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
                      {service.active ? (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: 'green';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', accent === 'green' && 'text-vylta-green-600 dark:text-vylta-green-400')} />
        {label}
      </div>
      <div className={cn(
        'mt-1 text-xl font-bold tabular-nums',
        accent === 'green' && 'text-vylta-green-600 dark:text-vylta-green-400',
      )}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
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
    </div>
  );
}
