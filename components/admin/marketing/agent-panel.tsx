'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Crown, Cpu, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MkActivity, MkAgent, MkMessage, MkTask } from '@/hooks/use-marketing';

// Panel del agente seleccionado: quién es, qué hace, sus tareas y el chat
// para darle órdenes. Con el Director se habla directo: él delega.

const MODEL_LABEL: Record<string, { name: string; note: string }> = {
  'claude-haiku-5-5': { name: 'Haiku 5.5', note: 'económico' },
  'claude-sonnet-5-5': { name: 'Sonnet 5.5', note: 'estratégico' },
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

export function AgentPanel({ agent, agents, activity, tasks, spend, supabase, onChat, onToggle }: {
  agent: MkAgent;
  agents: MkAgent[];
  activity: MkActivity[];
  tasks: MkTask[];
  spend: number;
  supabase: any;
  onChat: (agentId: string, message: string) => Promise<string>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}) {
  const [thread, setThread] = useState<MkMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  useEffect(() => {
    let alive = true;
    supabase.from('mk_messages').select('*').eq('agent_id', agent.id).order('created_at').limit(100)
      .then(({ data }: any) => alive && setThread(data ?? []));
    const ch = supabase.channel(`mk-chat-${agent.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mk_messages', filter: `agent_id=eq.${agent.id}` },
        (e: any) => setThread((t) => (t.some((m) => m.id === e.new.id) ? t : [...t, e.new])))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [agent.id, supabase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread, sending]);

  const send = async () => {
    const msg = draft.trim();
    if (!msg || sending) return;
    setSending(true);
    setDraft('');
    setThread((t) => [...t, { id: -Date.now(), agent_id: agent.id, sender: 'fundador', body: msg, created_at: new Date().toISOString() }]);
    try {
      await onChat(agent.id, msg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const mine = activity.filter((e) => e.agent_id === agent.id).slice(0, 8);
  const open = tasks.filter((t) => t.assigned_to === agent.id && (t.status === 'pendiente' || t.status === 'en_progreso'));
  const done = tasks.filter((t) => t.assigned_to === agent.id && t.status === 'hecha').slice(0, 4);
  const model = MODEL_LABEL[agent.model] ?? { name: agent.model, note: '' };
  const boss = agent.reports_to ? byId[agent.reports_to] : null;
  const working = agent.enabled && agent.status !== 'idle';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Encabezado */}
      <div className="border-b border-slate-100 p-5" style={{ background: `linear-gradient(135deg, ${agent.color}18, transparent 70%)` }}>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm" style={{ background: agent.color }}>
            {agent.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {agent.rank === 1 && <Crown className="h-4 w-4 text-amber-500" />}
              <h3 className="truncate text-base font-bold text-slate-900">{agent.name}</h3>
            </div>
            <p className="text-sm text-slate-500">{agent.title}{boss ? ` · reporta a ${boss.name.split(' ')[0]}` : ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className={cn('rounded-full px-2 py-0.5', !agent.enabled ? 'bg-slate-100 text-slate-500' : working ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {!agent.enabled ? 'En pausa' : agent.status === 'talking' ? 'En conversación' : working ? 'Trabajando' : 'Disponible'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-white"><Cpu className="h-3 w-3" />{model.name} · {model.note}</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">${spend.toFixed(2)} USD este mes</span>
            </div>
          </div>
          <button
            onClick={() => onToggle(agent.id, !agent.enabled).catch((e) => toast.error(e.message))}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title={agent.enabled ? 'Pausar agente' : 'Reactivar agente'}
          >
            {agent.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{agent.mission}</p>
        {agent.current_action && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{agent.current_action}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Tareas */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Tareas</h4>
          {open.length === 0 && done.length === 0 && <p className="text-sm text-slate-400">Sin tareas por ahora.</p>}
          <ul className="space-y-1.5">
            {open.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', t.status === 'en_progreso' ? 'animate-pulse bg-emerald-500' : 'bg-amber-400')} />
                <span className="text-slate-700">{t.title}</span>
              </li>
            ))}
            {done.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm text-slate-400">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                <span className="line-through decoration-slate-300">{t.title}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Actividad */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Lo último que hizo</h4>
          {mine.length === 0 && <p className="text-sm text-slate-400">Aún no tiene actividad.</p>}
          <ul className="space-y-2">
            {mine.map((e) => (
              <li key={e.id} className="text-[13px] leading-snug text-slate-600">
                {e.text}<span className="ml-1.5 text-[11px] text-slate-400">{ago(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Chat */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {agent.rank === 1 ? 'Habla con tu Director' : `Conversación con ${agent.name.split(' ')[0]}`}
          </h4>
          <div className="space-y-2">
            {thread.length === 0 && (
              <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500">
                {agent.rank === 1
                  ? 'Dale una instrucción o pídele cuentas: él decide a quién delegar y te reporta con números.'
                  : 'Puedes darle instrucciones directas. Para cambios de estrategia, mejor háblalo con el Director.'}
              </p>
            )}
            {thread.map((m) => (
              <div key={m.id} className={cn('max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                m.sender === 'fundador' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-800')}>
                {m.body}
              </div>
            ))}
            {sending && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-[13px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />{agent.name.split(' ')[0]} está pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>
        </section>
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={agent.enabled ? `Escríbele a ${agent.name.split(' ')[0]}…` : 'Reactiva al agente para hablar con él'}
            disabled={!agent.enabled || sending}
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
          <button onClick={send} disabled={!draft.trim() || sending || !agent.enabled}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
