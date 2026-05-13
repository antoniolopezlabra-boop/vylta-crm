'use client';

import { useMemo, useState } from 'react';
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
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ServiceFormDialog } from '@/components/services/service-form-dialog';
import { useServices, useToggleService, useInvalidateServices, type Service } from '@/lib/queries/use-services';

const FALLBACK_COLORS = ['#10B981', '#A78BFA', '#F59E0B', '#F472B6', '#0EA5E9', '#818CF8', '#14B8A6', '#F43F5E'];

export default function ServiciosPage() {
  const { data: services = [], isLoading, isFetching } = useServices();
  const toggleMutation = useToggleService();
  const invalidate = useInvalidateServices();

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const activeServices = useMemo(() => services.filter(s => s.is_active), [services]);
  const inactiveServices = useMemo(() => services.filter(s => !s.is_active), [services]);

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

  const totalRevenue = activeServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const showFullLoader = isLoading && services.length === 0;

  function openCreate() {
    setEditingService(null);
    setFormOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setFormOpen(true);
  }

  async function handleToggle(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await toggleMutation.mutateAsync(service);
      toast.success(service.is_active ? 'Servicio desactivado' : 'Servicio activado');
    } catch (err) {
      console.error('[toggle] error:', err);
      toast.error('No pudimos cambiar el estado');
    }
  }

  function colorForService(s: Service, idx: number): string {
    return s.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Briefcase className="h-5 w-5 text-vylta-green" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">Servicios</h1>
            <p className="text-sm text-vylta-muted flex items-center gap-2">
              {showFullLoader ? 'Cargando...' : `${activeServices.length} ${activeServices.length === 1 ? 'servicio activo' : 'servicios activos'}`}
              {isFetching && !showFullLoader && (
                <Loader2 className="h-3 w-3 animate-spin text-vylta-green/60" />
              )}
            </p>
          </div>
        </div>
        <Button size="sm" className="shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      {!showFullLoader && services.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SmallStat label="Servicios activos" value={`${activeServices.length}`} icon={CheckCircle2} accent="green" />
          <SmallStat label="Inactivos" value={`${inactiveServices.length}`} icon={XCircle} />
          <SmallStat label="Valor catálogo activo" value={formatCurrency(totalRevenue)} icon={DollarSign} accent="green" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
          <input
            type="text"
            placeholder="Buscar servicios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-vylta-card/60 pl-10 pr-3 text-sm text-vylta-bone outline-none transition-colors placeholder:text-vylta-subtle hover:border-vylta-green/30 focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-vylta-card/60 px-3 py-2 text-sm cursor-pointer hover:bg-vylta-card transition">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-border accent-vylta-green"
          />
          <span className="font-medium text-vylta-bone">Mostrar inactivos</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        {showFullLoader ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-vylta-green" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={search.length > 0 || !showInactive} onCreate={openCreate} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-vylta-card/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">Servicio</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">Duración</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">Precio</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">Estado</th>
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
                        'group cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-vylta-card/40',
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
                            <div className="truncate text-sm font-semibold text-vylta-bone">{service.name}</div>
                            {service.description && (
                              <div className="truncate text-xs text-vylta-muted">{service.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-vylta-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duration_minutes} min
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-vylta-green">
                        {formatCurrency(service.price)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleToggle(service, e)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition hover:opacity-80',
                            service.is_active
                              ? 'bg-vylta-green/15 text-vylta-green hover:bg-vylta-green/25'
                              : 'bg-vylta-card text-vylta-muted hover:bg-vylta-card/80',
                          )}
                          title={service.is_active ? 'Click para desactivar' : 'Click para activar'}
                        >
                          {service.is_active ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Activo
                            </>
                          ) : (
                            <>
                              <Circle className="h-3 w-3" />
                              Inactivo
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Pencil className="h-3.5 w-3.5 text-vylta-subtle opacity-0 transition-opacity group-hover:opacity-100" />
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
        onSuccess={() => invalidate()}
      />
    </div>
  );
}

function SmallStat({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: 'green' }) {
  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">
        <Icon className={cn('h-3.5 w-3.5', accent === 'green' && 'text-vylta-green')} />
        {label}
      </div>
      <div className={cn('mt-1 text-xl font-bold tabular-nums', accent === 'green' ? 'text-vylta-green' : 'text-vylta-bone')}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ hasFilter, onCreate }: { hasFilter: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
        <Briefcase className="h-6 w-6 text-vylta-green" />
      </div>
      <h3 className="text-base font-semibold text-vylta-bone">
        {hasFilter ? 'Sin resultados' : 'Aún no tienes servicios'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-vylta-muted">
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
