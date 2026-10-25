'use client';

import { useState } from 'react';
import { BadgeDollarSign, RefreshCw, Loader2, Pencil, Check, Eye, MousePointerClick, UserPlus, Heart, MessageCircle, Share2, Globe, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════
// Tablero de pauta — el dinero de anuncios y lo que produce.
//
// Lo arma el motor (mk-engine, acción ads_dashboard) y lo guarda en
// mk_settings.ads_snapshot; Andrés y el equipo leen el mismo tablero con la
// herramienta ver_tablero_pauta. Aquí el fundador también registra cuánto
// cargó en Meta ("Saldo cargado"): es la bolsa que el equipo no puede rebasar.
// ═══════════════════════════════════════════════════════════════════════

type Stats = { gasto: number; alcance: number; impresiones: number; clics: number; visitas: number; leads: number; costo_por_clic: number | null; costo_por_visita: number | null; ctr_pct: number | null };
export type AdsSnapshot = {
  actualizado: string; conectado: boolean;
  bolsa: { cargado_mxn: number; gastado_mxn: number; comprometido_mxn: number; disponible_mxn: number; max_diario_mxn: number } | null;
  hoy: Stats; ultimos_7d: Stats; total: Stats;
  campanas: (Stats & { titulo: string; estado: string; presupuesto_mxn: number })[];
  sitio_desde_anuncios_7d: { sesiones: number; clics_descargar_o_registro: number };
  registros_desde_anuncios: { total: number; ultimos_7d: number; costo_por_registro: number | null };
  organico_7d: { publicaciones: number; reacciones: number; comentarios: number; compartidos: number; guardados: number; alcance_instagram: number; visitas_web: number; clics_descargar: number; clics_registro: number };
};

const mxn = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`);
const num = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));

export function AdsDashboard({ snapshot, policy, supabase, onRefresh }: {
  snapshot: AdsSnapshot | null;
  policy: { bolsa_mxn?: number; max_diario_mxn?: number } | null;
  supabase: SupabaseClient;
  onRefresh: () => Promise<AdsSnapshot>;
}) {
  const [snap, setSnap] = useState<AdsSnapshot | null>(snapshot);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bolsa, setBolsa] = useState(String(policy?.bolsa_mxn ?? ''));
  const [diario, setDiario] = useState(String(policy?.max_diario_mxn ?? ''));
  const s = snap ?? snapshot;

  const refresh = async () => {
    setBusy(true);
    try { setSnap(await onRefresh()); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const saveBolsa = async () => {
    const b = Number(bolsa), d = Number(diario);
    if (!(b >= 0) || !(d >= 20)) return toast.error('Revisa los montos: el tope diario mínimo es $20.');
    const { error } = await supabase.from('mk_settings').update({ value: { ...(policy ?? {}), bolsa_mxn: b, max_diario_mxn: d }, updated_at: new Date().toISOString() }).eq('key', 'ads_policy');
    if (error) return toast.error(error.message);
    setEditing(false);
    toast.success('Bolsa de pauta actualizada');
    await refresh();
  };

  if (!s?.conectado) return null;
  const b = s.bolsa;
  const usedPct = b && b.cargado_mxn > 0 ? Math.min(100, ((b.gastado_mxn + b.comprometido_mxn) / b.cargado_mxn) * 100) : 0;
  const spentPct = b && b.cargado_mxn > 0 ? Math.min(100, (b.gastado_mxn / b.cargado_mxn) * 100) : 0;
  const t = s.ultimos_7d;

  return (
    <section aria-label="Pauta pagada" className="overflow-hidden rounded-3xl bg-[#0C1220] ring-1 ring-white/[.08]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><BadgeDollarSign className="h-4 w-4" /></span>
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-white">Pauta pagada · Meta</h2>
            <p className="text-[11.5px] text-[#6B778C]">Actualizado {new Date(s.actualizado).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} · Andrés y el equipo ven este mismo tablero</p>
          </div>
        </div>
        <button onClick={refresh} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-[#CBD5E1] ring-1 ring-white/10 hover:bg-white/[.06] disabled:opacity-40">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Actualizar
        </button>
      </header>

      <div className="grid gap-px bg-white/[.06] lg:grid-cols-[340px_1fr]">
        {/* Dinero */}
        <div className="bg-[#0C1220] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-[#8B97AB]">Bolsa de pauta</span>
            {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-sky-300 hover:text-sky-200"><Pencil className="h-3 w-3" />Saldo cargado</button>}
          </div>
          {editing ? (
            <div className="mt-3 space-y-2 text-[12.5px] text-[#CBD5E1]">
              <label className="flex items-center justify-between gap-2">Total cargado en Meta (MXN)
                <input value={bolsa} onChange={(e) => setBolsa(e.target.value)} inputMode="decimal" className="w-24 rounded-md bg-white/[.06] px-2 py-1 text-right text-white ring-1 ring-white/10 outline-none" />
              </label>
              <label className="flex items-center justify-between gap-2">Tope por día (MXN)
                <input value={diario} onChange={(e) => setDiario(e.target.value)} inputMode="decimal" className="w-24 rounded-md bg-white/[.06] px-2 py-1 text-right text-white ring-1 ring-white/10 outline-none" />
              </label>
              <p className="text-[11px] text-[#6B778C]">Súmale cada depósito que hagas en Meta. El equipo nunca propone más de lo disponible.</p>
              <div className="flex gap-2">
                <button onClick={saveBolsa} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-[#0B1020]"><Check className="h-3.5 w-3.5" />Guardar</button>
                <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#8B97AB] ring-1 ring-white/10">Cancelar</button>
              </div>
            </div>
          ) : b && (
            <>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[30px] font-bold leading-none tracking-tight text-white tabular-nums">{mxn(b.disponible_mxn)}</span>
                <span className="text-sm font-semibold text-[#6B778C]">libres de {mxn(b.cargado_mxn)}</span>
              </div>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]">
                <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400/50" style={{ width: `${usedPct}%` }} />
                <div className={cn('absolute inset-y-0 left-0 rounded-full', spentPct > 85 ? 'bg-rose-500' : 'bg-emerald-400')} style={{ width: `${spentPct}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div><dt className="text-[#6B778C]">Gastado</dt><dd className="font-bold text-emerald-300 tabular-nums">{mxn(b.gastado_mxn)}</dd></div>
                <div><dt className="text-[#6B778C]">Comprometido</dt><dd className="font-bold text-amber-300 tabular-nums">{mxn(b.comprometido_mxn)}</dd></div>
                <div><dt className="text-[#6B778C]">Hoy</dt><dd className="font-bold text-white tabular-nums">{mxn(s.hoy.gasto)}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-[#6B778C]">Tope por día: {mxn(b.max_diario_mxn)} · nada se enciende sin tu aprobación en Solicitudes</p>
            </>
          )}
        </div>

        {/* Resultados */}
        <div className="bg-[#0C1220] p-5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-[#8B97AB]">Anuncios · últimos 7 días</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={BadgeDollarSign} label="Gasto" value={mxn(t.gasto)} sub={`Total ${mxn(s.total.gasto)}`} />
            <Kpi icon={Eye} label="Alcance" value={num(t.alcance)} sub={`${num(t.impresiones)} impresiones`} />
            <Kpi icon={MousePointerClick} label="Clics al sitio" value={num(t.clics)} sub={t.ctr_pct != null ? `CTR ${t.ctr_pct}% · ${mxn(t.costo_por_clic)} c/u` : 'sin datos aún'} />
            <Kpi icon={Globe} label="Visitas a la página" value={num(t.visitas)} sub={t.costo_por_visita != null ? `${mxn(t.costo_por_visita)} por visita` : 'sin datos aún'} />
            <Kpi icon={Target} label="Leads (píxel)" value={num(t.leads)} sub="clics a descargar o registrarse" />
            <Kpi icon={UserPlus} label="Registros por anuncios" value={num(s.registros_desde_anuncios.total)} sub={s.registros_desde_anuncios.costo_por_registro != null ? `${mxn(s.registros_desde_anuncios.costo_por_registro)} por registro` : `${s.registros_desde_anuncios.ultimos_7d} en 7 días`} highlight />
          </div>

          {s.campanas.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="text-[10.5px] uppercase tracking-wider text-[#6B778C]">
                  <tr><th className="py-1.5 pr-3 font-semibold">Campaña</th><th className="pr-3 font-semibold">Estado</th><th className="pr-3 text-right font-semibold">Gasto / presupuesto</th><th className="pr-3 text-right font-semibold">Alcance</th><th className="pr-3 text-right font-semibold">Clics</th><th className="pr-3 text-right font-semibold">Visitas</th><th className="text-right font-semibold">$ por visita</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[.05] text-[#CBD5E1]">
                  {s.campanas.map((c, i) => (
                    <tr key={i}>
                      <td className="max-w-[260px] truncate py-2 pr-3 font-medium text-white" title={c.titulo}>{c.titulo.replace(/^Campaña: /, '')}</td>
                      <td className="pr-3"><span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                        c.estado === 'encendida' ? 'bg-emerald-400/15 text-emerald-300' : c.estado === 'esperando tu aprobación' ? 'bg-amber-400/15 text-amber-300' : c.estado === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/[.06] text-[#8B97AB]')}>{c.estado}</span></td>
                      <td className="pr-3 text-right tabular-nums">{mxn(c.gasto)} / {mxn(c.presupuesto_mxn)}</td>
                      <td className="pr-3 text-right tabular-nums">{num(c.alcance)}</td>
                      <td className="pr-3 text-right tabular-nums">{num(c.clics)}</td>
                      <td className="pr-3 text-right tabular-nums">{num(c.visitas)}</td>
                      <td className="text-right tabular-nums">{mxn(c.costo_por_visita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 border-t border-white/[.06] pt-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-[#8B97AB]">Publicaciones orgánicas · últimos 7 días</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[#CBD5E1]">
              <span><b className="text-white tabular-nums">{s.organico_7d.publicaciones}</b> publicaciones</span>
              <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-pink-300" /><b className="text-white tabular-nums">{s.organico_7d.reacciones}</b> reacciones</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-sky-300" /><b className="text-white tabular-nums">{s.organico_7d.comentarios}</b> comentarios</span>
              <span className="inline-flex items-center gap-1"><Share2 className="h-3.5 w-3.5 text-violet-300" /><b className="text-white tabular-nums">{s.organico_7d.compartidos}</b> compartidos</span>
              <span><b className="text-white tabular-nums">{s.organico_7d.alcance_instagram}</b> alcance en Instagram</span>
              <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-emerald-300" /><b className="text-white tabular-nums">{s.organico_7d.visitas_web}</b> visitas web</span>
              <span><b className="text-white tabular-nums">{s.organico_7d.clics_descargar + s.organico_7d.clics_registro}</b> clics a descargar/registrarse</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub, highlight }: { icon: typeof Eye; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-2xl p-3 ring-1', highlight ? 'bg-emerald-400/[.07] ring-emerald-400/25' : 'bg-white/[.03] ring-white/[.06]')}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8B97AB]"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1.5 text-[20px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</div>
      <div className="mt-1 truncate text-[11px] text-[#6B778C]" title={sub}>{sub}</div>
    </div>
  );
}
