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
  tools: string[];
  objectives: string[];
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

export type MkMessage = { id: number; agent_id: string; sender: 'fundador' | 'agente' | 'sistema'; body: string; created_at: string; meeting_id?: string | null; attachments?: string[] };
export type MkComment = {
  id: string; channel: 'facebook' | 'instagram'; post_id: string | null; author: string | null; text: string; commented_at: string | null;
  status: 'nuevo' | 'respondido' | 'escalado' | 'ignorado' | 'oculto'; reply_text: string | null; replied_at: string | null; handled_by: string | null; note: string | null;
};
export type MkMeeting = { id: string; topic: string; attendees: string[]; status: 'en_curso' | 'terminada'; created_at: string; ended_at: string | null };
export type MkProjection = {
  id: string; meeting_id: string | null; agent_id: string; created_at: string; title: string;
  kind: 'publicaciones' | 'resultados' | 'presentacion' | 'imagenes' | 'video' | 'grafica';
  payload: Record<string, any>;
};
export type MkKnowledge = { slug: string; title: string; body: string; updated_by: string; updated_at: string };
export type MkTask = { id: string; title: string; assigned_to: string; created_by: string; status: string; result: string | null; kind: string; request: string | null; not_before: string; created_at: string; updated_at: string };

export type MkInnovation = {
  id: string; week: string; area: string; target_agent: string | null;
  kind: 'mejorar_agente' | 'nueva_herramienta' | 'nuevo_puesto' | 'proceso' | 'producto';
  title: string; que_es: string; para_que: string; como_funciona: string; extra: string | null;
  impacto: string | null; costo: string | null; esfuerzo: 'bajo' | 'medio' | 'alto' | null; prioridad: number;
  change: Record<string, any>;
  status: 'en_revision' | 'pendiente' | 'aprobada' | 'aplicada' | 'en_construccion' | 'rechazada' | 'fallida';
  support_review: { viable: boolean; recomendacion: 'aprobar' | 'aprobar_con_ajustes' | 'no_recomendada'; nota: string; riesgos: string | null } | null;
  founder_note: string | null; decided_at: string | null; applied_at: string | null;
  baseline: { pagando?: number } | null; result: string | null; created_at: string; updated_at: string;
};

export type MkKpis = {
  registros_7d: number;
  registros_30d: number;
  registros_mes: number;
  negocios_total: number;
  pagados_activos: number;
  pagando_reales?: number;
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
  const [meeting, setMeeting] = useState<MkMeeting | null>(null);
  const [projections, setProjections] = useState<MkProjection[]>([]);
  const [comments, setComments] = useState<MkComment[]>([]);
  const [innovations, setInnovations] = useState<MkInnovation[]>([]);
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
    const [mt, pj] = await Promise.all([
      supabase.from('mk_meetings').select('*').eq('status', 'en_curso').order('created_at', { ascending: false }).limit(1),
      supabase.from('mk_projections').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setMeeting(((mt.data ?? [])[0] as MkMeeting) ?? null);
    setProjections((pj.data ?? []) as MkProjection[]);
    const cm = await supabase.from('mk_comments').select('*').order('commented_at', { ascending: false }).limit(100);
    setComments((cm.data ?? []) as MkComment[]);
    const inv = await supabase.from('mk_innovations').select('*').order('created_at', { ascending: false }).limit(60);
    setInnovations((inv.data ?? []) as MkInnovation[]);
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
      // Los avisos de UPDATE no traen columnas grandes que no cambiaron
      // (payload, look, skills…): siempre se fusionan con lo que ya había.
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
        setPosts((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...prev]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_meetings' }, (e) => {
        const row = e.new as MkMeeting;
        if (!row?.id) return;
        setMeeting((cur) => (row.status === 'en_curso' ? { ...(cur?.id === row.id ? cur : {}), ...row } as MkMeeting : cur?.id === row.id ? null : cur));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_comments' }, (e) => {
        const row = e.new as MkComment;
        if (!row?.id) return;
        setComments((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...prev]));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mk_projections' }, (e) => {
        const row = e.new as MkProjection;
        if (row?.id) setProjections((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev].slice(0, 150)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_innovations' }, (e) => {
        const row = e.new as MkInnovation;
        if (!row?.id) return;
        setInnovations((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...prev]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mk_requests' }, (e) => {
        const row = e.new as MkRequest;
        if (!row?.id) return;
        setRequests((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...prev]));
      })
      .subscribe((status) => {
        // Tras una reconexión se pudieron perder avisos: resincroniza.
        if (status === 'SUBSCRIBED' && subscribedOnce) resync();
        if (status === 'SUBSCRIBED') subscribedOnce = true;
      });
    let subscribedOnce = false;
    // Red de seguridad: el estado de cada agente y sus tareas se vuelve a
    // leer cada 30 s y al regresar a la pestaña, aunque se pierda un aviso.
    const resync = () => {
      supabase.from('mk_agents').select('*').order('rank').order('name').then(({ data }) => data && setAgents(data as MkAgent[]));
      supabase.from('mk_tasks').select('id,title,assigned_to,created_by,status,result,kind,request,not_before,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(80).then(({ data }) => data && setTasks(data as MkTask[]));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') { resync(); loadKpis(); } };
    document.addEventListener('visibilitychange', onVisible);
    const syncTimer = setInterval(resync, 30_000);
    const kpiTimer = setInterval(loadKpis, 120_000);
    return () => { supabase.removeChannel(ch); clearInterval(kpiTimer); clearInterval(syncTimer); document.removeEventListener('visibilitychange', onVisible); };
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
    const r = data as { reply: string; visits?: string[] };
    return { reply: r.reply, visits: r.visits ?? [] };
  }, [supabase, loadKpis]);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
    return data as any;
  }, [supabase]);
  const previewOutreach = useCallback(async () => (await invoke({ action: 'outreach_preview' })) as { subject: string; html: string; elegibles?: string[] }, [invoke]);
  const decideInnovation = useCallback(async (id: string, approve: boolean, note?: string) => {
    const r = await invoke({ action: 'innovation_decide', id, approve, note });
    const { data } = await supabase.from('mk_innovations').select('*').eq('id', id).maybeSingle();
    if (data) setInnovations((prev) => prev.map((x) => (x.id === id ? (data as MkInnovation) : x)));
    return r as { status: string; result?: string };
  }, [invoke, supabase]);
  const unhideComment = useCallback(async (id: string) => {
    await invoke({ action: 'comment_unhide', comment_id: id });
  }, [invoke]);
  const startMeeting = useCallback(async (topic: string, attendees: string[]) => {
    const r = await invoke({ action: 'meeting_start', topic, attendees });
    setMeeting(r.meeting as MkMeeting);
    return r.meeting as MkMeeting;
  }, [invoke]);
  const endMeeting = useCallback(async (id: string) => {
    await invoke({ action: 'meeting_end', meeting_id: id });
    setMeeting((cur) => (cur?.id === id ? null : cur));
  }, [invoke]);
  const meetingChat = useCallback(async (id: string, message: string, to?: string) => {
    const r = await invoke({ action: 'meeting_chat', meeting_id: id, message, to });
    loadKpis();
    return r as { reply: string; agent_id: string; projections: string[] };
  }, [invoke, loadKpis]);
  // Una proyección que aún no llegó por tiempo real se trae directo.
  const getProjection = useCallback(async (id: string) => {
    const { data } = await supabase.from('mk_projections').select('*').eq('id', id).maybeSingle();
    if (data) setProjections((prev) => (prev.some((x) => x.id === id) ? prev : [data as MkProjection, ...prev]));
    return (data as MkProjection) ?? null;
  }, [supabase]);

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

  const connectInstagram = useCallback(async (igToken: string) => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body: { action: 'connect_instagram', ig_token: igToken } });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
    const status = (data as any).status;
    setSettings((s) => ({ ...s, meta_status: status }));
    return status;
  }, [supabase]);

  const connectAds = useCallback(async (adsToken: string) => {
    const { data, error } = await supabase.functions.invoke('mk-engine', { body: { action: 'connect_ads', ads_token: adsToken } });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
    const status = (data as any).status;
    setSettings((s) => ({ ...s, ads_status: status }));
    return status;
  }, [supabase]);

  const assignTask = useCallback(async (agentId: string, title: string, detail: string, priority: number) => {
    const { error } = await supabase.functions.invoke('mk-engine', { body: { action: 'assign_task', agent_id: agentId, title, detail, priority } });
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      throw new Error(msg);
    }
  }, [supabase]);

  const loadLedger = useCallback(async (agentId: string) => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data } = await supabase.from('mk_ledger')
      .select('provider,model,input_tokens,output_tokens,cache_read,images,web_searches,cost_usd,created_at')
      .eq('agent_id', agentId).gte('created_at', since).order('created_at');
    return (data ?? []) as any[];
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
    // Aplica la decisión ya (p. ej. encender o borrar una campaña) sin esperar el ciclo de 10 min.
    await supabase.functions.invoke('mk-engine', { body: { action: 'apply_decisions' } }).catch(() => {});
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
    loading, agents, activity, posts, requests, knowledge, tasks, kpis, spendByAgent, settings, meeting, projections, comments,
    startMeeting, endMeeting, meetingChat, getProjection, unhideComment, innovations, decideInnovation, previewOutreach,
    chat, runNow, connectMeta, connectInstagram, connectAds, assignTask, loadLedger, setAgentEnabled, setPaused, decideRequest, discardPost, loadThread, reload: loadAll, supabase,
  };
}
