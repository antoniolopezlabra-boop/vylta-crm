import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para clientes
//
// Schema alineado con la app móvil:
//   • total_visits (NO total_appointments)
//   • last_visit
//   • is_active
//   • NO tiene tags ni total_spent en la tabla — los calculamos.
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
  total_visits: number;
  last_visit: string | null;
  created_at: string;
  // Calculados en cliente:
  total_spent?: number;
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

/**
 * Carga clientes + calcula total_spent agregando service_cost de citas
 * con status Pagado/Completada.
 */
export async function fetchClients(filters: ClientFilters = {}): Promise<Client[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Carga en paralelo: clientes + agregación de gastos
  const [clientsRes, apptsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id),
    supabase.from('appointments').select('client_id, service_cost, status').eq('user_id', user.id).in('status', ['Pagado', 'Completada']),
  ]);

  if (clientsRes.error) {
    console.error('[fetchClients] Error:', clientsRes.error);
    return [];
  }

  // Calcular total_spent por cliente desde las citas pagadas
  const spentMap = new Map<string, number>();
  (apptsRes.data || []).forEach((a: any) => {
    if (a.client_id) {
      spentMap.set(a.client_id, (spentMap.get(a.client_id) || 0) + (a.service_cost || 0));
    }
  });

  let clients: Client[] = (clientsRes.data || []).map((c: any) => ({
    ...c,
    total_visits: c.total_visits || 0,
    is_active: c.is_active !== false,
    total_spent: spentMap.get(c.id) || 0,
  }));

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
