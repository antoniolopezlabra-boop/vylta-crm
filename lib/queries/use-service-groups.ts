'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { SERVICES_KEY, type Service } from '@/lib/queries/use-services';

// ══════════════════════════════════════════════════════════════════════
// Grupos de servicios (nov 2026)
//
// Un negocio agrupa sus servicios ("Pestañas", "Manos"...). En el link
// público de reservas el cliente ve primero los grupos y al abrir uno ve
// sus servicios. services.group_id = NULL → "Sin grupo".
//
// Todas las operaciones masivas (mover N servicios, agrupar automático)
// se hacen con UNA actualización por grupo destino — no uno por uno.
// ══════════════════════════════════════════════════════════════════════

export interface ServiceGroup {
  id: string;
  name: string;
  sort_order: number;
}

export const SERVICE_GROUPS_KEY = 'service-groups';

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesión expirada');
  return user.id;
}

async function fetchGroups(): Promise<ServiceGroup[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('service_groups')
    .select('id,name,sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('[fetchGroups] error:', error);
    return [];
  }
  return (data || []) as ServiceGroup[];
}

export function useServiceGroups() {
  return useQuery<ServiceGroup[]>({
    queryKey: [SERVICE_GROUPS_KEY],
    queryFn: fetchGroups,
    staleTime: 5 * 60 * 1000,
  });
}

/** Acciones sobre grupos. Cada una refresca grupos + servicios al terminar. */
export function useServiceGroupActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: [SERVICE_GROUPS_KEY] }),
    qc.invalidateQueries({ queryKey: [SERVICES_KEY] }),
  ]);

  async function createGroup(name: string): Promise<ServiceGroup> {
    const supabase = createClient();
    const userId = await getUserId();
    const groups = qc.getQueryData<ServiceGroup[]>([SERVICE_GROUPS_KEY]) || [];
    const nextOrder = groups.reduce((m, g) => Math.max(m, g.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from('service_groups')
      .insert({ user_id: userId, name: name.trim(), sort_order: nextOrder })
      .select('id,name,sort_order')
      .single();
    if (error) throw error;
    await refresh();
    return data as ServiceGroup;
  }

  async function renameGroup(id: string, name: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('service_groups')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await refresh();
  }

  /** Borra el grupo. Sus servicios NO se borran: quedan "Sin grupo". */
  async function deleteGroup(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('service_groups').delete().eq('id', id);
    if (error) throw error;
    await refresh();
  }

  /** Guarda el orden completo de los grupos (índice = sort_order). */
  async function reorderGroups(orderedIds: string[]) {
    const supabase = createClient();
    // Optimista: la lista se reacomoda al instante.
    qc.setQueryData<ServiceGroup[]>([SERVICE_GROUPS_KEY], (old = []) => {
      const byId = new Map(old.map(g => [g.id, g]));
      return orderedIds
        .map((id, i) => {
          const g = byId.get(id);
          return g ? { ...g, sort_order: i } : null;
        })
        .filter(Boolean) as ServiceGroup[];
    });
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('service_groups').update({ sort_order: i }).eq('id', id),
      ),
    );
    const failed = results.find(r => r.error);
    await refresh();
    if (failed?.error) throw failed.error;
  }

  /** Mueve VARIOS servicios a un grupo (o a "Sin grupo" con null) en 1 llamada. */
  async function moveServices(serviceIds: string[], groupId: string | null) {
    if (!serviceIds.length) return;
    const supabase = createClient();
    const userId = await getUserId();
    // Optimista
    qc.setQueryData<Service[]>([SERVICES_KEY], (old = []) =>
      old.map(s => (serviceIds.includes(s.id) ? { ...s, group_id: groupId } : s)),
    );
    const { error } = await supabase
      .from('services')
      .update({ group_id: groupId, updated_at: new Date().toISOString() })
      .in('id', serviceIds)
      .eq('user_id', userId);
    await refresh();
    if (error) throw error;
  }

  /**
   * Agrupa automáticamente: crea los grupos propuestos (o reutiliza uno que
   * ya exista con el mismo nombre) y mueve sus servicios. Una llamada por grupo.
   */
  async function applyAutoGroups(proposals: AutoGroupProposal[]) {
    const supabase = createClient();
    const userId = await getUserId();
    const existing = await fetchGroups();
    const byKey = new Map(existing.map(g => [groupKey(g.name), g]));
    let order = existing.reduce((m, g) => Math.max(m, g.sort_order), -1) + 1;

    for (const p of proposals) {
      let group = byKey.get(groupKey(p.name));
      if (!group) {
        const { data, error } = await supabase
          .from('service_groups')
          .insert({ user_id: userId, name: p.name, sort_order: order++ })
          .select('id,name,sort_order')
          .single();
        if (error) throw error;
        group = data as ServiceGroup;
        byKey.set(groupKey(group.name), group);
      }
      const { error } = await supabase
        .from('services')
        .update({ group_id: group.id, updated_at: new Date().toISOString() })
        .in('id', p.serviceIds)
        .eq('user_id', userId);
      if (error) throw error;
    }
    await refresh();
  }

  return { createGroup, renameGroup, deleteGroup, reorderGroups, moveServices, applyAutoGroups };
}

// ── Agrupado automático por nombre ────────────────────────────────────
// Muchos negocios ya nombran sus servicios "Grupo-Servicio" o
// "Grupo - Servicio" (p. ej. "Pestañas-Clásicas", "Corte - Caballero").
// Proponemos un grupo por cada prefijo que se repita en 2+ servicios.

export interface AutoGroupProposal {
  name: string;
  serviceIds: string[];
  sample: string[];
}

/** Clave para comparar nombres sin importar mayúsculas, acentos ni espacios. */
export function groupKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function prefixOf(name: string): string | null {
  const idx = name.indexOf('-');
  if (idx <= 0) return null;
  const prefix = name.slice(0, idx).trim();
  const rest = name.slice(idx + 1).trim();
  if (prefix.length < 2 || prefix.length > 40 || !rest) return null;
  return prefix;
}

export function proposeAutoGroups(services: Service[], onlyUngrouped = true): AutoGroupProposal[] {
  const buckets = new Map<string, { names: Map<string, number>; ids: string[]; sample: string[] }>();
  for (const s of services) {
    if (onlyUngrouped && s.group_id) continue;
    const prefix = prefixOf(s.name || '');
    if (!prefix) continue;
    const key = groupKey(prefix);
    let b = buckets.get(key);
    if (!b) {
      b = { names: new Map(), ids: [], sample: [] };
      buckets.set(key, b);
    }
    b.names.set(prefix, (b.names.get(prefix) || 0) + 1);
    b.ids.push(s.id);
    if (b.sample.length < 3) b.sample.push(s.name);
  }
  const proposals: AutoGroupProposal[] = [];
  buckets.forEach(b => {
    if (b.ids.length < 2) return;
    // Nombre a mostrar: la escritura más usada del prefijo.
    let best = '';
    let bestN = -1;
    b.names.forEach((n, label) => {
      if (n > bestN) { best = label; bestN = n; }
    });
    proposals.push({ name: best, serviceIds: b.ids, sample: b.sample });
  });
  return proposals.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
