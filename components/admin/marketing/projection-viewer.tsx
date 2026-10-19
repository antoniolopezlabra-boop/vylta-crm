'use client';

import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Film, Image as ImageIcon, LayoutDashboard, Megaphone, Presentation, X } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import type { MkAgent, MkProjection } from '@/hooks/use-marketing';

// ═══════════════════════════════════════════════════════════════════════
// Proyecciones: lo que un agente le muestra al fundador.
//   ProjectionModal  pantalla completa (publicaciones con imágenes, dashboard
//                    de resultados, diapositivas, galería, video, gráfica).
//   ProjectionCard   tarjeta compacta para el chat.
//   RoomScreen       miniatura en SVG para la pantalla de la sala de juntas.
// ═══════════════════════════════════════════════════════════════════════

const KIND: Record<MkProjection['kind'], { label: string; icon: typeof Megaphone }> = {
  publicaciones: { label: 'Publicaciones', icon: Megaphone },
  resultados: { label: 'Resultados', icon: LayoutDashboard },
  presentacion: { label: 'Presentación', icon: Presentation },
  imagenes: { label: 'Imágenes', icon: ImageIcon },
  video: { label: 'Video', icon: Film },
  grafica: { label: 'Gráfica', icon: BarChart3 },
};
const money = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const when = (iso?: string | null) => iso ? new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';
function thumbOf(p: MkProjection): string | null {
  const d = p.payload ?? {};
  return d.posts?.find((x: any) => x.image_url)?.image_url ?? d.urls?.[0] ?? d.diapositivas?.find((x: any) => x.imagen_url)?.imagen_url ?? null;
}
function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function ProjectionCard({ p, agent, onOpen }: { p: MkProjection; agent?: MkAgent; onOpen: (p: MkProjection) => void }) {
  const K = KIND[p.kind]; const thumb = thumbOf(p);
  return (
    <button onClick={() => onOpen(p)} className="group mt-1.5 flex w-full max-w-[300px] items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-sky-300 hover:shadow">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-900">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <K.icon className="absolute inset-0 m-auto h-6 w-6 text-sky-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">{K.label}{agent ? ` · ${agent.name.split(' ')[0]}` : ''}</div>
        <div className="truncate text-[13px] font-semibold text-slate-900">{p.title}</div>
        <div className="text-[11px] text-slate-500 group-hover:text-sky-600">Ver en grande →</div>
      </div>
    </button>
  );
}

export function ProjectionModal({ p, agents, onClose }: { p: MkProjection; agents: MkAgent[]; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const K = KIND[p.kind]; const who = agents.find((a) => a.id === p.agent_id);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0B1120] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><K.icon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">Sala de juntas · {K.label}</div>
            <h3 className="truncate text-lg font-bold">{p.title}</h3>
          </div>
          {who && <span className="hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline" style={{ background: `${who.color}22`, color: who.color }}>Presenta {who.name}</span>}
          <button onClick={onClose} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {p.payload?.comentario && <p className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{p.payload.comentario}</p>}
          <ProjectionBody p={p} />
        </div>
      </div>
    </div>
  );
}

export function ProjectionBody({ p }: { p: MkProjection }) {
  const d = p.payload ?? {};
  switch (p.kind) {
    case 'publicaciones': return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(d.posts ?? []).map((x: any) => (
          <article key={x.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            <div className="relative aspect-[4/5] bg-slate-900">
              {x.image_url ? <img src={x.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/40">Imagen en proceso</div>}
              <span className={cn('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold', x.channel === 'facebook' ? 'bg-[#1877F2]' : 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]')}>{x.channel === 'facebook' ? 'Facebook' : 'Instagram'}</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold">{x.status === 'publicado' ? `Publicado · ${when(x.published_at)}` : `Programado · ${when(x.scheduled_for)}`}</span>
            </div>
            <p className="whitespace-pre-wrap p-4 text-[13px] leading-relaxed text-white/80">{x.caption}</p>
          </article>
        ))}
      </div>
    );
    case 'resultados': {
      const k = d.kpis ?? {};
      const series = (d.dias ?? []).map((dia: string, i: number) => ({ dia: dia.slice(5), registros: d.registros_por_dia?.[i] ?? 0 }));
      const tiles = [
        { l: 'Negocios pagando', v: k.pagados_activos ?? 0, s: `+${k.pagados_nuevos_mes ?? 0} este mes`, c: '#F59E0B' },
        { l: 'MRR', v: money(k.mrr_mxn), s: 'MXN al mes', c: '#10B981' },
        { l: 'Registros 30 días', v: k.registros_30d ?? 0, s: `${k.registros_7d ?? 0} en 7 días`, c: '#38BDF8' },
        { l: 'Negocios totales', v: k.negocios_total ?? 0, s: `${k.vencidos ?? 0} vencidos`, c: '#A78BFA' },
        { l: 'Publicaciones 30 días', v: d.publicaciones?.publicadas ?? 0, s: `FB ${d.publicaciones?.facebook ?? 0} · IG ${d.publicaciones?.instagram ?? 0}`, c: '#EC4899' },
        { l: 'Gasto IA 30 días', v: `$${Number(d.gasto_ia_30d ?? 0).toFixed(2)}`, s: `tope $${k.tope_mes_usd ?? 0} USD/mes`, c: '#94A3B8' },
      ];
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.l} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{t.l}</div>
                <div className="mt-1 text-2xl font-extrabold" style={{ color: t.c }}>{t.v}</div>
                <div className="text-[11px] text-white/50">{t.s}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="mb-2 text-sm font-semibold text-white/80">Registros de negocios por día (30 días)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <XAxis dataKey="dia" tick={{ fill: '#94A3B8', fontSize: 11 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 11 }} width={28} />
                  <Tooltip cursor={{ fill: '#ffffff0d' }} contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 12 }} />
                  <Bar dataKey="registros" name="Registros" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }
    case 'presentacion': return <Slides slides={d.diapositivas ?? []} />;
    case 'imagenes': return (
      <div className={cn('grid gap-4', (d.urls ?? []).length > 1 ? 'sm:grid-cols-2' : '')}>
        {(d.urls ?? []).map((u: string) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" className="w-full rounded-2xl border border-white/10" /></a>)}
      </div>
    );
    case 'video': {
      const yt = youtubeEmbed(d.url ?? '');
      return yt
        ? <div className="aspect-video overflow-hidden rounded-2xl"><iframe src={yt} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={p.title} /></div>
        : <video src={d.url} controls className="w-full rounded-2xl bg-black" />;
    }
    case 'grafica': return (
      <div className="h-80 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.serie ?? []}>
            <XAxis dataKey="etiqueta" tick={{ fill: '#94A3B8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} width={40} />
            <Tooltip formatter={(v: number) => `${v} ${d.unidad ?? ''}`} contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 12 }} />
            <Bar dataKey="valor" fill="#38BDF8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return null;
}

function Slides({ slides }: { slides: { titulo: string; puntos?: string[]; imagen_url?: string | null }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [slides.length]);
  const s = slides[i]; if (!s) return null;
  return (
    <div>
      <div className="relative grid min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1A2E] to-[#0B1120] md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col justify-center gap-5 p-10">
          <div className="text-[11px] font-bold uppercase tracking-[.2em] text-sky-300">Diapositiva {i + 1} de {slides.length}</div>
          <h4 className="text-3xl font-extrabold leading-tight">{s.titulo}</h4>
          <ul className="space-y-3">
            {(s.puntos ?? []).map((pt, k) => <li key={k} className="flex gap-3 text-[15px] text-white/80"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />{pt}</li>)}
          </ul>
        </div>
        {s.imagen_url && <img src={s.imagen_url} alt="" className="h-full w-full object-cover" />}
      </div>
      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded-xl border border-white/10 p-2 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          {slides.map((_, k) => <button key={k} onClick={() => setI(k)} className={cn('h-2 rounded-full transition-all', k === i ? 'w-6 bg-sky-400' : 'w-2 bg-white/25')} aria-label={`Diapositiva ${k + 1}`} />)}
          <button onClick={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} className="rounded-xl border border-white/10 p-2 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}

// ── Miniatura para la pantalla de la sala (SVG, coordenadas locales) ──
export function RoomScreen({ w, h, p, topic, live }: { w: number; h: number; p: MkProjection | null; topic: string | null; live: boolean }) {
  const d = p?.payload ?? {};
  const pad = 4, iw = w - pad * 2, ih = h - 14;
  let body: React.ReactNode = null;
  if (p) {
    switch (p.kind) {
      case 'publicaciones': case 'imagenes': {
        const imgs: string[] = p.kind === 'imagenes' ? d.urls ?? [] : (d.posts ?? []).map((x: any) => x.image_url).filter(Boolean);
        const n = Math.min(4, Math.max(1, imgs.length)); const cw = (iw - (n - 1) * 3) / n;
        body = imgs.slice(0, 4).map((u, i) => <image key={i} href={u} x={pad + i * (cw + 3)} y={11} width={cw} height={ih - 2} preserveAspectRatio="xMidYMid slice" />);
        break;
      }
      case 'resultados': {
        const k = d.kpis ?? {};
        const tiles = [['PAGANDO', String(k.pagados_activos ?? 0), '#F59E0B'], ['MRR', money(k.mrr_mxn), '#10B981'], ['REGISTROS 30D', String(k.registros_30d ?? 0), '#38BDF8']];
        const reg: number[] = d.registros_por_dia ?? []; const mx = Math.max(1, ...reg);
        const pts = reg.map((v, i) => `${pad + 2 + (i * (iw * 0.5)) / Math.max(1, reg.length - 1)},${h - 4 - (v / mx) * (ih * 0.55)}`).join(' ');
        body = <>
          {tiles.map(([l, v, c], i) => <g key={l} transform={`translate(${pad + i * (iw * 0.16 + 2)},11)`}><rect width={iw * 0.16} height={14} rx={1.5} fill="#0E1729" stroke={`${c}66`} strokeWidth={0.4} /><text x={2} y={4.5} fontSize={2.4} fill="#64748B" fontWeight={700}>{l}</text><text x={2} y={11} fontSize={5.2} fill={c} fontWeight={800}>{v}</text></g>)}
          <polyline points={pts} fill="none" stroke="#38BDF8" strokeWidth={0.9} />
        </>;
        break;
      }
      case 'presentacion': {
        const s = d.diapositivas?.[0] ?? {};
        body = <>
          <text x={pad + 2} y={19} fontSize={5} fontWeight={800} fill="#F8FAFC">{String(s.titulo ?? '').slice(0, 48)}</text>
          {(s.puntos ?? []).slice(0, 3).map((t: string, i: number) => <text key={i} x={pad + 4} y={27 + i * 6} fontSize={3.2} fill="#CBD5E1">• {t.slice(0, 64)}</text>)}
          {s.imagen_url && <image href={s.imagen_url} x={w * 0.66} y={11} width={w * 0.3} height={ih - 2} preserveAspectRatio="xMidYMid slice" />}
        </>;
        break;
      }
      case 'video':
        body = <><rect x={pad} y={11} width={iw} height={ih - 2} rx={2} fill="#000" /><path d={`M${w / 2 - 5},${h / 2 - 2} L${w / 2 + 6},${h / 2 + 4} L${w / 2 - 5},${h / 2 + 10} Z`} fill="#fff" opacity={0.85} /></>;
        break;
      case 'grafica': {
        const serie: { valor: number }[] = d.serie ?? []; const mx = Math.max(1, ...serie.map((x) => Math.abs(x.valor)));
        const bw = iw / Math.max(1, serie.length) - 2;
        body = serie.slice(0, 16).map((x, i) => { const bh = (Math.abs(x.valor) / mx) * (ih - 6); return <rect key={i} x={pad + i * (bw + 2)} y={h - 3 - bh} width={bw} height={bh} rx={0.8} fill="#38BDF8" />; });
        break;
      }
    }
  }
  return (
    <g style={{ cursor: 'pointer' }}>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="url(#screenBg)" />
      <circle cx={6} cy={5} r={1.8} fill={live ? '#EF4444' : '#334155'} className={live ? 'mk-blink-fast' : undefined} />
      <text x={10} y={6.8} fontSize={4.2} fontWeight={800} fill="#E2E8F0">{p ? `${p.title}`.slice(0, 60).toUpperCase() : live ? `REUNIÓN · ${(topic ?? '').toUpperCase()}`.slice(0, 60) : 'SALA DE JUNTAS · DISPONIBLE'}</text>
      <text x={w - 4} y={6.8} fontSize={3.2} fill="#7DD3FC" textAnchor="end">{live ? 'clic para entrar a la reunión' : 'clic para convocar una reunión'}</text>
      {body ?? (
        <g opacity={0.5}>
          <rect x={w / 2 - 9} y={h / 2 - 6} width={18} height={18} rx={4.5} fill="none" stroke="#34D399" strokeWidth={1.6} />
          <path d={`M${w / 2 - 4.5},${h / 2 - 1.5} L${w / 2},${h / 2 + 7} L${w / 2 + 4.5},${h / 2 - 1.5}`} fill="none" stroke="#34D399" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}
