'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ═══════════════════════════════════════════════════════════════════════
// useMarketing — datos de la oficina de agentes (admin → Marketing)
//
// Lee las tablas mk_* (RLS: solo administradores) y se suscribe en tiempo
// real a la bitácora, los agentes, las publicaciones y las solicitudes,
// para que la oficina se mueva sola mientras los agentes trabajan.
// El trabajo y el chat pasan por la edge function mk-engine.
// ═══════════════════════════════════════════════════════════════════════

export type MkAgent = {
  id: string;
  name: string;
  title: string;
  rank: number;
  reports_to: string | null;
  zone: string;
  desk: number;
  model: string;
  effort: string;
  color: string;
  look: { skin?: string; hair?: string; hairStyle?: string; outfit?: string; tie?: string; glasses?: boolean };
  skills: string[];
  mission: string;
  status: 'idle' | 'working' | 'talking' | 'paused';
  current_action: string | null;
  enabled: boolean;
  hired_by: string;
  last_run_at: string | null;
};

export type MkActivity = {
  id: number;
  agent_id: string;
  kind: 'think' | 'work' | 'talk' | 'publish' | 'alert' | 'done' | 'system';
  text: string;
  target_agent: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type MkPost = {
  id: string;
  channel: 'facebook' | 'instagram';
  caption: string | null;
  image_url: string | null;
  scheduled_for: string | null;
  status: string;
  error: string | null;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
};

export type MkRequest = {
  id: string;
  kind: 'presupuesto' | 'contratacion' | 'anuncio';
  agent_id: string;
  title: string;
  justification: string;
  expected_results: string | null;
  amount_usd: number | null;
  payload: Record<string, unknown>;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  created_at: string;
};

export type MkMessage = { id: number; agent_id: string; sender: 'fundador' | 'agente'; body: string; created_at: string };
export type MkKnowledge = { slug: string; title: string; body: string; updated_by: string; updated_at: string };
export type MkTask = { id: string; title: string; assigned_to: string; created_by: string; status: string; result: string | null; kind: string; request: string | null; not_before: string; created_at: string; updated_at: string };

export type MkKpis = {
  registros_7d: number;
  registros_30d: number;
  registros_mes: number;
  negocios_total: number;
  pagados_activos: number;
  mrr_mxn: number;
  pagados_nuevos_mes: number;
  vencidos: number;
  posts_7d: number;
  gasto_mes_usd: number;
  tope_mes_usd: number;
};

export function useMarketing() {
  const supabase = useMemo(() => createClient(), []);
  const [agents, setAgents] = useState<MkAgent[]>([]);
  const [activity, setActivity] = useState<MkActivity[]>([]);
  const [posts, setPosts] = useState<MkPost[]>([]);
  const [requests, setRequests] = useState<MkRequest[]>([]);
  const [knowledge, setKnowledge] = useState<MkKnowledge[]>([]);
  const [tasks, setTasks] = useState<MkTask[]>([]);
  const [kpis, setKpis] = useState<MkKpis | null>(null);
  const [spendByAgent, setSpendByAgent] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const loadKpis = useCallback(async () => {
    const { data } = await supabase.rpc('mk_kpis');
    if (data) setKpis(data as MkKpis);
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: ledger } = await supabase.from('mk_ledger').select('agent_id,cost_usd').gte('created_at', monthStart.toISOString());
    const by: Record<string, number> = {};
    (ledger ?? []).forEach((r: any) => { by[r.agent_id] = (by[r.agent_id] ?? 0) + Number(r.cost_usd); });
    setSpendByAgent(by);
  }, [supabase]);

  const loadAll = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const [a, act, p, r, k, t, s] = await Promise.all([
      supabase.from('mk_agents').select('*').order('rank').order('name'),
      supabase.from('mk_activity').select('*').gte('created_at', since).order('id', { ascending: false }).limit(150),
      supabase.from('mk_posts').select('*').order('created_at', { ascending: false }).limit(40),
      supabase.from('mk_requests').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('mk_knowledge').select('slug,title,body,updated_by,updated_at').order('slug'),
      supabase.from('mk_tasks').select('id,title,assigned_to,created_by,status,result,kind,request,not_before,created_at,updated_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('mk_settings').select('key,value'),
    ]);
    setAgents((a.data ?? []) as MkAgent[]);
    setActivity((act.data ?? []) as MkActivity[]);
    setPosts((p.data ?? []) as MkPost[]);
    setRequests((r.data ?? []) as MkRequest[]);
    setKnowledge((k.data ?? []) as MkKnowledge[]);
    setTasks((t.data ?? []) as MkTask[]);
    setSettings(Object.fromEntries((s.data ?? []).map((x: any) => [x.key, x.value])));
    await loadKpis();
    setLoading(false);
  }, [supabase, loadKpis]);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel('mk-office')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mk_activity' }, (e) => {
        setActivity((prev) => [e.new as MkActivity, ...prev].slice(0, 200));
        // Cada avance puede mover tareas, gasto o publicaciones.
        if (['done', 'publish', 'work'].includes((e.new as MkActivity).kind)) {
          supabase.from('mk_tasks').select('id,title,assigned_to,created_by,status,result,kind,request,not_before,created_at,updated_at')
            .order('created_at', { ascending: false }).limit(80).then(({ data }) => data && setTasks(data as MkTask[]));
          loadKpis();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_agents' }, (e) => {
        const row = e.new as MkAgent;
        if (!row?.id) return;
        setAgents((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...prev, row]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_tasks' }, (e) => {
        const row = e.new as MkTask;
        if (!row?.id) return;
        setTasks((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...prev]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_posts' }, (e) => {
        const row = e.new as MkPost;
        if (!row?.id) return;
        setPosts((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? row : x)) : [row, ...prev]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_requests' }, (e) => {
        const row = e.new as MkRequest;
        if (!row?.id) return;
        setRequests((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? row : x)) : [row, ...prev]));
      })
      .subscribe();
    const kpiTimer = setInterval(loadKpis, 120_000);
    return () => { supabase.removeChannel(ch); clearInterval(kpiTimer); };
  }, [supabase, loadAll, loadKpis]);

  // ── Acciones del fundador ──
  const chat = useCallback(async (agentId: string, message: string) => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body: { action: 'chat', agent_id: agentId, message } });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
    loadKpis();
    return (data as { reply: string }).reply;
  }, [supabase, loadKpis]);

  const runNow = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body: { action: 'run_now' } });
    if (error) throw new Error(error.message);
    return data;
  }, [supabase]);

  const connectMeta = useCallback(async (userToken: string) => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body: { action: 'connect_meta', user_token: userToken } });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
    const status = (data as any).status;
    setSettings((s) => ({ ...s, meta_status: status }));
    return status;
  }, [supabase]);

  const setAgentEnabled = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase.from('mk_agents').update({ enabled, status: enabled ? 'idle' : 'paused' }).eq('id', id);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const setPaused = useCallback(async (paused: boolean) => {
    const value = { ...(settings.autopilot ?? {}), paused };
    const { error } = await supabase.from('mk_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'autopilot');
    if (error) throw new Error(error.message);
    setSettings((s) => ({ ...s, autopilot: value }));
  }, [supabase, settings]);

  const decideRequest = useCallback(async (id: string, approve: boolean, note?: string) => {
    const { error } = await supabase.from('mk_requests')
      .update({ status: approve ? 'aprobada' : 'rechazada', decision_note: note ?? null, decided_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const discardPost = useCallback(async (id: string) => {
    const { error } = await supabase.from('mk_posts').update({ status: 'descartado', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const loadThread = useCallback(async (agentId: string) => {
    const { data } = await supabase.from('mk_messages').select('*').eq('agent_id', agentId).order('created_at').limit(100);
    return (data ?? []) as MkMessage[];
  }, [supabase]);

  return {
    loading, agents, activity, posts, requests, knowledge, tasks, kpis, spendByAgent, settings,
    chat, runNow, connectMeta, setAgentEnabled, setPaused, decideRequest, discardPost, loadThread, reload: loadAll, supabase,
  };
}
