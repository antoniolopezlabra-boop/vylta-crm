'use client';

import { useState } from 'react';
import { Facebook, Instagram, Check, X, Trash2, BookOpen, AlertTriangle, Megaphone, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MkActivity, MkAgent, MkKnowledge, MkPost, MkRequest } from '@/hooks/use-marketing';
import type { MkComment } from '@/hooks/use-marketing';

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
  requests: MkRequest[]; agents: MkAgent[]; onDecide: (id: string, approve: boolean) => Promise<{ titulo: string; resultado: string; mensaje: string }[]>;
}) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  const [busyId, setBusyId] = useState<string | null>(null);
  // Al decidir se aplica de inmediato y se muestra qué pasó (en anuncios: si
  // se encendió en Meta o por qué no), para que nunca parezca que no hizo nada.
  const decide = async (r: MkRequest, approve: boolean) => {
    setBusyId(r.id);
    const t = toast.loading(r.kind === 'anuncio' ? (approve ? 'Encendiendo la campaña en Meta…' : 'Eliminando la campaña de Meta…') : 'Guardando tu decisión…');
    try {
      const res = await onDecide(r.id, approve);
      const mine = res.find((x) => x.titulo === r.title) ?? res[0];
      if (r.kind === 'anuncio' && mine) {
        (mine.resultado === 'error' ? toast.error : toast.success)(mine.mensaje, { id: t, duration: 9000 });
      } else {
        toast.success(approve ? 'Aprobado' : 'Rechazado', { id: t });
      }
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally { setBusyId(null); }
  };
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
          {r.kind === 'anuncio' && <AdDetails p={(r.payload ?? {}) as any} />}
          {r.kind === 'contratacion' && (
            <p className="mt-2 text-[12px] text-slate-500">
              Modelo: {String((r.payload as any)?.modelo ?? '—')} · Herramientas: {((r.payload as any)?.herramientas ?? []).join(', ')}
            </p>
          )}
          {r.status === 'pendiente' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => decide(r, true)} disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <Check className="h-4 w-4" />Aprobar
              </button>
              <button onClick={() => decide(r, false)} disabled={busyId === r.id}
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

export function MetaConnect({ status, onConnect, onConnectInstagram }: {
  status: { facebook?: string; instagram?: string | null; expira?: string; conectado?: string } | null;
  onConnect: (token: string) => Promise<any>;
  onConnectInstagram: (token: string) => Promise<any>;
}) {
  const [open, setOpen] = useState(!status?.facebook || !status?.instagram);
  const [fbToken, setFbToken] = useState('');
  const [igToken, setIgToken] = useState('');
  const [busy, setBusy] = useState<'fb' | 'ig' | null>(null);
  const run = async (kind: 'fb' | 'ig') => {
    setBusy(kind);
    try {
      const r = kind === 'fb' ? await onConnect(fbToken.trim()) : await onConnectInstagram(igToken.trim());
      if (kind === 'fb') setFbToken(''); else setIgToken('');
      toast.success(kind === 'fb' ? `Facebook conectado: "${r.facebook}"` : `Instagram conectado: ${r.instagram}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  if (status?.facebook && status?.instagram && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold"><Facebook className="h-4 w-4 text-[#1877F2]" />{status.facebook}</span>
          <span className="inline-flex items-center gap-1.5 font-semibold"><Instagram className="h-4 w-4 text-[#DD2A7B]" />{status.instagram}</span>
          <span className="text-[12px] text-emerald-700/80">Conectado · las publicaciones salen solas</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-[12px] font-semibold text-emerald-800 underline">Reconectar</button>
      </div>
    );
  }
  const Step = ({ done, icon, title, children }: { done: boolean; icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className={cn('rounded-xl border p-3', done ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-white')}>
      <div className="mb-1.5 flex items-center gap-2 font-semibold">{icon}{title}{done && <Check className="h-4 w-4 text-emerald-600" />}</div>
      {children}
    </div>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" />Conectar las redes sociales de VYLTA</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Step done={!!status?.facebook} icon={<Facebook className="h-4 w-4 text-[#1877F2]" />} title={status?.facebook ? `Facebook: ${status.facebook}` : 'Facebook'}>
          <p className="mb-2 text-[12.5px] leading-relaxed">Explorador de la API Graph (app VYLTA Marketing) → en <b>Permisos</b> incluye <code>pages_manage_posts</code>, <code>pages_read_engagement</code>, <code>pages_read_user_content</code> y <code>pages_manage_engagement</code> (estos dos últimos son para leer y contestar comentarios) → genera el token → ícono <b>ⓘ</b> → <b>Abrir en la herramienta de token</b> → <b>Extender token de acceso</b> → cópialo y pégalo:</p>
          <div className="flex gap-2">
            <input type="password" value={fbToken} onChange={(e) => setFbToken(e.target.value)} placeholder="Token extendido de Facebook" autoComplete="off"
                   className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400" />
            <button onClick={() => run('fb')} disabled={busy !== null || fbToken.trim().length < 40} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{busy === 'fb' ? 'Conectando…' : 'Conectar'}</button>
          </div>
        </Step>
        <Step done={!!status?.instagram} icon={<Instagram className="h-4 w-4 text-[#DD2A7B]" />} title={status?.instagram ? `Instagram: ${status.instagram}` : 'Instagram'}>
          <p className="mb-2 text-[12.5px] leading-relaxed">App VYLTA Marketing → Casos de uso → Instagram → <b>Configuración de la API con inicio de sesión de Instagram</b> → <b>Generar token de acceso</b> (agrega @vylta_pro) → cópialo y pégalo:</p>
          <div className="flex gap-2">
            <input type="password" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder="Token de Instagram" autoComplete="off"
                   className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400" />
            <button onClick={() => run('ig')} disabled={busy !== null || igToken.trim().length < 40} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{busy === 'ig' ? 'Conectando…' : 'Conectar'}</button>
          </div>
        </Step>
      </div>
      <p className="text-[11.5px] text-amber-800/80">Los tokens se guardan en privado en el servidor y no se vuelven a mostrar. El de Instagram se renueva solo.</p>
      {status?.facebook && status?.instagram && <button onClick={() => setOpen(false)} className="text-[12px] font-semibold underline">Cerrar</button>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{text}</p>;
}

const COMMENT_STATUS: Record<MkComment['status'], { label: string; cls: string }> = {
  nuevo: { label: 'Nuevo', cls: 'bg-sky-100 text-sky-700' },
  respondido: { label: 'Respondido', cls: 'bg-emerald-100 text-emerald-700' },
  escalado: { label: 'Escalado al Director', cls: 'bg-amber-100 text-amber-800' },
  ignorado: { label: 'Ignorado', cls: 'bg-slate-100 text-slate-500' },
  oculto: { label: 'Oculto (dañino)', cls: 'bg-red-100 text-red-700' },
};

// Comentarios de la gente en Facebook e Instagram y cómo los atendió Mariana.
export function CommentsView({ comments, onUnhide }: { comments: MkComment[]; onUnhide: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState<'todos' | MkComment['status']>('todos');
  const list = comments.filter((c) => filter === 'todos' || c.status === filter);
  if (!comments.length) return <Empty text="Aún no hay comentarios en nuestras publicaciones. Cuando alguien comente, Mariana lo atiende y aquí verás su respuesta." />;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['todos', 'nuevo', 'respondido', 'escalado', 'oculto', 'ignorado'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-2.5 py-1 text-[12px] font-semibold', filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            {f === 'todos' ? 'Todos' : COMMENT_STATUS[f].label} ({f === 'todos' ? comments.length : comments.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>
      <ul className="space-y-2.5">
        {list.map((c) => (
          <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn('rounded-full px-2 py-0.5 font-bold text-white', c.channel === 'facebook' ? 'bg-[#1877F2]' : 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]')}>{c.channel === 'facebook' ? 'Facebook' : 'Instagram'}</span>
              <span className="font-semibold text-slate-700">{c.author ?? 'Usuario'}</span>
              {c.commented_at && <span className="text-slate-400">{new Date(c.commented_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
              <span className={cn('ml-auto rounded-full px-2 py-0.5 font-bold', COMMENT_STATUS[c.status].cls)}>{COMMENT_STATUS[c.status].label}</span>
            </div>
            <p className="mt-2 text-[13px] text-slate-800">{c.text}</p>
            {c.reply_text && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900"><b>VYLTA:</b> {c.reply_text}</p>}
            {c.note && c.status !== 'respondido' && <p className="mt-1.5 text-[12px] text-slate-500">Nota: {c.note}</p>}
            {c.status === 'oculto' && (
              <button onClick={() => onUnhide(c.id).then(() => toast.success('El comentario vuelve a estar visible')).catch((e) => toast.error(e.message))}
                      className="mt-2 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Mostrar de nuevo</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Detalle de una campaña propuesta por Lucía: lo que se va a gastar, a quién y cómo se ve.
function AdDetails({ p }: { p: Record<string, any> }) {
  // Una imagen por versión (A, B…); las campañas viejas solo traen imagen_url.
  const imgs: string[] = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : p.imagen_url ? [p.imagen_url] : [];
  return (
    <div className="mt-3 flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3">
      {imgs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {imgs.map((src, i) => (
            <a key={src} href={src} target="_blank" rel="noreferrer" className="block text-center" title="Abrir en tamaño completo">
              <img src={src} alt={`Imagen del anuncio, versión ${String.fromCharCode(65 + i)}`} className="h-64 w-auto rounded-lg border border-slate-200 bg-white object-contain" />
              {imgs.length > 1 && <span className="mt-1 block text-[11px] font-semibold text-slate-500">Versión {String.fromCharCode(65 + i)}</span>}
            </a>
          ))}
        </div>
      )}
      <div className="min-w-[220px] flex-1 space-y-1 text-[12.5px] text-slate-600">
        <p><b className="text-slate-800">Presupuesto:</b> ${p.diario_mxn} MXN al día × {p.dias} días = <b>${p.total_mxn} MXN</b> (máximo)</p>
        {p.segmentacion && <p><b className="text-slate-800">Público:</b> {p.segmentacion}</p>}
        {p.destino && <p className="truncate"><b className="text-slate-800">Lleva a:</b> {p.destino}</p>}
        {p.preview_url && <a href={p.preview_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" />Ver cómo se verá en Facebook</a>}
        {p.activada_at && <p className="font-semibold text-emerald-700">Encendida el {new Date(p.activada_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        {p.pausada && <p className="font-semibold text-amber-700">Pausada por Lucía: {p.motivo_pausa}</p>}
        {p.eliminada && <p className="text-slate-500">Eliminada de Meta sin gastar.</p>}
        {p.error_activacion && <p className="font-semibold text-rose-700">No se pudo encender: {p.error_activacion}</p>}
      </div>
    </div>
  );
}

// Conexión de anuncios: token del usuario del sistema "VYLTA Agentes".
export function AdsConnect({ status, onConnect }: {
  status: { usuario?: string; cuenta?: string; estado?: string; moneda?: string } | null;
  onConnect: (token: string) => Promise<any>;
}) {
  const [open, setOpen] = useState(!status?.cuenta);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await onConnect(token.trim());
      setToken(''); setOpen(false);
      toast.success(`Anuncios conectados: ${r.cuenta} (${r.estado})`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (status?.cuenta && !open) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="inline-flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4" />Anuncios en Meta: {status.cuenta} · {status.estado}</span>
        <button onClick={() => setOpen(true)} className="text-[12px] font-semibold text-emerald-800 underline">Cambiar token</button>
      </div>
    );
  }
  return (
    <div className="mb-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold"><Megaphone className="h-5 w-5" />Conectar anuncios (para que Lucía arme campañas)</div>
      <p className="text-[12.5px] leading-relaxed">
        Meta Business → Configuración del negocio → <b>Usuarios del sistema</b> → <b>VYLTA Agentes</b> → <b>Generar token</b> → app <b>VYLTA Marketing</b> → caducidad <b>Nunca</b> →
        permisos <code>ads_management</code>, <code>ads_read</code>, <code>business_management</code>, <code>pages_manage_ads</code>, <code>pages_read_engagement</code>, <code>pages_show_list</code> → copia y pega aquí:
      </p>
      <div className="flex gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de VYLTA Agentes" autoComplete="off"
               className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400" />
        <button onClick={run} disabled={busy || token.trim().length < 40} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Conectando…' : 'Conectar'}</button>
      </div>
      <p className="text-[11.5px] text-amber-800/80">El token se guarda en privado en el servidor y no se vuelve a mostrar. Lucía solo puede crear campañas en pausa; tú las apruebas aquí.</p>
      {status?.cuenta && <button onClick={() => setOpen(false)} className="text-[12px] font-semibold underline">Cerrar</button>}
    </div>
  );
}
