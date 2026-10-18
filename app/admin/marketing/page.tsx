'use client';

import { useState } from 'react';
import { Loader2, Pause, Play, Zap, Users, Wallet, TrendingUp, UserPlus, Megaphone, Crown, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useMarketing } from '@/hooks/use-marketing';
import { OfficeFloor } from '@/components/admin/marketing/office-floor';
import { AgentPanel } from '@/components/admin/marketing/agent-panel';
import { ActivityFeed, KnowledgeView, MetaConnect, PostsGrid, RequestsList, TeamCosts } from '@/components/admin/marketing/marketing-sections';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// Marketing — la oficina de agentes de IA de VYLTA
//
// Arriba: lo que persigue el Director de Ventas (negocios que pagan, MRR,
// registros) y el gasto de IA contra el tope del mes.
// Centro: la oficina viva; tocar a un agente abre su ficha y su chat.
// Abajo: bitácora en vivo, publicaciones, solicitudes, manual y costos.
// Motor: edge function mk-engine (cada 10 min, ver vylta-app).
// ═══════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'feed', label: 'En vivo' },
  { id: 'posts', label: 'Publicaciones' },
  { id: 'requests', label: 'Solicitudes' },
  { id: 'manual', label: 'Manual del equipo' },
  { id: 'costs', label: 'Equipo y costos' },
] as const;

export default function MarketingPage() {
  const mk = useMarketing();
  const [selected, setSelected] = useState<string | null>('director');
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('feed');
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const agent = mk.agents.find((a) => a.id === selected) ?? mk.agents.find((a) => a.id === 'director');
  const pendingRequests = mk.requests.filter((r) => r.status === 'pendiente').length;
  const paused = !!mk.settings.autopilot?.paused;
  const k = mk.kpis;
  const spendPct = k && k.tope_mes_usd ? Math.min(100, (k.gasto_mes_usd / k.tope_mes_usd) * 100) : 0;
  const workingNow = mk.agents.filter((a) => a.enabled && a.status !== 'idle' && a.status !== 'paused').length;

  if (mk.loading) {
    return <div className="flex h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abriendo la oficina…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Marketing</h1>
          <p className="text-sm text-slate-500">
            Tu equipo de agentes de IA trabajando para que más negocios paguen VYLTA ·{' '}
            <span className="font-semibold text-emerald-600">{workingNow > 0 ? `${workingNow} trabajando ahora` : 'en espera del siguiente ciclo'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => { setRunning(true); try { await mk.runNow(); toast.success('El equipo revisó su trabajo pendiente'); } catch (e) { toast.error((e as Error).message); } finally { setRunning(false); } }}
            disabled={running || paused}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-500" />}Trabajar ahora
          </button>
          <button
            onClick={() => mk.setPaused(!paused).then(() => toast.success(paused ? 'Equipo reactivado' : 'Equipo en pausa')).catch((e) => toast.error(e.message))}
            className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white', paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800')}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{paused ? 'Reactivar equipo' : 'Pausar equipo'}
          </button>
        </div>
      </div>

      {/* Indicadores que persigue el Director */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Crown} label="Negocios pagando" value={k?.pagados_activos ?? 0} sub={`+${k?.pagados_nuevos_mes ?? 0} este mes`} accent="text-amber-600" />
        <Kpi icon={TrendingUp} label="MRR" value={`$${Number(k?.mrr_mxn ?? 0).toLocaleString('es-MX')}`} sub="MXN al mes" accent="text-emerald-600" />
        <Kpi icon={UserPlus} label="Registros" value={k?.registros_30d ?? 0} sub={`${k?.registros_7d ?? 0} en 7 días`} accent="text-sky-600" />
        <Kpi icon={Users} label="Negocios totales" value={k?.negocios_total ?? 0} sub={`${k?.vencidos ?? 0} con suscripción vencida`} accent="text-violet-600" />
        <Kpi icon={Megaphone} label="Publicaciones" value={k?.posts_7d ?? 0} sub="últimos 7 días" accent="text-pink-600" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Wallet className="h-3.5 w-3.5" />Gasto IA del mes</div>
          <div className="mt-1 text-xl font-bold text-slate-900">${Number(k?.gasto_mes_usd ?? 0).toFixed(2)}<span className="text-sm font-medium text-slate-400"> / ${k?.tope_mes_usd ?? 0} USD</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full', spendPct > 85 ? 'bg-red-500' : spendPct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${spendPct}%` }} />
          </div>
        </div>
      </div>

      <MetaConnect status={mk.settings.meta_status ?? null} onConnect={mk.connectMeta} onConnectInstagram={mk.connectInstagram} />
      {paused && <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-center text-sm font-semibold text-white">El equipo está en pausa: nadie trabaja ni publica hasta que lo reactives.</div>}

      {/* Oficina + ficha del agente */}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(ellipse_at_top,#1E293B,#0B1120)] p-3 shadow-lg">
          <div className="pointer-events-none absolute left-5 top-4 z-10 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">
            Pasa el cursor por una sala para acercarte · toca a un agente para hablar con él
          </div>
          <OfficeFloor agents={mk.agents} activity={mk.activity} selected={selected} onSelect={setSelected} kpis={mk.kpis} posts={mk.posts} />
        </div>
        <div className="h-[720px] xl:h-auto xl:max-h-[760px]">
          {agent && (
            <AgentPanel agent={agent} agents={mk.agents} activity={mk.activity} tasks={mk.tasks}
                        spend={mk.spendByAgent[agent.id] ?? 0} supabase={mk.supabase}
                        onChat={mk.chat} onToggle={mk.setAgentEnabled}
                        onAssign={mk.assignTask} loadLedger={mk.loadLedger} />
          )}
        </div>
      </div>

      {/* Secciones: plegables para que el chat nunca quede empujado */}
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 px-5 py-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setOpen(true); }}
                    className={cn('relative rounded-lg px-3 py-1.5 text-sm font-semibold', open && tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>
              {t.label}
              {t.id === 'requests' && pendingRequests > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{pendingRequests}</span>
              )}
            </button>
          ))}
          <button onClick={() => setOpen(!open)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            {open ? 'Minimizar' : 'Abrir'}<ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 p-5">
            {tab === 'feed' && <ActivityFeed activity={mk.activity} agents={mk.agents} onSelect={setSelected} />}
            {tab === 'posts' && <PostsGrid posts={mk.posts} onDiscard={mk.discardPost} />}
            {tab === 'requests' && <RequestsList requests={mk.requests} agents={mk.agents} onDecide={mk.decideRequest} />}
            {tab === 'manual' && <KnowledgeView knowledge={mk.knowledge} />}
            {tab === 'costs' && <TeamCosts agents={mk.agents} spend={mk.spendByAgent} onSelect={setSelected} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string | number; sub: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Icon className={cn('h-3.5 w-3.5', accent)} />{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[12px] text-slate-500">{sub}</div>
    </div>
  );
}
