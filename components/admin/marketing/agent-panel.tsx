'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Send, Crown, Cpu, Pause, Play, Clock, MessageSquare, ListChecks, IdCard, History, Gauge,
  Target, Wrench, ShieldCheck, Plus, ChevronDown, CheckCircle2, XCircle, CircleDot,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { walkBus } from './walk-bus';
import type { MkActivity, MkAgent, MkMessage, MkProjection, MkTask } from '@/hooks/use-marketing';
import { ProjectionCard } from './projection-viewer';

// ═══════════════════════════════════════════════════════════════════════
// Expediente del agente
//
// Pestañas: Chat · Tareas (compromisos, en curso, asignar nueva, resultados)
// · Expediente (misión, objetivos, herramientas y permisos, modelo)
// · Historial (todo lo que ha hecho) · Consumo (gasto de IA del mes).
// El chat desplaza solo su propio contenedor: nunca mueve la página.
// ═══════════════════════════════════════════════════════════════════════

const MODEL_LABEL: Record<string, { name: string; note: string; price: string }> = {
  'claude-haiku-5-5': { name: 'Haiku 5.5', note: 'económico', price: '$0.10 / $0.50 por millón de tokens' },
  'claude-sonnet-5-5': { name: 'Sonnet 5.5', note: 'estratégico', price: '$2 / $10 por millón de tokens' },
};

const TOOL_INFO: Record<string, { label: string; desc: string; approval?: boolean }> = {
  ver_equipo: { label: 'Ver al equipo', desc: 'Consulta quién está activo y con qué modelo.' },
  crear_tarea: { label: 'Delegar tareas', desc: 'Asigna trabajo a otros agentes.' },
  leer_metricas: { label: 'Leer métricas', desc: 'Registros, negocios que pagan, MRR y gasto.' },
  ver_posts: { label: 'Ver publicaciones', desc: 'Revisa posts programados y publicados.' },
  leer_manual: { label: 'Consultar manual', desc: 'Producto, marca, reglas y estrategia.' },
  guardar_conocimiento: { label: 'Actualizar manual', desc: 'Guarda investigación y aprendizajes.' },
  ajustar_modelo: { label: 'Optimizar modelos de IA', desc: 'Cambia el modelo de un agente (solo Haiku/Sonnet).' },
  solicitar_presupuesto: { label: 'Pedir presupuesto', desc: 'Solicita más tope mensual con justificación.', approval: true },
  mensaje_fundador: { label: 'Escribirte', desc: 'Te envía reportes y avisos.' },
  enviar_mensaje: { label: 'Mensajes al equipo', desc: 'Coordina con otros agentes.' },
  escribir_post: { label: 'Redactar posts', desc: 'Escribe textos para Facebook e Instagram.' },
  generar_imagen: { label: 'Crear imágenes (Gemini)', desc: 'Genera la imagen de cada post.' },
  programar_publicacion: { label: 'Programar y publicar', desc: 'Programa posts que salen solos en las redes.' },
  proponer_contratacion: { label: 'Proponer contrataciones', desc: 'Diseña agentes nuevos para tu aprobación.', approval: true },
  estado_sistema: { label: 'Verificar operación', desc: 'Revisa conexión con redes, fallas y presupuesto.' },
  comprometer_respuesta: { label: 'Comprometer respuestas', desc: 'Te promete una respuesta con hora.' },
  posponer_respuesta: { label: 'Pedir más tiempo', desc: 'Te avisa si necesita más tiempo y por qué.' },
  terminar_tarea: { label: 'Entregar tareas', desc: 'Cierra su trabajo con un resultado.' },
  reportar_problema: { label: 'Reportar fallas', desc: 'Avisa a Soporte Técnico con el error exacto cuando algo no funciona.' },
  ver_fallas: { label: 'Ver fallas del sistema', desc: 'Tareas fallidas, errores y alertas recientes para diagnosticar.' },
  web: { label: 'Búsqueda en internet', desc: 'Investiga fuentes actuales (máx. 4 por tarea).' },
};

type Tab = 'chat' | 'tareas' | 'expediente' | 'historial' | 'consumo';
const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
  { id: 'expediente', label: 'Expediente', icon: IdCard },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'consumo', label: 'Consumo', icon: Gauge },
];

const hhmm = (iso: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

export function AgentPanel({ agent, agents, activity, tasks, spend, supabase, onChat, onToggle, onAssign, loadLedger, projections, onOpenProjection, getProjection }: {
  agent: MkAgent;
  agents: MkAgent[];
  activity: MkActivity[];
  tasks: MkTask[];
  spend: number;
  supabase: any;
  onChat: (agentId: string, message: string) => Promise<{ reply: string; visits: string[] }>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onAssign: (agentId: string, title: string, detail: string, priority: number) => Promise<void>;
  loadLedger: (agentId: string) => Promise<any[]>;
  projections: MkProjection[];
  onOpenProjection: (p: MkProjection) => void;
  getProjection: (id: string) => Promise<MkProjection | null>;
}) {
  const [tab, setTab] = useState<Tab>('chat');
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const model = MODEL_LABEL[agent.model] ?? { name: agent.model, note: '', price: '' };
  const boss = agent.reports_to ? byId[agent.reports_to] : null;
  const working = agent.enabled && agent.status !== 'idle';
  const mine = tasks.filter((t) => t.assigned_to === agent.id);
  const promises = mine.filter((t) => t.kind === 'seguimiento' && (t.status === 'pendiente' || t.status === 'en_progreso'));

  useEffect(() => { setTab('chat'); }, [agent.id]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Encabezado */}
      <div className="relative overflow-hidden border-b border-slate-100 p-5">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(600px 160px at 0% 0%, ${agent.color}26, transparent 70%)` }} />
        <div className="relative flex items-start gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}aa)` }}>
            {agent.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            <span className={cn('absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white', !agent.enabled ? 'bg-slate-300' : working ? 'animate-pulse bg-emerald-500' : 'bg-emerald-300')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {agent.rank === 1 && <Crown className="h-4 w-4 text-amber-500" />}
              <h3 className="truncate text-base font-bold text-slate-900">{agent.name}</h3>
            </div>
            <p className="text-[13px] text-slate-500">{agent.title}{boss ? ` · reporta a ${boss.name.split(' ')[0]}` : ' · reporta al fundador'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className={cn('rounded-full px-2 py-0.5', !agent.enabled ? 'bg-slate-100 text-slate-500' : working ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {!agent.enabled ? 'En pausa' : agent.status === 'talking' ? 'En conversación' : working ? 'Trabajando' : 'Disponible'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-white"><Cpu className="h-3 w-3" />{model.name}</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">${spend.toFixed(2)} este mes</span>
            </div>
          </div>
          <button onClick={() => onToggle(agent.id, !agent.enabled).catch((e) => toast.error(e.message))}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title={agent.enabled ? 'Pausar agente' : 'Reactivar agente'}>
            {agent.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
        {agent.current_action && (
          <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{agent.current_action}
          </div>
        )}
        {promises.map((p) => (
          <div key={p.id} className="relative mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><b>Te responde a las {hhmm(p.not_before)}</b> · {p.title.replace('Responder al fundador: ', '')}</span>
          </div>
        ))}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-slate-100 px-3 pt-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('relative flex items-center gap-1.5 rounded-t-lg px-2.5 pb-2.5 pt-1.5 text-[12.5px] font-semibold transition-colors',
                    tab === t.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600')}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
            {tab === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full" style={{ background: agent.color }} />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'chat' && <ChatTab agent={agent} agents={agents} supabase={supabase} onChat={onChat} projections={projections} onOpenProjection={onOpenProjection} getProjection={getProjection} />}
        {tab === 'tareas' && <TasksTab agent={agent} tasks={mine} byId={byId} onAssign={onAssign} />}
        {tab === 'expediente' && <DossierTab agent={agent} boss={boss} model={model} />}
        {tab === 'historial' && <HistoryTab agent={agent} activity={activity} byId={byId} />}
        {tab === 'consumo' && <UsageTab agent={agent} loadLedger={loadLedger} />}
      </div>
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────

function ChatTab({ agent, agents, supabase, onChat, projections, onOpenProjection, getProjection }: {
  agent: MkAgent; agents: MkAgent[]; supabase: any; onChat: (id: string, m: string) => Promise<{ reply: string; visits: string[] }>;
  projections: MkProjection[]; onOpenProjection: (p: MkProjection) => void; getProjection: (id: string) => Promise<MkProjection | null>;
}) {
  const [thread, setThread] = useState<MkMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [walking, setWalking] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Mientras el agente va a ver a su equipo, su respuesta se guarda y se
  // muestra cuando regresa a su lugar.
  const holdRef = useRef(false);
  const heldRef = useRef<MkMessage[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.from('mk_messages').select('*').eq('agent_id', agent.id).order('created_at').limit(100)
      .then(({ data }: any) => alive && setThread(data ?? []));
    const ch = supabase.channel(`mk-chat-${agent.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mk_messages', filter: `agent_id=eq.${agent.id}` },
        (e: any) => setThread((t) => {
          if (t.some((m) => m.id === e.new.id)) return t;
          if (holdRef.current && e.new.sender === 'agente') { heldRef.current.push(e.new); return t; }
          const tmp = t.findIndex((m) => m.id < 0 && m.sender === e.new.sender && m.body === e.new.body);
          if (tmp >= 0) { const n = [...t]; n[tmp] = e.new; return n; }
          return [...t, e.new];
        }))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [agent.id, supabase]);

  // Solo se desplaza la caja del chat (antes scrollIntoView movía toda la página).
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [thread, sending, walking]);
  useEffect(() => {
    thread.flatMap((m) => m.attachments ?? []).filter((id) => !projections.some((p) => p.id === id)).forEach((id) => { getProjection(id); });
  }, [thread, projections, getProjection]);

  const send = async () => {
    const msg = draft.trim();
    if (!msg || sending) return;
    setSending(true); setDraft('');
    setThread((t) => [...t, { id: -Date.now(), agent_id: agent.id, sender: 'fundador', body: msg, created_at: new Date().toISOString() }]);
    holdRef.current = true; heldRef.current = []; walkBus.busy.add(agent.id);
    let reply: string | null = null;
    try {
      const r = await onChat(agent.id, msg);
      reply = r.reply;
      if (r.visits.length) {
        const names = r.visits.map((v) => agents.find((a) => a.id === v)?.name.split(' ')[0]).filter(Boolean) as string[];
        setWalking(names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0] ?? 'el equipo');
        await walkBus.walk(agent.id, r.visits);
      }
    } catch (e) { toast.error((e as Error).message); }
    finally {
      holdRef.current = false; walkBus.busy.delete(agent.id);
      const held = heldRef.current; heldRef.current = [];
      setThread((t) => {
        let n = [...t, ...held.filter((h) => !t.some((m) => m.id === h.id))];
        // Si el aviso en vivo no llegó, se muestra la respuesta devuelta por el motor.
        if (reply && !n.some((m) => m.sender === 'agente' && m.body === reply && Date.now() - new Date(m.created_at).getTime() < 10 * 60_000)) {
          n = [...n, { id: -Date.now() - 1, agent_id: agent.id, sender: 'agente', body: reply, created_at: new Date().toISOString() }];
        }
        return n;
      });
      setWalking(null); setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={boxRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {thread.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500">
            {agent.rank === 1 ? 'Dale una instrucción o pídele cuentas: él verifica, delega y te responde con hechos.' : 'Puedes darle instrucciones directas. Para cambios de estrategia, mejor háblalo con el Director.'}
          </p>
        )}
        {thread.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.sender === 'fundador' ? 'items-end' : 'items-start')}>
            <div className={cn('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
              m.sender === 'fundador' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800')}>
              {m.body}
            </div>
            {(m.attachments ?? []).map((id) => { const p = projections.find((x) => x.id === id); return p ? <ProjectionCard key={id} p={p} agent={agents.find((a) => a.id === p.agent_id)} onOpen={onOpenProjection} /> : null; })}
            <span className="mt-0.5 px-1 text-[10px] text-slate-400">{hhmm(m.created_at)}</span>
          </div>
        ))}
        {sending && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-[13px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {walking ? `${agent.name.split(' ')[0]} fue con ${walking}; te responde en cuanto regrese a su lugar…` : `${agent.name.split(' ')[0]} está revisando…`}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={agent.enabled ? `Escríbele a ${agent.name.split(' ')[0]}…` : 'Reactiva al agente para hablar con él'}
                    disabled={!agent.enabled || sending} rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50" />
          <button onClick={send} disabled={!draft.trim() || sending || !agent.enabled}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ background: agent.color }}>
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tareas ───────────────────────────────────────────────────────────

function TasksTab({ agent, tasks, byId, onAssign }: { agent: MkAgent; tasks: MkTask[]; byId: Record<string, MkAgent>; onAssign: (id: string, t: string, d: string, p: number) => Promise<void> }) {
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [priority, setPriority] = useState(2);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const active = tasks.filter((t) => t.status === 'pendiente' || t.status === 'en_progreso');
  const done = tasks.filter((t) => t.status === 'hecha' || t.status === 'fallida').slice(0, 15);
  const from = (who: string) => (who === 'fundador' ? 'Tú' : who === 'sistema' ? 'Rutina' : byId[who]?.name.split(' ')[0] ?? who);

  const submit = async () => {
    setBusy(true);
    try {
      await onAssign(agent.id, title.trim(), detail.trim(), priority);
      toast.success(`Tarea asignada a ${agent.name.split(' ')[0]}`);
      setTitle(''); setDetail(''); setForm(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      <div>
        {!form ? (
          <button onClick={() => setForm(true)} disabled={!agent.enabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-40">
            <Plus className="h-4 w-4" />Asignar una tarea a {agent.name.split(' ')[0]}
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué debe hacer?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Detalles, criterios y qué esperas como entrega (opcional)"
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
            <div className="flex items-center gap-2">
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option value={1}>Urgente</option><option value={2}>Alta</option><option value={3}>Normal</option><option value={4}>Baja</option>
              </select>
              <div className="flex-1" />
              <button onClick={() => setForm(false)} className="px-2 text-sm font-semibold text-slate-500">Cancelar</button>
              <button onClick={submit} disabled={busy || !title.trim()} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: agent.color }}>
                {busy ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">En curso y pendientes</h4>
        {active.length === 0 && <p className="text-sm text-slate-400">Sin tareas abiertas.</p>}
        <ul className="space-y-2">
          {active.map((t) => (
            <li key={t.id} className="flex items-start gap-2 rounded-xl border border-slate-100 p-2.5 text-[13px]">
              {t.status === 'en_progreso' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-500" /> : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
              <div><div className="font-medium text-slate-800">{t.title}</div><div className="text-[11px] text-slate-400">de {from(t.created_by)} · {ago(t.created_at)}</div></div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Resultados entregados</h4>
        {done.length === 0 && <p className="text-sm text-slate-400">Aún no entrega resultados.</p>}
        <ul className="space-y-2">
          {done.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-100 text-[13px]">
              <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-start gap-2 p-2.5 text-left">
                {t.status === 'hecha' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                <div className="flex-1"><div className="font-medium text-slate-800">{t.title}</div><div className="text-[11px] text-slate-400">de {from(t.created_by)} · {ago(t.updated_at)}</div></div>
                <ChevronDown className={cn('mt-0.5 h-4 w-4 text-slate-400 transition-transform', open === t.id && 'rotate-180')} />
              </button>
              {open === t.id && t.result && <p className="whitespace-pre-wrap border-t border-slate-100 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-600">{t.result}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Expediente ───────────────────────────────────────────────────────

function DossierTab({ agent, boss, model }: { agent: MkAgent; boss: MkAgent | null; model: { name: string; note: string; price: string } }) {
  // reportar_problema y terminar_tarea las tiene todo el equipo (las agrega el motor).
  const tools = [...new Set([...(agent.tools ?? []), 'reportar_problema', 'terminar_tarea'])].filter((t) => TOOL_INFO[t]);
  return (
    <div className="h-full space-y-5 overflow-y-auto p-4 text-[13px]">
      <section>
        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Misión</h4>
        <p className="leading-relaxed text-slate-700">{agent.mission}</p>
      </section>
      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Target className="h-3.5 w-3.5" />Objetivos</h4>
        <ul className="space-y-1.5">
          {(agent.objectives ?? []).map((o, i) => (
            <li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: agent.color }} /><span className="text-slate-700">{o}</span></li>
          ))}
        </ul>
      </section>
      <section className="grid grid-cols-2 gap-2">
        <Fact label="Modelo de IA" value={`${model.name} · ${model.note}`} sub={model.price} />
        <Fact label="Nivel de esfuerzo" value={agent.effort === 'low' ? 'Bajo (ahorro)' : agent.effort === 'medium' ? 'Medio' : 'Alto'} />
        <Fact label="Reporta a" value={boss ? boss.name : 'Fundador'} />
        <Fact label="Contratado por" value={agent.hired_by === 'rh' ? 'Recursos Humanos' : 'Fundador'} />
      </section>
      {agent.skills?.length > 0 && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Habilidades</h4>
          <div className="flex flex-wrap gap-1.5">{agent.skills.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600">{s}</span>)}</div>
        </section>
      )}
      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Wrench className="h-3.5 w-3.5" />Herramientas y permisos</h4>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {tools.map((t) => (
            <li key={t} className="flex items-start gap-2 px-3 py-2">
              <ShieldCheck className={cn('mt-0.5 h-4 w-4 shrink-0', TOOL_INFO[t].approval ? 'text-amber-500' : 'text-emerald-500')} />
              <div className="flex-1">
                <div className="font-semibold text-slate-800">{TOOL_INFO[t].label}{TOOL_INFO[t].approval && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">requiere tu aprobación</span>}</div>
                <div className="text-[12px] text-slate-500">{TOOL_INFO[t].desc}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] text-slate-400">Ningún agente puede gastar en anuncios ni subir el presupuesto sin tu aprobación.</p>
      </section>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-800">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

// ── Historial ────────────────────────────────────────────────────────

const KIND_DOT: Record<string, string> = { think: 'bg-slate-300', work: 'bg-sky-400', talk: 'bg-violet-400', publish: 'bg-emerald-500', alert: 'bg-amber-500', done: 'bg-emerald-400', system: 'bg-slate-300' };

function HistoryTab({ agent, activity, byId }: { agent: MkAgent; activity: MkActivity[]; byId: Record<string, MkAgent> }) {
  const mine = activity.filter((e) => e.agent_id === agent.id || e.target_agent === agent.id);
  return (
    <div className="h-full overflow-y-auto p-4">
      {mine.length === 0 && <p className="text-sm text-slate-400">Sin actividad en los últimos 3 días.</p>}
      <ol className="relative space-y-3 border-l border-slate-100 pl-4">
        {mine.map((e) => (
          <li key={e.id} className="relative text-[13px]">
            <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white', KIND_DOT[e.kind])} />
            <p className="leading-snug text-slate-700">
              {e.agent_id !== agent.id && <b className="font-semibold text-slate-900">{byId[e.agent_id]?.name.split(' ')[0]}: </b>}{e.text}
            </p>
            <p className="text-[11px] text-slate-400">{ago(e.created_at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Consumo de IA ────────────────────────────────────────────────────

function UsageTab({ agent, loadLedger }: { agent: MkAgent; loadLedger: (id: string) => Promise<any[]> }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { setRows(null); loadLedger(agent.id).then(setRows); }, [agent.id, loadLedger]);
  const stats = useMemo(() => {
    const r = rows ?? [];
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const m = r.filter((x) => new Date(x.created_at) >= month);
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      days[d.toISOString().slice(5, 10)] = 0;
    }
    r.forEach((x) => { const k = x.created_at.slice(5, 10); if (k in days) days[k] += Number(x.cost_usd); });
    return {
      cost: m.reduce((s, x) => s + Number(x.cost_usd), 0),
      calls: m.filter((x) => x.provider === 'anthropic').length,
      tin: m.reduce((s, x) => s + x.input_tokens + x.cache_read, 0),
      tout: m.reduce((s, x) => s + x.output_tokens, 0),
      cached: m.reduce((s, x) => s + x.cache_read, 0),
      images: m.reduce((s, x) => s + (x.images ?? 0), 0),
      searches: m.reduce((s, x) => s + (x.web_searches ?? 0), 0),
      chart: Object.entries(days).map(([d, v]) => ({ d: d.slice(3) + '/' + d.slice(0, 2), v: Number(v.toFixed(4)) })),
    };
  }, [rows]);
  if (!rows) return <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
  return (
    <div className="h-full space-y-4 overflow-y-auto p-4 text-[13px]">
      <div className="grid grid-cols-2 gap-2">
        <Fact label="Gasto del mes" value={`$${stats.cost.toFixed(3)} USD`} />
        <Fact label="Llamadas a IA" value={String(stats.calls)} />
        <Fact label="Tokens leídos" value={fmt(stats.tin)} sub={stats.tin ? `${Math.round((stats.cached / stats.tin) * 100)}% desde caché (90% más barato)` : undefined} />
        <Fact label="Tokens escritos" value={fmt(stats.tout)} />
        {stats.images > 0 && <Fact label="Imágenes (Gemini)" value={String(stats.images)} />}
        {stats.searches > 0 && <Fact label="Búsquedas web" value={String(stats.searches)} />}
      </div>
      <div className="rounded-xl border border-slate-100 p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Gasto diario · últimos 14 días (USD)</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart}>
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={1} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Gasto']} cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="v" fill={agent.color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
