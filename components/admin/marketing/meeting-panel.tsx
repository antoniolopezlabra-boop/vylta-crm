'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, LogOut, Presentation, Send, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectionCard } from './projection-viewer';
import type { MkAgent, MkMeeting, MkMessage, MkProjection } from '@/hooks/use-marketing';
import { RichText } from './rich-text';

// ═══════════════════════════════════════════════════════════════════════
// Sala de juntas: convocar una reunión y conversar con el equipo reunido.
// Contesta quien elijas (por defecto el Director); lo que te muestren
// aparece en la pantalla de la sala y como tarjeta en el hilo.
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_ATTENDEES = ['director', 'community', 'soporte', 'rh'];

export function StartMeetingDialog({ agents, onStart, onClose }: {
  agents: MkAgent[]; onStart: (topic: string, attendees: string[]) => Promise<unknown>; onClose: () => void;
}) {
  const active = agents.filter((a) => a.enabled);
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState<string[]>(DEFAULT_ATTENDEES.filter((id) => active.some((a) => a.id === id)));
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 7 ? p : [...p, id]));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Presentation className="h-5 w-5 text-sky-600" />Convocar reunión</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <label className="mt-4 block text-[12px] font-semibold text-slate-500">Tema</label>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Resultados del mes y plan de la semana"
               className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400" />
        <div className="mt-4 text-[12px] font-semibold text-slate-500">Asistentes (máx. 7)</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {active.map((a) => (
            <button key={a.id} onClick={() => toggle(a.id)}
                    className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition', picked.includes(a.id) ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50')}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="min-w-0"><b className="block truncate text-slate-900">{a.name.split(' ')[0]}</b><span className="block truncate text-[11px] text-slate-500">{a.title}</span></span>
            </button>
          ))}
        </div>
        <button disabled={busy || !picked.length}
                onClick={async () => { setBusy(true); try { await onStart(topic.trim(), picked); onClose(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}Llamar a la sala de juntas
        </button>
      </div>
    </div>
  );
}

export function MeetingPanel({ meeting, agents, projections, supabase, onSend, onEnd, onOpen, getProjection, onOpenRoom }: {
  meeting: MkMeeting; agents: MkAgent[]; projections: MkProjection[]; supabase: any;
  onSend: (id: string, message: string, to?: string) => Promise<{ reply: string; agent_id: string; projections: string[] }>;
  onEnd: (id: string) => Promise<void>; onOpen: (p: MkProjection) => void; getProjection: (id: string) => Promise<MkProjection | null>;
  onOpenRoom: () => void;
}) {
  const people = meeting.attendees.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as MkAgent[];
  const [thread, setThread] = useState<MkMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [to, setTo] = useState('modera');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('mk_messages').select('*').eq('meeting_id', meeting.id).order('created_at').limit(200)
      .then(({ data }: any) => alive && setThread(data ?? []));
    const ch = supabase.channel(`mk-meeting-${meeting.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mk_messages', filter: `meeting_id=eq.${meeting.id}` },
        (e: any) => setThread((t) => {
          if (t.some((m) => m.id === e.new.id)) return t;
          const tmp = t.findIndex((m) => m.id < 0 && m.sender === e.new.sender && m.body === e.new.body);
          if (tmp >= 0) { const n = [...t]; n[tmp] = e.new; return n; }
          return [...t, e.new];
        }))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [meeting.id, supabase]);

  useEffect(() => { const el = boxRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [thread, sending]);
  // Adjuntos que aún no están en memoria se traen directo.
  useEffect(() => {
    const missing = thread.flatMap((m) => m.attachments ?? []).filter((id) => !projections.some((p) => p.id === id));
    missing.forEach((id) => { getProjection(id); });
  }, [thread, projections, getProjection]);

  const send = async () => {
    const msg = draft.trim(); if (!msg || sending) return;
    setSending(true); setDraft('');
    setThread((t) => [...t, { id: -Date.now(), agent_id: to === 'modera' || to === 'todos' ? 'director' : to, sender: 'fundador', body: msg, created_at: new Date().toISOString(), meeting_id: meeting.id }]);
    try { await onSend(meeting.id, msg, to === 'modera' ? undefined : to); } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };
  const who = (id: string) => agents.find((a) => a.id === id);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Reunión en curso</div>
            <h3 className="truncate text-base font-bold text-slate-900">{meeting.topic}</h3>
          </div>
          <button onClick={onOpenRoom} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-sky-700">
            <Presentation className="h-3.5 w-3.5" />Entrar a la sala
          </button>
          <button onClick={() => onEnd(meeting.id).catch((e) => toast.error(e.message))}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
            <LogOut className="h-3.5 w-3.5" />Terminar
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
      <div ref={boxRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {thread.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500">
            El equipo ya va a la sala. Pídeles lo que quieras ver: «proyéctame las próximas publicaciones», «muéstrame los resultados del mes», «preséntame el plan de la semana».
          </p>
        )}
        {thread.map((m) => {
          if (m.sender === 'sistema') return <div key={m.id} className="text-center text-[11px] italic text-slate-400">{m.body}</div>;
          const a = who(m.agent_id);
          return (
            <div key={m.id} className={cn('flex flex-col', m.sender === 'fundador' ? 'items-end' : 'items-start')}>
              {m.sender === 'agente' && a && <span className="mb-0.5 px-1 text-[11px] font-bold" style={{ color: a.color }}>{a.name.split(' ')[0]}</span>}
              <div className={cn('max-w-[92%] space-y-1 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                m.sender === 'fundador' ? 'mk-me rounded-br-md' : 'mk-them rounded-bl-md')}>
                {m.sender === 'fundador' && a && <span className="mr-1 opacity-60">@{a.name.split(' ')[0]}</span>}<RichText text={m.body} />
              </div>
              {(m.attachments ?? []).map((id) => { const p = projections.find((x) => x.id === id); return p ? <ProjectionCard key={id} p={p} agent={who(p.agent_id)} onOpen={onOpen} /> : null; })}
            </div>
          );
        })}
        {sending && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-[13px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />{to === 'todos' ? 'El equipo está contestando por turnos…' : `${who(to === 'modera' ? 'director' : to)?.name.split(' ')[0] ?? 'El equipo'} está preparando su respuesta…`}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="shrink-0 font-semibold text-slate-400">Pregúntale a:</span>
          {[{ id: 'modera', name: `${people.find((p) => p.id === 'director')?.name.split(' ')[0] ?? 'Director'} (modera)`, color: '#F59E0B' }, ...people.filter((p) => p.id !== 'director'), { id: 'todos', name: 'Todos', color: '#0EA5E9' }].map((p) => (
            <button key={p.id} onClick={() => setTo(p.id)}
                    className={cn('shrink-0 rounded-full px-2.5 py-1 font-semibold transition', to === p.id ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    style={to === p.id ? { background: p.color } : undefined}>{p.id === 'modera' || p.id === 'todos' ? p.name : p.name.split(' ')[0]}</button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Escribe a la sala…" disabled={sending}
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400" />
          <button onClick={send} disabled={!draft.trim() || sending}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
