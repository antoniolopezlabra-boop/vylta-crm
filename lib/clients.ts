import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// Tipos y queries para clientes
//
// Lógica replicada de la app móvil para que ambas plataformas vean
// exactamente los mismos datos.
// ══════════════════════════════════════════════════════════════════════

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  birthday: string | null;
  total_appointments: number;
  total_spent: number;
  last_visit: string | null;
  created_at: string;
  tags: string[] | null;
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
  paid: boolean | null;
}

/**
 * Carga la lista de clientes del usuario con filtros aplicados.
 * Hace una sola query y filtra/ordena en memoria (ok para <10K clientes).
 */
export async function fetchClients(filters: ClientFilters = {}): Promise<Client[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id);

  if (error || !data) return [];

  let clients = data as Client[];

  // ── Filtro: búsqueda por nombre, teléfono o email ──
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    clients = clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q),
    );
  }

  // ── Filtro: segmento ──
  if (filters.segment && filters.segment !== 'todos') {
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const currentMonth = new Date().getMonth();

    clients = clients.filter(c => {
      switch (filters.segment) {
        case 'vip':
          // VIP: 5+ citas o $5,000+ gastados
          return (c.total_appointments || 0) >= 5 || (c.total_spent || 0) >= 5000;
        case 'nuevos':
          // Nuevos: creados en últimos 30 días
          return new Date(c.created_at).getTime() >= thirtyDaysAgo;
        case 'inactivos':
          // Inactivos: sin venir 60+ días
          if (!c.last_visit) return false;
          return new Date(c.last_visit).getTime() < sixtyDaysAgo;
        case 'cumple-mes':
          // Cumpleañeros: cumpleñaos en el mes actual
          if (!c.birthday) return false;
          return new Date(c.birthday + 'T12:00:00').getMonth() === currentMonth;
        default:
          return true;
      }
    });
  }

  // ── Ordenamiento ──
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

/**
 * Carga el historial de citas de un cliente específico.
 */
export async function fetchClientAppointments(clientId: string): Promise<ClientAppointment[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('appointments')
    .select('id, date, start_time, service_name, status, service_cost, paid')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  return (data || []) as ClientAppointment[];
}

/** Determina el segmento principal de un cliente para mostrar badge. */
export function getClientBadge(client: Client): { label: string; color: string } | null {
  const totalApts = client.total_appointments || 0;
  const totalSpent = client.total_spent || 0;

  if (totalApts >= 5 || totalSpent >= 5000) {
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
