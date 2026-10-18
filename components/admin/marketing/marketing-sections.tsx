'use client';

import { useState } from 'react';
import { Facebook, Instagram, Check, X, Trash2, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MkActivity, MkAgent, MkKnowledge, MkPost, MkRequest } from '@/hooks/use-marketing';

// Secciones bajo la oficina: bitácora en vivo, publicaciones, solicitudes
// al fundador, manual del equipo y gasto por agente.

const KIND_STYLE: Record<string, string> = {
  think: 'bg-slate-100 text-slate-600', work: 'bg-sky-100 text-sky-700', talk: 'bg-violet-100 text-violet-700',
  publish: 'bg-emerald-100 text-emerald-700', alert: 'bg-amber-100 text-amber-800', done: 'bg-emerald-50 text-emerald-700', system: 'bg-slate-100 text-slate-600',
};
const KIND_LABEL: Record<string, string> = { think: 'inicia', work: 'trabajo', talk: 'equipo', publish: 'publicado', alert: 'aviso', done: 'entrega', system: 'sistema' };
const POST_STATUS: Record<string, [string, string]> = {
  borrador: ['En preparación', 'bg-slate-100 text-slate-600'],
  listo: ['Programado', 'bg-sky-100 text-sky-700'],
  publicado: ['Publicado', 'bg-emerald-100 text-emerald-700'],
  error: ['Error', 'bg-red-100 text-red-700'],
  sin_conexion: ['Falta conectar Meta', 'bg-amber-100 text-amber-800'],
  descartado: ['Descartado', 'bg-slate-100 text-slate-400'],
};

const fmt = (iso: string | null) => (iso
  ? new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : '—');

export function ActivityFeed({ activity, agents, onSelect }: { activity: MkActivity[]; agents: MkAgent[]; onSelect: (id: string) => void }) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  if (!activity.length) return <Empty text="Aquí verás en vivo todo lo que hace el equipo." />;
  return (
    <ul className="divide-y divide-slate-100">
      {activity.slice(0, 60).map((e) => {
        const a = byId[e.agent_id];
        return (
          <li key={e.id} className="flex items-start gap-3 py-2.5">
            <button onClick={() => onSelect(e.agent_id)} className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: a?.color ?? '#64748B' }}>
              {a?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-slate-700"><b className="font-semibold text-slate-900">{a?.name.split(' ')[0]}</b> · {e.text}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmt(e.created_at)}</p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', KIND_STYLE[e.kind])}>{KIND_LABEL[e.kind]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PostsGrid({ posts, onDiscard }: { posts: MkPost[]; onDiscard: (id: string) => Promise<void> }) {
  if (!posts.length) return <Empty text="Todavía no hay publicaciones. El equipo arma el plan del día a las 8:00 am." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {posts.map((p) => {
        const [label, style] = POST_STATUS[p.status] ?? [p.status, 'bg-slate-100'];
        const Icon = p.channel === 'facebook' ? Facebook : Instagram;
        return (
          <article key={p.id} className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white', p.status === 'descartado' && 'opacity-50')}>
            <div className="relative aspect-[4/5] bg-slate-100">
              {p.image_url
                ? <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                : <div className="flex h-full items-center justify-center text-xs text-slate-400">Imagen en proceso…</div>}
              <span className={cn('absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-white', p.channel === 'facebook' ? 'bg-[#1877F2]' : 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]')}>
                <Icon className="h-3 w-3" />{p.channel === 'facebook' ? 'Facebook' : 'Instagram'}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', style)}>{label}</span>
                <span className="text-[11px] text-slate-400">{p.status === 'publicado' ? fmt(p.published_at) : fmt(p.scheduled_for)}</span>
              </div>
              <p className="line-clamp-6 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">{p.caption}</p>
              {p.error && p.status !== 'sin_conexion' && <p className="text-[11px] text-red-600">{p.error}</p>}
              {(p.status === 'listo' || p.status === 'borrador' || p.status === 'sin_conexion') && (
                <button onClick={() => onDiscard(p.id).then(() => toast.success('Publicación descartada')).catch((e) => toast.error(e.message))}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-600">
                  <Trash2 className="h-3 w-3" />Descartar
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function RequestsList({ requests, agents, onDecide }: {
  requests: MkRequest[]; agents: MkAgent[]; onDecide: (id: string, approve: boolean) => Promise<void>;
}) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  if (!requests.length) return <Empty text="Cuando el Director pida presupuesto o RH proponga una contratación, aparecerá aquí para tu decisión." />;
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {r.kind === 'presupuesto' ? 'Solicitud de presupuesto' : r.kind === 'contratacion' ? 'Propuesta de contratación' : 'Anuncio pagado'} · {byId[r.agent_id]?.name}
              </span>
              <h4 className="mt-0.5 font-semibold text-slate-900">{r.title}</h4>
            </div>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold',
              r.status === 'pendiente' ? 'bg-amber-100 text-amber-800' : r.status === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              {r.status}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{r.justification}</p>
          {r.expected_results && <p className="mt-2 text-[13px] text-slate-600"><b className="text-slate-800">Resultados esperados:</b> {r.expected_results}</p>}
          {r.kind === 'contratacion' && (
            <p className="mt-2 text-[12px] text-slate-500">
              Modelo: {String((r.payload as any).modelo)} · Herramientas: {((r.payload as any).herramientas ?? []).join(', ')}
            </p>
          )}
          {r.status === 'pendiente' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => onDecide(r.id, true).then(() => toast.success('Aprobado')).catch((e) => toast.error(e.message))}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <Check className="h-4 w-4" />Aprobar
              </button>
              <button onClick={() => onDecide(r.id, false).then(() => toast('Rechazado')).catch((e) => toast.error(e.message))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <X className="h-4 w-4" />Rechazar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function KnowledgeView({ knowledge }: { knowledge: MkKnowledge[] }) {
  const [open, setOpen] = useState<string | null>(knowledge[0]?.slug ?? null);
  const current = knowledge.find((k) => k.slug === open);
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <ul className="space-y-1">
        {knowledge.map((k) => (
          <li key={k.slug}>
            <button onClick={() => setOpen(k.slug)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', open === k.slug ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              <BookOpen className="h-4 w-4 shrink-0" /><span className="truncate">{k.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="text-base font-bold text-slate-900">{current.title}</h4>
          <p className="mb-3 text-[11px] text-slate-400">Actualizado por {current.updated_by} · {fmt(current.updated_at)}</p>
          <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">{current.body.trim()}</div>
        </article>
      )}
    </div>
  );
}

export function TeamCosts({ agents, spend, onSelect }: { agents: MkAgent[]; spend: Record<string, number>; onSelect: (id: string) => void }) {
  const total = Object.values(spend).reduce((a, b) => a + b, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <tr><th className="px-4 py-2.5">Agente</th><th className="px-4 py-2.5">Puesto</th><th className="px-4 py-2.5">Modelo</th><th className="px-4 py-2.5 text-right">Gasto del mes</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {agents.map((a) => (
            <tr key={a.id} onClick={() => onSelect(a.id)} className="cursor-pointer hover:bg-slate-50">
              <td className="px-4 py-2.5 font-semibold text-slate-800"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />{a.name}{!a.enabled && <span className="ml-2 text-[11px] font-normal text-slate-400">(en pausa)</span>}</td>
              <td className="px-4 py-2.5 text-slate-500">{a.title}</td>
              <td className="px-4 py-2.5 text-slate-500">{a.model.replace('claude-', '').replace('-5-5', ' 5.5')}</td>
              <td className="px-4 py-2.5 text-right font-mono text-slate-700">${(spend[a.id] ?? 0).toFixed(3)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold"><td className="px-4 py-2.5" colSpan={3}>Total del mes (incluye imágenes de Gemini)</td><td className="px-4 py-2.5 text-right font-mono">${total.toFixed(3)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function MetaConnect({ status, onConnect }: {
  status: { facebook?: string; instagram?: string | null; expira?: string; conectado?: string } | null;
  onConnect: (token: string) => Promise<any>;
}) {
  const [open, setOpen] = useState(!status);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try {
      const r = await onConnect(token.trim());
      setToken(''); setOpen(false);
      toast.success(`Conectado: Facebook "${r.facebook}"${r.instagram ? ` e Instagram ${r.instagram}` : ''}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (status && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold"><Facebook className="h-4 w-4 text-[#1877F2]" />{status.facebook}</span>
          <span className={cn('inline-flex items-center gap-1.5 font-semibold', !status.instagram && 'text-amber-700')}>
            <Instagram className="h-4 w-4 text-[#DD2A7B]" />{status.instagram ?? 'Instagram sin vincular a la página'}
          </span>
          <span className="text-[12px] text-emerald-700/80">Acceso {status.expira === 'nunca' ? 'permanente' : `hasta ${fmt(status.expira ?? null)}`}</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-[12px] font-semibold text-emerald-800 underline">Reconectar</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1 space-y-2">
          <b>Conectar Facebook e Instagram de VYLTA</b>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed">
            <li>En el <a className="font-semibold underline" target="_blank" rel="noreferrer" href="https://developers.facebook.com/tools/explorer/1130987362599712/">Explorador de la API Graph</a> (app VYLTA Marketing) genera el token con tus 7 permisos.</li>
            <li>Da clic en el ícono <b>ⓘ</b> junto al token → <b>Abrir en la herramienta de token de acceso</b> → <b>Extender token de acceso</b> y copia el token nuevo.</li>
            <li>Pégalo aquí. El servidor obtiene el acceso permanente de la página y lo guarda en privado; no se vuelve a mostrar.</li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega aquí el token extendido"
                   className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" autoComplete="off" />
            <button onClick={connect} disabled={busy || token.trim().length < 40}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
            {status && <button onClick={() => setOpen(false)} className="text-[12px] font-semibold text-amber-800 underline">Cancelar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{text}</p>;
}
