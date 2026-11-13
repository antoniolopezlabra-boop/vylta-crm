'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useServices, type Service } from '@/lib/queries/use-services';
import { useServiceGroups } from '@/lib/queries/use-service-groups';

// ══════════════════════════════════════════════════════════════════════
// "¿Qué servicios realiza?" dentro del formulario del colaborador.
//   • Todos los servicios (default, como siempre)
//   • Solo algunos → lista por grupos, con casilla por grupo completo,
//     buscador y "todos / ninguno". Nada de ir uno por uno.
// ══════════════════════════════════════════════════════════════════════

export interface StaffServicesValue {
  servesAll: boolean;
  serviceIds: string[];
}

const NO_GROUP = '__none__';

export function StaffServicesSection({
  staffName,
  value,
  onChange,
}: {
  staffName: string;
  value: StaffServicesValue;
  onChange: (v: StaffServicesValue) => void;
}) {
  const { data: services = [] } = useServices();
  const { data: groups = [] } = useServiceGroups();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const active = useMemo(() => services.filter(s => s.is_active), [services]);
  const selected = useMemo(() => new Set(value.serviceIds), [value.serviceIds]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? active.filter(s => s.name.toLowerCase().includes(q)) : active;
  }, [active, search]);

  const sections = useMemo(() => {
    const ids = new Set(groups.map(g => g.id));
    const out = groups
      .map(g => ({ id: g.id, name: g.name, items: visible.filter(s => s.group_id === g.id) }))
      .filter(x => x.items.length);
    const rest = visible.filter(s => !s.group_id || !ids.has(s.group_id));
    if (rest.length) out.push({ id: NO_GROUP, name: groups.length ? 'Sin grupo' : 'Servicios', items: rest });
    return out;
  }, [groups, visible]);

  const countSel = active.filter(s => selected.has(s.id)).length;
  const grouped = groups.length > 0;
  const searching = search.trim().length > 0;

  function setIds(ids: Set<string>) {
    onChange({ servesAll: false, serviceIds: Array.from(ids) });
  }
  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setIds(next);
  }
  function setMany(items: Service[], on: boolean) {
    const next = new Set(selected);
    items.forEach(s => (on ? next.add(s.id) : next.delete(s.id)));
    setIds(next);
  }
  function toggleOpen(id: string) {
    setOpen(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs font-semibold">
        <ListChecks className="h-3 w-3 text-muted-foreground" />
        Servicios que realiza
      </Label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <OptionCard
          active={value.servesAll}
          title="Todos los servicios"
          desc="Puede atender cualquier servicio"
          onClick={() => onChange({ servesAll: true, serviceIds: value.serviceIds })}
        />
        <OptionCard
          active={!value.servesAll}
          title="Solo algunos"
          desc={`Elige qué sabe hacer ${staffName || 'este colaborador'}`}
          onClick={() => onChange({ servesAll: false, serviceIds: value.serviceIds })}
        />
      </div>

      {!value.servesAll && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
            <div className="relative min-w-[10rem] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar servicio..."
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button type="button" onClick={() => setMany(visible, true)} className="rounded-md px-2 py-1 text-xs font-semibold text-vylta-green hover:bg-vylta-green/10">
              {searching ? 'Marcar resultados' : 'Todos'}
            </button>
            <button type="button" onClick={() => setMany(visible, false)} className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary">
              Ninguno
            </button>
          </div>

          <div className={cn(
            'px-3 py-1.5 text-xs font-semibold',
            countSel === 0 ? 'text-destructive' : 'text-vylta-green',
          )}>
            {countSel === 0
              ? 'Marca al menos un servicio (si no, no aparecerá en las reservas en línea)'
              : `${countSel} de ${active.length} servicios`}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {sections.map(sec => {
              const ids = sec.items.map(s => s.id);
              const n = ids.filter(id => selected.has(id)).length;
              const isOpen = !grouped || searching || open.has(sec.id);
              return (
                <div key={sec.id} className="border-t border-border first:border-t-0">
                  {grouped && (
                    <div className="flex items-center gap-2 bg-secondary/40 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={n === ids.length}
                        ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }}
                        onChange={(e) => setMany(sec.items, e.target.checked)}
                        aria-label={`Marcar todo ${sec.name}`}
                        className="h-4 w-4 cursor-pointer accent-vylta-green-500"
                      />
                      <button type="button" onClick={() => toggleOpen(sec.id)} className="flex flex-1 items-center gap-1.5 text-left">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-sm font-semibold">{sec.name}</span>
                        <span className="text-xs text-muted-foreground">{n}/{ids.length}</span>
                      </button>
                    </div>
                  )}
                  {isOpen && sec.items.map(s => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 pl-8 text-sm hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 cursor-pointer accent-vylta-green-500"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
            {sections.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">Sin servicios que coincidan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-left transition',
        active ? 'border-vylta-green-500 bg-vylta-green-500/10' : 'border-border bg-card hover:bg-secondary/40',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={cn('h-3.5 w-3.5 rounded-full border-2', active ? 'border-vylta-green-500 bg-vylta-green-500' : 'border-muted-foreground')} />
        {title}
      </div>
      <div className="mt-0.5 pl-[22px] text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
