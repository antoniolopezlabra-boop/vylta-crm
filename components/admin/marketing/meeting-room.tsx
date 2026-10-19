'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, LogOut, Minimize2, Presentation, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectionBody, ProjectionCard } from './projection-viewer';
import type { MkAgent, MkMeeting, MkMessage, MkProjection } from '@/hooks/use-marketing';

// ═══════════════════════════════════════════════════════════════════════
// Sala de reunión estilo Teams: arriba los participantes (con quién está
// hablando), al centro lo que se proyecta y a la derecha la conversación,
// donde escriben todos los presentes. Se abre con clic en la pantalla de la
// sala de juntas o desde el panel de la reunión.
// ═══════════════════════════════════════════════════════════════════════

const initials = (n: string) => n.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const hhmm = (iso: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function MeetingRoom({ meeting, agents, projections, supabase, onSend, onEnd, onClose, getProjection }: {
  meeting: MkMeeting; agents: MkAgent[]; projections: MkProjection[]; supabase: any;
  onSend: (id: string, message: string, to?: string) => Promise<unknown>;
  onEnd: (id: string) => Promise<void>; onClose: () => void; getProjection: (id: string) => Promise<MkProjection | null>;
}) {
  const people = meeting.attendees.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as MkAgent[];
  const [thread, setThread] = useState<MkMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [to, setTo] = useState<string>('todos');
  const [sending, setSending] = useState(false);
  const [stageId, setStageId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('mk_messages').select('*').eq('meeting_id', meeting.id).order('created_at').limit(300)
      .then(({ data }: any) => alive && setThread(data ?? []));
    const ch = supabase.channel(`mk-room-${meeting.id}`)
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
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - new Date(meeting.created_at).getTime()) / 1000);
      setElapsed(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, [meeting.created_at]);
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [thread, sending]);
  useEffect(() => {
    thread.flatMap((m) => m.attachments ?? []).filter((id) => !projections.some((p) => p.id === id)).forEach((id) => { getProjection(id); });
  }, [thread, projections, getProjection]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // Escenario: lo que elijas en el chat o lo último que se proyectó.
  const meetingProjections = useMemo(() => projections.filter((p) => p.meeting_id === meeting.id), [projections, meeting.id]);
  const stage = (stageId && projections.find((p) => p.id === stageId)) || meetingProjections[0] || null;
  // Quién está hablando o preparando algo ahora mismo.
  const busy = people.filter((p) => p.status === 'talking' || p.status === 'working');
  const who = (id: string) => agents.find((a) => a.id === id);

  const send = async () => {
    const msg = draft.trim(); if (!msg || sending) return;
    setSending(true); setDraft('');
    const target = to === 'todos' ? undefined : to;
    setThread((t) => [...t, { id: -Date.now(), agent_id: target ?? 'director', sender: 'fundador', body: msg, created_at: new Date().toISOString(), meeting_id: meeting.id }]);
    try { await onSend(meeting.id, msg, target); } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex bg-[#070B14]/95 p-3 text-white backdrop-blur md:p-5">
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0B1120] shadow-2xl">
        {/* Barra superior */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><Presentation className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Sala de juntas · {elapsed}</div>
            <h3 className="truncate text-base font-bold">{meeting.topic}</h3>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:bg-white/10"><Minimize2 className="h-3.5 w-3.5" />Minimizar</button>
          <button onClick={() => onEnd(meeting.id).then(onClose).catch((e) => toast.error(e.message))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-[12px] font-semibold hover:bg-red-700"><LogOut className="h-3.5 w-3.5" />Terminar reunión</button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
          <div className="flex min-h-0 flex-col">
            {/* Participantes */}
            <div className="flex gap-3 overflow-x-auto border-b border-white/10 px-5 py-3">
              <Tile name="Tú" title="Fundador" color="#94A3B8" speaking={sending} />
              {people.map((p) => {
                const b = busy.find((x) => x.id === p.id);
                return <Tile key={p.id} name={p.name} title={p.title} color={p.color} speaking={!!b} note={b?.current_action ?? undefined} />;
              })}
            </div>
            {/* Escenario */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {stage ? (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">En pantalla{who(stage.agent_id) ? ` · presenta ${who(stage.agent_id)!.name.split(' ')[0]}` : ''}</div>
                      <div className="truncate text-lg font-bold">{stage.title}</div>
                    </div>
                    {meetingProjections.length > 1 && (
                      <div className="flex shrink-0 gap-1.5 overflow-x-auto">
                        {meetingProjections.slice(0, 6).map((p) => (
                          <button key={p.id} onClick={() => setStageId(p.id)} className={cn('max-w-[140px] truncate rounded-lg border px-2.5 py-1 text-[11px] font-semibold', p.id === stage.id ? 'border-sky-400 bg-sky-500/15 text-sky-200' : 'border-white/10 text-white/60 hover:bg-white/5')}>{p.title}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {stage.payload?.comentario && <p className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{stage.payload.comentario}</p>}
                  <ProjectionBody p={stage} />
                </div>
              ) : (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center text-white/50">
                  <svg viewBox="0 0 40 40" className="h-14 w-14"><rect x="3" y="3" width="34" height="34" rx="9" fill="none" stroke="#34D399" strokeWidth="2.5" /><path d="M12 13 L20 28 L28 13" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="max-w-sm text-sm">Pídeles lo que quieras ver y aparecerá aquí: «proyéctame las próximas publicaciones», «muéstrame los resultados del mes», «preséntame el plan de la semana».</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversación */}
          <div className="flex min-h-0 flex-col border-t border-white/10 bg-[#0D1424] lg:border-l lg:border-t-0">
            <div className="border-b border-white/10 px-4 py-3 text-[12px] font-bold uppercase tracking-wider text-white/50">Conversación de la reunión</div>
            <div ref={boxRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {thread.map((m) => {
                if (m.sender === 'sistema') return <div key={m.id} className="text-center text-[11px] italic text-white/40">{m.body}</div>;
                const a = who(m.agent_id); const mine = m.sender === 'fundador';
                return (
                  <div key={m.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                    <Avatar name={mine ? 'Tú' : a?.name ?? '?'} color={mine ? '#475569' : a?.color ?? '#475569'} />
                    <div className={cn('min-w-0 max-w-[85%]', mine && 'text-right')}>
                      <div className="text-[11px] font-semibold text-white/50">{mine ? `Tú${m.agent_id && m.agent_id !== 'director' ? ` → ${who(m.agent_id)?.name.split(' ')[0] ?? ''}` : ''}` : a?.name.split(' ')[0]} · {hhmm(m.created_at)}</div>
                      <div className={cn('mt-0.5 inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-[13px] leading-relaxed', mine ? 'rounded-tr-md bg-sky-600 text-white' : 'rounded-tl-md bg-white/[.06] text-white/90')}>{m.body}</div>
                      {(m.attachments ?? []).map((id) => { const p = projections.find((x) => x.id === id); return p ? <div key={id} className="text-left"><ProjectionCard p={p} agent={who(p.agent_id)} onOpen={(q) => setStageId(q.id)} /></div> : null; })}
                    </div>
                  </div>
                );
              })}
              {busy.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12px] text-white/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: p.color }} />{p.name.split(' ')[0]} · {p.current_action === 'Escribiendo en la reunión' || p.current_action === 'En la sala de juntas' ? 'está escribiendo…' : `${(p.current_action ?? 'revisando').toLowerCase()}…`}
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="shrink-0 font-semibold text-white/40">Para:</span>
                {[{ id: 'todos', name: 'Todos', color: '#0EA5E9' }, ...people].map((p) => (
                  <button key={p.id} onClick={() => setTo(p.id)}
                          className={cn('shrink-0 rounded-full px-2.5 py-1 font-semibold transition', to === p.id ? 'text-white' : 'bg-white/5 text-white/60 hover:bg-white/10')}
                          style={to === p.id ? { background: p.color } : undefined}>{p.name.split(' ')[0]}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} disabled={sending}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                          placeholder={to === 'todos' ? 'Escribe a la reunión (modera el Director)…' : `Escribe a ${people.find((p) => p.id === to)?.name.split(' ')[0]}…`}
                          className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-sky-400" />
                <button onClick={send} disabled={!draft.trim() || sending} aria-label="Enviar"
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{name === 'Tú' ? 'TÚ' : initials(name)}</div>;
}

function Tile({ name, title, color, speaking, note }: { name: string; title: string; color: string; speaking?: boolean; note?: string }) {
  return (
    <div className={cn('relative flex h-28 w-40 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-gradient-to-b from-white/[.06] to-white/[.02] transition',
      speaking ? 'border-transparent' : 'border-white/10')} style={speaking ? { boxShadow: `0 0 0 2px ${color}, 0 0 24px ${color}55` } : undefined}>
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white', speaking && 'animate-pulse')} style={{ background: color }}>{name === 'Tú' ? 'TÚ' : initials(name)}</div>
      <div className="max-w-[90%] truncate text-[12px] font-semibold">{name.split(' ')[0]}</div>
      <div className="max-w-[90%] truncate text-[10px] text-white/45">{speaking && note ? note : title}</div>
    </div>
  );
}
