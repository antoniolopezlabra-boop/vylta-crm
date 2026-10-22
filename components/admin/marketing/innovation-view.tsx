'use client';

import { useMemo, useState } from 'react';
import { Lightbulb, Target, Cog, Sparkles, TrendingUp, ShieldCheck, Check, X, Loader2, Wrench, UserPlus, Bot, Workflow, Package, CalendarClock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MkAgent, MkInnovation, MkKpis } from '@/hooks/use-marketing';

// ═══════════════════════════════════════════════════════════════════════
// Propuestas de innovación — lo que Gael (Gerencia e Innovación) propone
// cada lunes para que la oficina venda más, explicado en lenguaje sencillo:
// qué es, para qué te sirve y cómo funciona. Soporte da su opinión técnica
// y tú decides; lo que apruebas se aplica solo.
// ═══════════════════════════════════════════════════════════════════════

const KIND: Record<MkInnovation['kind'], { label: string; icon: typeof Bot; tone: string }> = {
  mejorar_agente: { label: 'Mejorar a un agente', icon: Bot, tone: 'bg-violet-100 text-violet-700' },
  nueva_herramienta: { label: 'Herramienta nueva', icon: Wrench, tone: 'bg-sky-100 text-sky-700' },
  nuevo_puesto: { label: 'Puesto nuevo', icon: UserPlus, tone: 'bg-emerald-100 text-emerald-700' },
  proceso: { label: 'Forma de trabajar', icon: Workflow, tone: 'bg-amber-100 text-amber-800' },
  producto: { label: 'Mejora al producto', icon: Package, tone: 'bg-rose-100 text-rose-700' },
};
const STATUS: Record<MkInnovation['status'], { label: string; tone: string }> = {
  en_revision: { label: 'Soporte la está revisando', tone: 'bg-slate-100 text-slate-600' },
  pendiente: { label: 'Espera tu decisión', tone: 'bg-amber-100 text-amber-800' },
  aprobada: { label: 'Aprobada, aplicándose', tone: 'bg-sky-100 text-sky-700' },
  aplicada: { label: 'En marcha', tone: 'bg-emerald-100 text-emerald-700' },
  en_construccion: { label: 'En construcción', tone: 'bg-sky-100 text-sky-700' },
  rechazada: { label: 'No por ahora', tone: 'bg-slate-100 text-slate-500' },
  fallida: { label: 'No se pudo aplicar', tone: 'bg-rose-100 text-rose-700' },
};
const REVIEW: Record<string, { label: string; tone: string }> = {
  aprobar: { label: 'La recomienda', tone: 'text-emerald-700' },
  aprobar_con_ajustes: { label: 'La recomienda con ajustes', tone: 'text-amber-700' },
  no_recomendada: { label: 'No la recomienda', tone: 'text-rose-700' },
};
const DAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Filter = 'decidir' | 'marcha' | 'rechazadas' | 'todas';

export function InnovationView({ innovations, agents, kpis, loop, onDecide, onOpenChat }: {
  innovations: MkInnovation[]; agents: MkAgent[]; kpis: MkKpis | null;
  loop: { meta?: number; activo?: boolean; inicio?: string; dia?: string; hora?: number; terminado?: string } | undefined;
  onDecide: (id: string, approve: boolean, note?: string) => Promise<{ status: string; result?: string }>;
  onOpenChat: (agentId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('decidir');
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const toDecide = innovations.filter((i) => i.status === 'pendiente' || i.status === 'en_revision');
  const list = innovations.filter((i) =>
    filter === 'decidir' ? toDecide.includes(i)
      : filter === 'marcha' ? ['aprobada', 'aplicada', 'en_construccion', 'fallida'].includes(i.status)
        : filter === 'rechazadas' ? i.status === 'rechazada' : true);
  const weeks = useMemo(() => {
    const m = new Map<string, MkInnovation[]>();
    for (const i of list) m.set(i.week, [...(m.get(i.week) ?? []), i]);
    return [...m.entries()].map(([w, items]) => [w, items.sort((a, b) => a.prioridad - b.prioridad)] as const);
  }, [list]);

  return (
    <div className="space-y-5">
      <LoopHeader innovations={innovations} kpis={kpis} loop={loop} gael={byId.innovacion} onOpenChat={onOpenChat} />

      <div className="flex flex-wrap gap-1">
        {([['decidir', `Por decidir${toDecide.length ? ` (${toDecide.length})` : ''}`], ['marcha', 'Aprobadas y en marcha'], ['rechazadas', 'No por ahora'], ['todas', 'Todas']] as [Filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
                  className={cn('rounded-lg px-3 py-1.5 text-[13px] font-semibold', filter === id ? 'bg-lime-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
            {label}
          </button>
        ))}
      </div>

      {!weeks.length && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {filter === 'decidir'
            ? 'No hay propuestas esperando tu decisión. Gael audita a la oficina cada lunes y Soporte te buscará cuando haya algo nuevo.'
            : 'Aún no hay propuestas en esta sección.'}
        </div>
      )}

      {weeks.map(([week, items]) => (
        <section key={week}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Semana del {fmtDate(week)}</h3>
          <ul className="space-y-4">
            {items.map((i) => <ProposalCard key={i.id} i={i} agents={byId} kpis={kpis} onDecide={onDecide} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LoopHeader({ innovations, kpis, loop, gael, onOpenChat }: {
  innovations: MkInnovation[]; kpis: MkKpis | null; loop: Parameters<typeof InnovationView>[0]['loop'];
  gael?: MkAgent; onOpenChat: (id: string) => void;
}) {
  const meta = loop?.meta ?? 200;
  const paying = kpis?.pagando_reales ?? 0;
  const pct = Math.min(100, (paying / meta) * 100);
  const applied = innovations.filter((i) => ['aplicada', 'en_construccion'].includes(i.status)).length;
  const weeksRun = new Set(innovations.map((i) => i.week)).size;
  return (
    <div className="grid gap-4 rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-50 to-white p-5 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-lime-700"><Sparkles className="h-3.5 w-3.5" />Gerencia e Innovación</div>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{gael?.name ?? 'Gael Fuentes'} busca cada semana cómo hacer que la oficina venda más</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
          Audita a cada área, propone mejoras y Soporte Técnico te las trae para que digas sí o no. Lo que apruebas se aplica solo;
          lo que requiere programar lo prepara Claude Code y te lo trae para autorizarlo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
            <CalendarClock className="h-3.5 w-3.5 text-lime-600" />
            {loop?.activo === false ? `Ciclo cerrado${loop.terminado ? ` el ${fmtDate(loop.terminado)}` : ''}` : `Próxima auditoría: ${nextRun(loop?.dia ?? 'Mon', loop?.hora ?? 8)}`}
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">{weeksRun} semana{weeksRun === 1 ? '' : 's'} de auditoría</span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">{applied} mejora{applied === 1 ? '' : 's'} en marcha</span>
          <button onClick={() => onOpenChat('innovacion')} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white hover:bg-slate-700">
            <MessageSquare className="h-3.5 w-3.5" />Hablar con Gael
          </button>
          <button onClick={() => onOpenChat('soporte')} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <MessageSquare className="h-3.5 w-3.5" />Responderle a Soporte
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 ring-1 ring-lime-100">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Meta del ciclo</span>
          <span className="text-[12px] font-semibold text-slate-500">el ciclo termina al llegar</span>
        </div>
        <div className="mt-1 text-3xl font-black text-slate-900">{paying}<span className="text-lg font-bold text-slate-400"> / {meta}</span></div>
        <div className="text-[13px] text-slate-600">negocios pagando una suscripción</div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-500 transition-all" style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
        <div className="mt-1.5 text-[12px] text-slate-500">Faltan {Math.max(0, meta - paying)} · {pct.toFixed(1)}% del camino</div>
      </div>
    </div>
  );
}

function ProposalCard({ i, agents, kpis, onDecide }: {
  i: MkInnovation; agents: Record<string, MkAgent>; kpis: MkKpis | null;
  onDecide: (id: string, approve: boolean, note?: string) => Promise<{ status: string; result?: string }>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'si' | 'no' | null>(null);
  const [details, setDetails] = useState(false);
  const k = KIND[i.kind];
  const st = STATUS[i.status];
  const open = i.status === 'pendiente' || i.status === 'en_revision';
  const changes = describeChange(i, agents);
  const decide = async (approve: boolean) => {
    setBusy(approve ? 'si' : 'no');
    try {
      const r = await onDecide(i.id, approve, note.trim() || undefined);
      if (approve) toast.success(r.status === 'en_construccion' ? 'Aprobada: la parte de programación ya va con Claude Code' : 'Aprobada y aplicada', { description: r.result?.slice(0, 200) });
      else toast('Listo, queda como "no por ahora"');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <li className={cn('overflow-hidden rounded-2xl border bg-white', open ? 'border-lime-200 shadow-sm' : 'border-slate-200')}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white">#{i.prioridad}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', k.tone)}><k.icon className="h-3 w-3" />{k.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{i.area}{i.target_agent && agents[i.target_agent] ? ` · ${agents[i.target_agent].name}` : ''}</span>
            {i.esfuerzo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">esfuerzo {i.esfuerzo}</span>}
          </div>
          <h4 className="mt-1.5 text-[17px] font-bold leading-snug text-slate-900">{i.title}</h4>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', st.tone)}>{st.label}</span>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-3">
        <Block icon={Lightbulb} title="¿Cuál es la propuesta?" text={i.que_es} tone="text-amber-500" />
        <Block icon={Target} title="¿En qué te va a servir?" text={i.para_que} tone="text-emerald-500" />
        <Block icon={Cog} title="¿Cómo va a funcionar?" text={i.como_funciona} tone="text-sky-500" />
      </div>

      <div className="grid gap-3 px-5 pb-4 md:grid-cols-2">
        {i.impacto && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700"><TrendingUp className="h-3.5 w-3.5" />Lo que esperamos en ventas</div>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-900">{i.impacto}</p>
            {i.costo && <p className="mt-1 text-[12px] text-emerald-800/80"><b>Costo:</b> {i.costo}</p>}
          </div>
        )}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Opinión de Soporte Técnico</div>
          {i.support_review ? (
            <>
              <p className={cn('mt-1 text-[13px] font-semibold', REVIEW[i.support_review.recomendacion]?.tone)}>{REVIEW[i.support_review.recomendacion]?.label ?? i.support_review.recomendacion}</p>
              <p className="text-[13px] leading-relaxed text-slate-700">{i.support_review.nota}</p>
              {i.support_review.riesgos && <p className="mt-1 text-[12px] text-slate-500"><b>Riesgos:</b> {i.support_review.riesgos}</p>}
            </>
          ) : <p className="mt-1 text-[13px] text-slate-500">Todavía la está revisando. Puedes decidir desde ahora si quieres.</p>}
        </div>
      </div>

      {(i.extra || changes.length > 0) && (
        <div className="px-5 pb-4">
          {i.extra && <p className="text-[13px] leading-relaxed text-slate-600"><b className="text-slate-800">Además:</b> {i.extra}</p>}
          {changes.length > 0 && (
            <div className="mt-2">
              <button onClick={() => setDetails(!details)} className="text-[12px] font-semibold text-lime-700 hover:underline">
                {details ? 'Ocultar' : 'Ver'} qué cambia exactamente si dices que sí
              </button>
              {details && (
                <ul className="mt-2 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[12px] text-slate-700">
                  {changes.map((c, n) => (
                    <li key={n}>
                      <b>{c.label}</b>
                      {c.body && <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 font-sans text-[12px] text-slate-600 ring-1 ring-slate-100">{c.body}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {open ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario para Gael (opcional)"
                 className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-lime-400" />
          <button disabled={!!busy} onClick={() => decide(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-lime-700 disabled:opacity-60">
            {busy === 'si' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Sí, hazlo
          </button>
          <button disabled={!!busy} onClick={() => decide(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            {busy === 'no' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}No por ahora
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[12px] text-slate-600">
          {i.decided_at && <span>Decidiste el {fmtDate(i.decided_at)}{i.founder_note ? ` · “${i.founder_note}”` : ''}. </span>}
          {i.result && <span className="whitespace-pre-wrap">{i.result}</span>}
          {i.baseline?.pagando !== undefined && kpis?.pagando_reales !== undefined && (
            <span className="ml-1 font-semibold text-slate-700">
              · Cuando se aplicó pagaban {i.baseline.pagando}; hoy pagan {kpis.pagando_reales}.
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function Block({ icon: Icon, title, text, tone }: { icon: typeof Lightbulb; title: string; text: string; tone: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800"><Icon className={cn('h-4 w-4', tone)} />{title}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}

// Traduce el cambio técnico a frases que se entienden.
function describeChange(i: MkInnovation, agents: Record<string, MkAgent>): { label: string; body?: string }[] {
  const c = i.change ?? {};
  const who = i.target_agent ? agents[i.target_agent]?.name ?? i.target_agent : '';
  const out: { label: string; body?: string }[] = [];
  if (c.instrucciones) out.push({ label: `${who} recibe nuevas instrucciones de trabajo:`, body: c.instrucciones });
  if (c.modelo) out.push({ label: `${who} cambia a ${c.modelo === 'claude-sonnet-5-5' ? 'un modelo más inteligente (Sonnet)' : 'un modelo más económico (Haiku)'}` });
  if (c.esfuerzo_ia) out.push({ label: `${who} piensa con esfuerzo ${({ low: 'bajo', medium: 'medio', high: 'alto' } as Record<string, string>)[c.esfuerzo_ia] ?? c.esfuerzo_ia}` });
  if (c.herramientas_agregar?.length) out.push({ label: `${who} gana herramientas: ${c.herramientas_agregar.join(', ')}` });
  if (c.herramientas_quitar?.length) out.push({ label: `${who} deja de usar: ${c.herramientas_quitar.join(', ')}` });
  if (c.manual) out.push({ label: `Se agrega al manual del equipo: “${c.manual.titulo}”`, body: c.manual.contenido });
  if (c.rutina) out.push({ label: `Nueva rutina ${c.rutina.frecuencia} para ${agents[c.rutina.agente]?.name ?? c.rutina.agente}: ${c.rutina.titulo} (${c.rutina.dia ? `${c.rutina.dia}, ` : ''}${c.rutina.hora}:00)`, body: c.rutina.detalle });
  if (c.puesto) out.push({ label: `Se contrata a ${c.puesto.nombre} como ${c.puesto.puesto}`, body: c.puesto.mision });
  if (c.especificacion_tecnica) out.push({ label: 'Requiere programar: Claude Code prepara el cambio y te lo trae para autorizarlo', body: c.especificacion_tecnica });
  return out;
}

function fmtDate(s: string) {
  const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

function nextRun(dia: string, hora: number) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const d = new Date(now);
  let add = (DAY[dia] - now.getDay() + 7) % 7;
  if (add === 0 && now.getHours() >= hora) add = 7;
  d.setDate(now.getDate() + add);
  return `${d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}, ${hora}:00`;
}
