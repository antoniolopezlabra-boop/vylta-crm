import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para clientes
//
// HALLAZGO: Los campos clients.total_visits y clients.last_visit son
// mantenidos por la app móvil vía triggers (al cobrar/completar cita).
// Si esos triggers no corrieron para citas viejas, los campos quedan
// en 0/null. Para el CRM web los CALCULAMOS desde appointments en vivo,
// igual que total_spent. Los "computed" son la fuente de verdad.
// ══════════════════════════════════════════════════════════════════════

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  birthday: string | null;
  is_active: boolean;
  total_visits: number;  // ← calculado en cliente desde appointments
  last_visit: string | null;  // ← calculado en cliente desde appointments
  created_at: string;
  total_spent?: number;  // ← calculado en cliente desde appointments
}

export interface ClientFilters {
  search?: string;
  segment?: 'todos' | 'vip' | 'nuevos' | 'inactivos' | 'cumple-mes';
  sortBy?: 'name' | 'last_visit' | 'total_spent' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

export interface ClientAppointment {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  status: string;
  service_cost: number | null;
}

// Status que cuentan como "visita realizada" (paga o no, pero asistió)
const VISITED_STATUSES = ['Pagado', 'Completada'];
const PAID_STATUSES = ['Pagado', 'Completada'];

/**
 * Carga clientes y calcula desde appointments:
 *   • total_visits  = # de citas con status Pagado/Completada
 *   • last_visit    = fecha más reciente de Pagado/Completada
 *   • total_spent   = suma de service_cost de Pagado/Completada
 */
export async function fetchClients(filters: ClientFilters = {}): Promise<Client[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Carga en paralelo: clientes + citas (solo las visitadas) para agregar
  const [clientsRes, apptsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id),
    supabase
      .from('appointments')
      .select('client_id, service_cost, status, date')
      .eq('user_id', user.id)
      .in('status', VISITED_STATUSES),
  ]);

  if (clientsRes.error) {
    console.error('[fetchClients] Error:', clientsRes.error);
    return [];
  }
  if (apptsRes.error) {
    console.warn('[fetchClients] Appointments query error:', apptsRes.error);
  }

  // Acumulador por cliente: { visits, spent, lastVisit }
  const aggMap = new Map<string, { visits: number; spent: number; lastVisit: string | null }>();
  (apptsRes.data || []).forEach((a: any) => {
    if (!a.client_id) return;
    const prev = aggMap.get(a.client_id) || { visits: 0, spent: 0, lastVisit: null };
    const newLast = !prev.lastVisit || (a.date && a.date > prev.lastVisit) ? a.date : prev.lastVisit;
    aggMap.set(a.client_id, {
      visits: prev.visits + 1,
      spent: prev.spent + (PAID_STATUSES.includes(a.status) ? (a.service_cost || 0) : 0),
      lastVisit: newLast,
    });
  });

  let clients: Client[] = (clientsRes.data || []).map((c: any) => {
    const agg = aggMap.get(c.id);
    return {
      ...c,
      // Preferir el cálculo del CRM sobre el campo de BD si difieren.
      // Si el campo de BD tiene un valor más alto (porque el trigger funcionó
      // alguna vez y no se reflejó aquí), nos quedamos con el máximo.
      total_visits: Math.max(agg?.visits || 0, c.total_visits || 0),
      last_visit: agg?.lastVisit || c.last_visit || null,
      total_spent: agg?.spent || 0,
      is_active: c.is_active !== false,
    };
  });

  // Filtros
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    clients = clients.filter(c =>
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

    clients = clients.filter(c => {
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
  clients.sort((a, b) => {
    let av: any = a[sortBy as keyof Client];
    let bv: any = b[sortBy as keyof Client];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });

  return clients;
}

export async function fetchClientAppointments(clientId: string): Promise<ClientAppointment[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('appointments')
    .select('id, date, start_time, service_name, status, service_cost')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  return (data || []) as ClientAppointment[];
}

export function getClientBadge(client: Client): { label: string; color: string } | null {
  const totalVisits = client.total_visits || 0;
  const totalSpent = client.total_spent || 0;

  if (totalVisits >= 5 || totalSpent >= 5000) {
    return { label: 'VIP', color: 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400' };
  }

  const created = new Date(client.created_at).getTime();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (created >= thirtyDaysAgo) {
    return { label: 'Nuevo', color: 'bg-vylta-green-500/15 text-vylta-green-600 dark:text-vylta-green-400' };
  }

  if (client.last_visit) {
    const lastVisit = new Date(client.last_visit).getTime();
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    if (lastVisit < sixtyDaysAgo) {
      return { label: 'Inactivo', color: 'bg-vylta-rose-500/15 text-rose-600 dark:text-rose-400' };
    }
  }

  return null;
}
