'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  Calendar,
  Briefcase,
  LayoutDashboard,
  BarChart3,
  Settings,
  ArrowRight,
  Loader2,
  Phone,
} from 'lucide-react';
import { cn, getInitials, formatCurrency } from '@/lib/utils';
import { useClients } from '@/lib/queries/use-clients';
import { createClient } from '@/lib/supabase/client';
import { toLocalDateString, formatShortDate } from '@/lib/date-utils';

// ══════════════════════════════════════════════════════════════════════
// CommandPalette — búsqueda global ⌘K
//
// Estilo Linear/Notion/Vercel:
//   • Modal centrado con backdrop blur
//   • Input grande con auto-focus
//   • Resultados agrupados (Navegación / Clientes / Citas próximas)
//   • Navegación con teclado: ↑ ↓ Enter Esc
//   • Highlight del resultado actual
//
// Atajo: ⌘K (Mac) / Ctrl+K (Windows)
// ══════════════════════════════════════════════════════════════════════

interface SearchAppointment {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  status: string;
  service_cost: number | null;
  client_name: string;
  client_phone: string | null;
}

interface CommandItem {
  id: string;
  type: 'nav' | 'client' | 'appointment';
  label: string;
  description?: string;
  icon: any;
  href: string;
  meta?: React.ReactNode;
  iconColor?: string;
}

const NAV_ITEMS: CommandItem[] = [
  { id: 'nav-dashboard', type: 'nav', label: 'Inicio', icon: LayoutDashboard, href: '/dashboard', iconColor: 'text-vylta-green' },
  { id: 'nav-citas', type: 'nav', label: 'Citas', icon: Calendar, href: '/citas', iconColor: 'text-vylta-green' },
  { id: 'nav-clientes', type: 'nav', label: 'Clientes', icon: Users, href: '/clientes', iconColor: 'text-vylta-green' },
  { id: 'nav-servicios', type: 'nav', label: 'Servicios', icon: Briefcase, href: '/servicios', iconColor: 'text-vylta-green' },
  { id: 'nav-reportes', type: 'nav', label: 'Reportes', icon: BarChart3, href: '/reportes', iconColor: 'text-vylta-green' },
  { id: 'nav-config', type: 'nav', label: 'Configuración', icon: Settings, href: '/configuracion', iconColor: 'text-vylta-green' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [upcomingAppts, setUpcomingAppts] = useState<SearchAppointment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = useClients();

  // Cargar citas próximas (los próximos 30 días) al abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const today = toLocalDateString(new Date());
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const futureStr = toLocalDateString(future);
      const { data } = await supabase
        .from('appointments')
        .select('id, date, start_time, service_name, status, service_cost, client:clients(name, phone), client_name_temp, client_phone_temp')
        .eq('user_id', user.id)
        .gte('date', today)
        .lte('date', futureStr)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(50);
      if (cancelled || !data) return;
      setUpcomingAppts(data.map((a: any) => ({
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        service_name: a.service_name,
        status: a.status,
        service_cost: a.service_cost,
        client_name: a.client?.name || a.client_name_temp || 'Cliente',
        client_phone: a.client?.phone || a.client_phone_temp || null,
      })));
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Construir lista de items filtrados por búsqueda
  const items = useMemo<CommandItem[]>(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      // Sin búsqueda: mostrar navegación + clientes recientes (top 5) + citas próximas (top 5)
      const result: CommandItem[] = [...NAV_ITEMS];
      // Top 5 clientes más recientes
      clients.slice(0, 5).forEach(c => {
        result.push({
          id: `client-${c.id}`,
          type: 'client',
          label: c.name,
          description: c.phone || c.email || undefined,
          icon: Users,
          href: `/clientes?highlight=${c.id}`,
          iconColor: 'text-vylta-luxury',
        });
      });
      // Top 5 citas próximas
      upcomingAppts.slice(0, 5).forEach(a => {
        result.push({
          id: `apt-${a.id}`,
          type: 'appointment',
          label: `${a.client_name} · ${a.service_name}`,
          description: `${formatShortDate(a.date)} · ${a.start_time.slice(0, 5)}`,
          icon: Calendar,
          href: `/citas/${a.id}`,
          iconColor: 'text-vylta-sky',
        });
      });
      return result;
    }

    // Con búsqueda: filtrar todo por el query
    const result: CommandItem[] = [];

    // Navegación
    NAV_ITEMS.forEach(item => {
      if (item.label.toLowerCase().includes(q)) result.push(item);
    });

    // Clientes
    clients
      .filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q),
      )
      .slice(0, 8)
      .forEach(c => {
        result.push({
          id: `client-${c.id}`,
          type: 'client',
          label: c.name,
          description: c.phone || c.email || undefined,
          icon: Users,
          href: `/clientes?highlight=${c.id}`,
          iconColor: 'text-vylta-luxury',
        });
      });

    // Citas próximas
    upcomingAppts
      .filter(a =>
        a.client_name?.toLowerCase().includes(q) ||
        a.service_name?.toLowerCase().includes(q) ||
        a.client_phone?.includes(q),
      )
      .slice(0, 8)
      .forEach(a => {
        result.push({
          id: `apt-${a.id}`,
          type: 'appointment',
          label: `${a.client_name} · ${a.service_name}`,
          description: `${formatShortDate(a.date)} · ${a.start_time.slice(0, 5)}`,
          icon: Calendar,
          href: `/citas/${a.id}`,
          iconColor: 'text-vylta-sky',
        });
      });

    return result;
  }, [search, clients, upcomingAppts]);

  // Agrupar visualmente: navegación / clientes / citas
  const grouped = useMemo(() => {
    const navs = items.filter(i => i.type === 'nav');
    const cli = items.filter(i => i.type === 'client');
    const apts = items.filter(i => i.type === 'appointment');
    return { navs, cli, apts };
  }, [items]);

  // Reset activeIndex cuando cambia la lista
  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  // Keyboard handlers
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) {
          router.push(item.href);
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, items, activeIndex, router, onClose]);

  if (!open) return null;

  function handleSelect(item: CommandItem) {
    router.push(item.href);
    onClose();
  }

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[15vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-vylta-surface shadow-card-lg animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* INPUT */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-vylta-subtle" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar citas, clientes o ir a una sección..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-vylta-bone outline-none placeholder:text-vylta-subtle"
          />
          <kbd className="select-none rounded border border-border bg-vylta-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-vylta-muted">
            esc
          </kbd>
        </div>

        {/* RESULTADOS */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-vylta-muted">
              {search.trim() ? `Sin resultados para "${search}"` : 'Empieza a escribir...'}
            </div>
          ) : (
            <>
              {grouped.navs.length > 0 && (
                <Group label="Navegación">
                  {grouped.navs.map(item => {
                    runningIndex++;
                    const isActive = runningIndex === activeIndex;
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onSelect={() => handleSelect(item)}
                        onHover={() => setActiveIndex(runningIndex)}
                      />
                    );
                  })}
                </Group>
              )}
              {grouped.cli.length > 0 && (
                <Group label="Clientes">
                  {grouped.cli.map(item => {
                    runningIndex++;
                    const isActive = runningIndex === activeIndex;
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onSelect={() => handleSelect(item)}
                        onHover={() => setActiveIndex(runningIndex)}
                      />
                    );
                  })}
                </Group>
              )}
              {grouped.apts.length > 0 && (
                <Group label="Citas próximas">
                  {grouped.apts.map(item => {
                    runningIndex++;
                    const isActive = runningIndex === activeIndex;
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onSelect={() => handleSelect(item)}
                        onHover={() => setActiveIndex(runningIndex)}
                      />
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </div>

        {/* FOOTER con shortcuts */}
        <div className="flex items-center gap-3 border-t border-border bg-vylta-card/30 px-4 py-2 text-[10px] text-vylta-subtle">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-vylta-card px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-border bg-vylta-card px-1 font-mono">↓</kbd>
            navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-vylta-card px-1 font-mono">↵</kbd>
            abrir
          </span>
          <span className="ml-auto">VYLTA</span>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
        {label}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function ItemRow({
  item,
  isActive,
  onSelect,
  onHover,
}: {
  item: CommandItem;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
          isActive ? 'bg-vylta-card text-vylta-bone' : 'text-vylta-muted hover:bg-vylta-card/60',
        )}
      >
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded',
          item.type === 'nav' ? 'bg-vylta-green/10 ring-1 ring-vylta-green/20' :
          item.type === 'client' ? 'bg-vylta-luxury/10 ring-1 ring-vylta-luxury/20' :
          'bg-vylta-sky/10 ring-1 ring-vylta-sky/20',
          item.iconColor,
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.label}</div>
          {item.description && (
            <div className="truncate text-[11px] text-vylta-muted">{item.description}</div>
          )}
        </div>
        {isActive && (
          <ArrowRight className="h-3.5 w-3.5 text-vylta-muted" />
        )}
      </button>
    </li>
  );
}
