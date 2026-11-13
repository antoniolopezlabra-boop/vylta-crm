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
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folders,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ServiceFormDialog } from '@/components/services/service-form-dialog';
import { AutoGroupDialog } from '@/components/services/auto-group-dialog';
import { ServiceGroupsDialog } from '@/components/services/service-groups-dialog';
import { useServices, useToggleService, useInvalidateServices, type Service } from '@/lib/queries/use-services';
import {
  useServiceGroups,
  useServiceGroupActions,
  proposeAutoGroups,
  type ServiceGroup,
} from '@/lib/queries/use-service-groups';

// ════════════════════════════════════════════════════════════════════
// /servicios — catálogo de servicios, organizado por GRUPOS (nov 2026).
//
//   • Grupos plegables ("Pestañas", "Manos"...) + "Sin grupo" al final.
//   • Agrupar automáticamente: 1 clic, usa los nombres "Grupo-Servicio".
//   • Mover UNO: selector de grupo en cada servicio.
//   • Mover VARIOS: casillas (o "seleccionar todo el grupo/búsqueda") y la
//     barra inferior "Mover a…". Nada de ir uno por uno.
//   • Celular: tarjetas sin scroll horizontal (fix jun 2026 conservado).
// ════════════════════════════════════════════════════════════════════

const FALLBACK_COLORS = ['#10B981', '#A78BFA', '#F59E0B', '#F472B6', '#0EA5E9', '#818CF8', '#14B8A6', '#F43F5E'];
const NO_GROUP = '__none__';
const NEW_GROUP = '__new__';

interface Section {
  id: string; // group id o NO_GROUP
  name: string;
  services: Service[];
}

export default function ServiciosPage() {
  const { data: services = [], isLoading, isFetching } = useServices();
  const { data: groups = [] } = useServiceGroups();
  const { moveServices, createGroup } = useServiceGroupActions();
  const toggleMutation = useToggleService();
  const invalidate = useInvalidateServices();

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [newGroupName, setNewGroupName] = useState<string | null>(null);

  const activeServices = useMemo(() => services.filter(s => s.is_active), [services]);
  const inactiveServices = useMemo(() => services.filter(s => !s.is_active), [services]);
  const autoProposals = useMemo(() => proposeAutoGroups(services), [services]);

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

  const hasGroups = groups.length > 0;
  const searching = search.trim().length > 0;

  // Secciones: grupos en su orden + "Sin grupo". Vacías se ocultan.
  const sections: Section[] = useMemo(() => {
    const groupIds = new Set(groups.map(g => g.id));
    const list: Section[] = groups.map(g => ({
      id: g.id,
      name: g.name,
      services: filtered.filter(s => s.group_id === g.id),
    }));
    list.push({
      id: NO_GROUP,
      name: 'Sin grupo',
      services: filtered.filter(s => !s.group_id || !groupIds.has(s.group_id)),
    });
    return list.filter(sec => sec.services.length > 0);
  }, [groups, filtered]);

  const totalRevenue = activeServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const showFullLoader = isLoading && services.length === 0;
  const allExpanded = sections.every(sec => expanded.has(sec.id));

  const isOpen = (id: string) => !hasGroups || searching || expanded.has(id);

  function toggleSection(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllSections() {
    setExpanded(allExpanded ? new Set() : new Set(sections.map(s => s.id)));
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setManySelected(ids: string[], on: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setNewGroupName(null);
  }

  async function doMove(ids: string[], target: string) {
    const groupId = target === NO_GROUP ? null : target;
    const dest = groupId ? groups.find(g => g.id === groupId)?.name : 'Sin grupo';
    setMoving(true);
    try {
      await moveServices(ids, groupId);
      toast.success(
        ids.length === 1 ? `Movido a "${dest}"` : `${ids.length} servicios movidos a "${dest}"`,
      );
      if (groupId) setExpanded(prev => new Set(prev).add(groupId));
    } catch (err) {
      console.error('[move] error:', err);
      toast.error('No pudimos mover los servicios');
    } finally {
      setMoving(false);
    }
  }

  async function moveSelected(target: string) {
    if (target === NEW_GROUP) {
      setNewGroupName('');
      return;
    }
    await doMove(Array.from(selected), target);
    clearSelection();
  }

  async function createAndMove() {
    const name = (newGroupName || '').trim();
    if (!name) return;
    setMoving(true);
    try {
      const g = await createGroup(name);
      await moveServices(Array.from(selected), g.id);
      toast.success(`Grupo "${name}" creado con ${selected.size} servicios`);
      setExpanded(prev => new Set(prev).add(g.id));
      clearSelection();
    } catch (err) {
      console.error('[createAndMove] error:', err);
      toast.error('No pudimos crear el grupo');
    } finally {
      setMoving(false);
    }
  }

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

  const visibleIds = filtered.map(s => s.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  return (
    <div className={cn('space-y-5 animate-fade-in', selected.size > 0 && 'pb-28')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Briefcase className="h-5 w-5 text-vylta-green" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">Servicios</h1>
            <p className="text-sm text-vylta-muted flex items-center gap-2">
              {showFullLoader
                ? 'Cargando...'
                : `${activeServices.length} ${activeServices.length === 1 ? 'servicio activo' : 'servicios activos'}${hasGroups ? ` · ${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}` : ''}`}
              {isFetching && !showFullLoader && (
                <Loader2 className="h-3 w-3 animate-spin text-vylta-green/60" />
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {services.length > 0 && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setGroupsOpen(true)}>
              <Folders className="h-4 w-4" />
              Grupos
            </Button>
          )}
          <Button size="sm" className="shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      {!showFullLoader && services.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SmallStat label="Servicios activos" value={`${activeServices.length}`} icon={CheckCircle2} accent="green" />
          <SmallStat label="Inactivos" value={`${inactiveServices.length}`} icon={XCircle} />
          <SmallStat label="Valor catálogo activo" value={formatCurrency(totalRevenue)} icon={DollarSign} accent="green" />
        </div>
      )}

      {/* Sugerencia de agrupado automático */}
      {!showFullLoader && autoProposals.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-vylta-green/30 bg-vylta-green/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-0.5 h-5 w-5 shrink-0 text-vylta-green" />
            <div>
              <div className="text-sm font-semibold text-vylta-bone">
                {hasGroups ? 'Hay servicios que se pueden agrupar' : 'Organiza tus servicios en grupos'}
              </div>
              <p className="text-xs text-vylta-muted">
                Detectamos {autoProposals.length} {autoProposals.length === 1 ? 'grupo' : 'grupos'} por el nombre
                ({autoProposals.slice(0, 3).map(p => p.name).join(', ')}
                {autoProposals.length > 3 ? '…' : ''}). Tus clientes verán primero los grupos al reservar.
              </p>
            </div>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => setAutoOpen(true)}>
            <Wand2 className="h-4 w-4" />
            Agrupar automáticamente
          </Button>
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

      {/* Acciones de lista */}
      {!showFullLoader && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-vylta-muted hover:text-vylta-bone">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => setManySelected(visibleIds, e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-vylta-green"
            />
            {searching ? `Seleccionar los ${visibleIds.length} resultados` : 'Seleccionar todos'}
          </label>
          {hasGroups && !searching && (
            <button type="button" onClick={toggleAllSections} className="font-semibold text-vylta-green hover:underline">
              {allExpanded ? 'Contraer todos' : 'Expandir todos'}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {showFullLoader ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-vylta-surface py-20 shadow-card">
            <Loader2 className="h-6 w-6 animate-spin text-vylta-green" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-vylta-surface shadow-card">
            <EmptyState hasFilter={search.length > 0 || !showInactive} onCreate={openCreate} />
          </div>
        ) : (
          sections.map(sec => {
            const open = isOpen(sec.id);
            const ids = sec.services.map(s => s.id);
            const selInSec = ids.filter(id => selected.has(id)).length;
            return (
              <div key={sec.id} className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
                {hasGroups && (
                  <div className="flex items-center gap-3 border-b border-border bg-vylta-card/40 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar todo ${sec.name}`}
                      checked={selInSec === ids.length}
                      ref={(el) => { if (el) el.indeterminate = selInSec > 0 && selInSec < ids.length; }}
                      onChange={(e) => setManySelected(ids, e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-vylta-green"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={open}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-vylta-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-vylta-muted" />
                      )}
                      <FolderOpen className={cn('h-4 w-4 shrink-0', sec.id === NO_GROUP ? 'text-vylta-subtle' : 'text-vylta-green')} />
                      <span className={cn('truncate text-sm font-bold', sec.id === NO_GROUP ? 'text-vylta-muted' : 'text-vylta-bone')}>
                        {sec.name}
                      </span>
                      <span className="shrink-0 rounded-md bg-vylta-card px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-vylta-muted">
                        {sec.services.length}
                      </span>
                    </button>
                  </div>
                )}
                {open && (
                  <ul className="divide-y divide-border">
                    {sec.services.map((service, idx) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        color={colorForService(service, idx)}
                        groups={groups}
                        selected={selected.has(service.id)}
                        onSelect={() => toggleSelect(service.id)}
                        onEdit={() => openEdit(service)}
                        onToggle={(e) => handleToggle(service, e)}
                        onMove={(target) => doMove([service.id], target)}
                        disabled={moving}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Barra de acciones masivas */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-vylta-surface/95 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <span className="text-sm font-bold text-vylta-bone">
                {selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
            <div className="flex flex-1 items-center gap-2 sm:justify-end">
              {newGroupName === null ? (
                <select
                  value=""
                  disabled={moving}
                  onChange={(e) => e.target.value && moveSelected(e.target.value)}
                  className="h-10 w-full rounded-lg border border-vylta-green/40 bg-vylta-card px-3 text-sm font-semibold text-vylta-bone outline-none focus:ring-2 focus:ring-vylta-green/20 sm:w-64"
                >
                  <option value="">{moving ? 'Moviendo…' : 'Mover a grupo…'}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                  <option value={NO_GROUP}>Sin grupo</option>
                  <option value={NEW_GROUP}>+ Nuevo grupo…</option>
                </select>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); createAndMove(); }}
                  className="flex w-full gap-2 sm:w-auto"
                >
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nombre del grupo"
                    maxLength={60}
                    className="h-10 w-full rounded-lg border border-border bg-vylta-card px-3 text-sm text-vylta-bone outline-none focus:border-vylta-green/50 sm:w-56"
                  />
                  <Button type="submit" size="sm" className="h-10 shrink-0" disabled={moving || !newGroupName.trim()}>
                    {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear y mover'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingService(null);
        }}
        initialService={editingService}
        groups={groups}
        onSuccess={() => invalidate()}
      />
      <AutoGroupDialog open={autoOpen} onOpenChange={setAutoOpen} services={services} />
      <ServiceGroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} groups={groups} services={services} />
    </div>
  );
}

function ServiceRow({
  service,
  color,
  groups,
  selected,
  onSelect,
  onEdit,
  onToggle,
  onMove,
  disabled,
}: {
  service: Service;
  color: string;
  groups: ServiceGroup[];
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onMove: (target: string) => void;
  disabled: boolean;
}) {
  const groupSelect = groups.length > 0 && (
    <select
      value={service.group_id && groups.some(g => g.id === service.group_id) ? service.group_id : NO_GROUP}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onMove(e.target.value)}
      aria-label="Grupo del servicio"
      title="Cambiar de grupo"
      className="h-8 max-w-[11rem] truncate rounded-md border border-border bg-vylta-card/60 px-2 text-xs text-vylta-bone outline-none hover:border-vylta-green/40 focus:ring-2 focus:ring-vylta-green/20"
    >
      {groups.map(g => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
      <option value={NO_GROUP}>Sin grupo</option>
    </select>
  );

  const statusBtn = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition hover:opacity-80',
        service.is_active
          ? 'bg-vylta-green/15 text-vylta-green hover:bg-vylta-green/25'
          : 'bg-vylta-card text-vylta-muted hover:bg-vylta-card/80',
      )}
      title={service.is_active ? 'Click para desactivar' : 'Click para activar'}
    >
      {service.is_active ? (
        <><CheckCircle2 className="h-3 w-3" /> Activo</>
      ) : (
        <><Circle className="h-3 w-3" /> Inactivo</>
      )}
    </button>
  );

  return (
    <li
      onClick={onEdit}
      className={cn(
        'group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-vylta-card/40 lg:items-center',
        selected && 'bg-vylta-green/5',
        !service.is_active && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onSelect}
        aria-label={`Seleccionar ${service.name}`}
        className="mt-3 h-4 w-4 shrink-0 cursor-pointer accent-vylta-green lg:mt-0"
      />
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Briefcase className="h-4 w-4" />
      </div>

      {/* Escritorio */}
      <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-vylta-bone">{service.name}</div>
          {service.description && <div className="truncate text-xs text-vylta-muted">{service.description}</div>}
        </div>
        <span className="inline-flex w-20 shrink-0 items-center gap-1 text-sm text-vylta-muted">
          <Clock className="h-3.5 w-3.5" />
          {service.duration_minutes} min
        </span>
        <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-vylta-green">
          {formatCurrency(service.price)}
        </span>
        <div className="w-44 shrink-0">{groupSelect}</div>
        <div className="w-24 shrink-0 text-center">{statusBtn}</div>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-vylta-subtle opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Celular */}
      <div className="min-w-0 flex-1 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-vylta-bone">{service.name}</div>
            {service.description && <div className="mt-0.5 truncate text-xs text-vylta-muted">{service.description}</div>}
          </div>
          <div className="shrink-0 text-base font-bold tabular-nums text-vylta-green">
            {formatCurrency(service.price)}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-vylta-muted">
            <Clock className="h-3.5 w-3.5" />
            {service.duration_minutes} min
          </span>
          {statusBtn}
          {groupSelect}
        </div>
      </div>
    </li>
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
