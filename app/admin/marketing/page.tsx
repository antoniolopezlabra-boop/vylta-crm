'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pause, Play, Zap, Users, Wallet, TrendingUp, UserPlus, Megaphone, Crown, ChevronDown, Presentation, Activity, Image as ImageIcon, MessageCircle, Inbox, BookOpen, Sparkles, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import { useMarketing } from '@/hooks/use-marketing';
import { OfficeFloor } from '@/components/admin/marketing/office-floor';
import { AgentPanel } from '@/components/admin/marketing/agent-panel';
import { MeetingPanel, StartMeetingDialog } from '@/components/admin/marketing/meeting-panel';
import { MeetingRoom } from '@/components/admin/marketing/meeting-room';
import { ProjectionModal } from '@/components/admin/marketing/projection-viewer';
import type { MkProjection } from '@/hooks/use-marketing';
import { ActivityFeed, AdsConnect, CommentsView, KnowledgeView, MetaConnect, PostsGrid, RequestsList, TeamCosts } from '@/components/admin/marketing/marketing-sections';
import { InnovationView } from '@/components/admin/marketing/innovation-view';
import { OutreachCard } from '@/components/admin/marketing/outreach-card';
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
  { id: 'feed', label: 'En vivo', icon: Activity, tone: 'text-emerald-300' },
  { id: 'posts', label: 'Publicaciones', icon: ImageIcon, tone: 'text-pink-300' },
  { id: 'comments', label: 'Comentarios', icon: MessageCircle, tone: 'text-sky-300' },
  { id: 'requests', label: 'Solicitudes', icon: Inbox, tone: 'text-amber-300' },
  { id: 'manual', label: 'Manual del equipo', icon: BookOpen, tone: 'text-violet-300' },
  { id: 'costs', label: 'Equipo y costos', icon: Wallet, tone: 'text-amber-300' },
  { id: 'innovation', label: 'Propuestas de innovación', icon: Sparkles, tone: 'text-lime-300' },
] as const;

export default function MarketingPage() {
  const mk = useMarketing();
  const [selected, setSelected] = useState<string | null>('director');
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('feed');
  const [open, setOpen] = useState(false);
  const [convocar, setConvocar] = useState(false);
  const [viewing, setViewing] = useState<MkProjection | null>(null);
  const [side, setSide] = useState<'reunion' | 'agente'>('reunion');
  const [roomOpen, setRoomOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  const hasMeeting = !!mk.meeting;
  // Clic en la pantalla de la sala: entra a la reunión o, si no hay, la convoca.
  const openRoom = useCallback(() => (hasMeeting ? setRoomOpen(true) : setConvocar(true)), [hasMeeting]);
  const meetingId = mk.meeting?.id;
  useEffect(() => { if (meetingId) setSide('reunion'); }, [meetingId]);
  useEffect(() => { if (!mk.meeting) setRoomOpen(false); }, [mk.meeting]);
  const selectAgent = useCallback((id: string | null) => { setSelected(id); if (id) setSide('agente'); }, []);
  const closeRoom = useCallback(() => setRoomOpen(false), []);
  const agent = mk.agents.find((a) => a.id === selected) ?? mk.agents.find((a) => a.id === 'director');
  const pendingRequests = mk.requests.filter((r) => r.status === 'pendiente').length;
  const pendingInnovations = mk.innovations.filter((i) => i.status === 'pendiente' || i.status === 'en_revision').length;
  const paused = !!mk.settings.autopilot?.paused;
  const k = mk.kpis;
  const spendPct = k && k.tope_mes_usd ? Math.min(100, (k.gasto_mes_usd / k.tope_mes_usd) * 100) : 0;
  const workingNow = mk.agents.filter((a) => a.enabled && a.status !== 'idle' && a.status !== 'paused').length;

  if (mk.loading) {
    return <div className="flex h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abriendo la oficina…</div>;
  }

  const paying = k?.pagando_reales ?? k?.pagados_activos ?? 0;
  const goal = Number(mk.settings.innovation_loop?.meta ?? 200);
  const meta = mk.settings.meta_status ?? null;
  const metaOk = !!(meta?.facebook && meta?.instagram);

  return (
    <div className="mk-dark space-y-5">
      {/* Encabezado: identidad, estado del equipo y acciones */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#2EE6A8,#3B82F6_55%,#8B5CF6)] shadow-[0_12px_30px_-10px_rgba(59,130,246,.75)]">
            <Megaphone className="h-6 w-6 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-bold leading-none tracking-tight text-white">Marketing</h1>
              <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ring-1',
                paused ? 'bg-white/[.04] text-[#A7B2C4] ring-white/10' : workingNow > 0 ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25' : 'bg-white/[.04] text-[#A7B2C4] ring-white/10')}>
                <span className={cn('h-2 w-2 rounded-full', paused ? 'bg-slate-500' : workingNow > 0 ? 'animate-pulse bg-emerald-400' : 'bg-sky-400')} />
                {paused ? 'Equipo en pausa' : workingNow > 0 ? `${workingNow} trabajando ahora` : 'En espera del siguiente ciclo'}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#8B97AB]">Tu oficina de agentes de IA, trabajando para que más negocios paguen VYLTA.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowMeta((v) => !v)}
                  className={cn('inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition',
                    metaOk ? 'bg-white/[.03] text-[#CBD5E1] ring-white/10 hover:bg-white/[.06]' : 'bg-amber-400/10 text-amber-300 ring-amber-400/30 hover:bg-amber-400/15')}>
            <span className={cn('h-2 w-2 rounded-full', metaOk ? 'bg-emerald-400' : 'bg-amber-400')} />
            {metaOk ? <>Facebook · <span className="text-white">{meta?.instagram}</span></> : 'Conectar Meta'}
          </button>
          <div className="flex items-center gap-1 rounded-2xl bg-white/[.03] p-1 ring-1 ring-white/10">
            <button onClick={() => (mk.meeting ? openRoom() : setConvocar(true))}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold text-[#CBD5E1] transition hover:bg-white/[.07] hover:text-white">
              <Presentation className="h-4 w-4 text-sky-400" />{mk.meeting ? 'Entrar a la junta' : 'Convocar reunión'}
            </button>
            <button
              onClick={async () => { setRunning(true); try { await mk.runNow(); toast.success('El equipo revisó su trabajo pendiente'); } catch (e) { toast.error((e as Error).message); } finally { setRunning(false); } }}
              disabled={running || paused}
              className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold text-[#CBD5E1] transition hover:bg-white/[.07] hover:text-white disabled:opacity-40">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-400" />}Trabajar ahora
            </button>
            <button
              onClick={() => mk.setPaused(!paused).then(() => toast.success(paused ? 'Equipo reactivado' : 'Equipo en pausa')).catch((e) => toast.error(e.message))}
              className={cn('inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition',
                paused ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'text-[#CBD5E1] hover:bg-rose-500/15 hover:text-rose-300')}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{paused ? 'Reactivar equipo' : 'Pausar'}
            </button>
          </div>
        </div>
      </header>

      {(showMeta || !metaOk) && <MetaConnect status={meta} onConnect={mk.connectMeta} onConnectInstagram={mk.connectInstagram} />}
      {paused && <div className="rounded-2xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-200 ring-1 ring-rose-500/25">El equipo está en pausa: nadie trabaja ni publica hasta que lo reactives.</div>}

      {/* Indicadores: la meta del área primero */}
      <section aria-label="Indicadores" className="grid gap-px overflow-hidden rounded-3xl bg-white/[.07] ring-1 ring-white/[.08] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative bg-[#0C1220] p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
          <MetricLabel icon={Crown} tone="text-emerald-300 bg-emerald-400/10">Negocios pagando</MetricLabel>
          <div className="mt-3 flex items-baseline gap-1.5"><span className="text-[30px] font-bold leading-none tracking-tight text-white tabular-nums">{paying}</span><span className="text-sm font-semibold text-[#6B778C]">/ {goal}</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2EE6A8,#3B82F6,#8B5CF6)]" style={{ width: `${Math.max(1.5, Math.min(100, (paying / goal) * 100))}%` }} /></div>
          <p className="mt-2 text-[12px] text-[#8B97AB]">Meta del ciclo · +{k?.pagados_nuevos_mes ?? 0} este mes</p>
        </div>
        <Metric icon={TrendingUp} tone="text-sky-300 bg-sky-400/10" label="Ingreso mensual" value={`$${Number(k?.mrr_mxn ?? 0).toLocaleString('es-MX')}`} sub="MXN recurrentes (MRR)" />
        <Metric icon={UserPlus} tone="text-violet-300 bg-violet-400/10" label="Registros" value={k?.registros_30d ?? 0} sub={`${k?.registros_7d ?? 0} en los últimos 7 días`} />
        <Metric icon={Users} tone="text-indigo-300 bg-indigo-400/10" label="Negocios totales" value={k?.negocios_total ?? 0} sub={`${k?.vencidos ?? 0} con suscripción vencida`} />
        <Metric icon={Megaphone} tone="text-pink-300 bg-pink-400/10" label="Publicaciones" value={k?.posts_7d ?? 0} sub="en los últimos 7 días" />
        <div className="bg-[#0C1220] p-5">
          <MetricLabel icon={Wallet} tone="text-amber-300 bg-amber-400/10">Gasto de IA</MetricLabel>
          <div className="mt-3 flex items-baseline gap-1.5"><span className="text-[30px] font-bold leading-none tracking-tight text-white tabular-nums">${Number(k?.gasto_mes_usd ?? 0).toFixed(2)}</span><span className="text-sm font-semibold text-[#6B778C]">/ ${k?.tope_mes_usd ?? 0}</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
            <div className={cn('h-full rounded-full', spendPct > 85 ? 'bg-rose-500' : spendPct > 60 ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${Math.max(1.5, spendPct)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-[#8B97AB]">USD este mes · {spendPct.toFixed(0)}% del tope</p>
        </div>
      </section>

      {/* Oficina + ficha del agente */}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_top,#152036,#080D18_70%)] p-3 ring-1 ring-white/[.08]">
          <div className="pointer-events-none absolute left-5 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11.5px] font-medium text-white/75 ring-1 ring-white/10 backdrop-blur">
            <MousePointerClick className="h-3.5 w-3.5 text-sky-300" />Pasa el cursor por una sala para acercarte · toca a un agente para hablar con él
          </div>
          <OfficeFloor agents={mk.agents} activity={mk.activity} selected={selected} onSelect={selectAgent} kpis={mk.kpis} posts={mk.posts}
                       meeting={mk.meeting} projections={mk.projections} onOpenProjection={setViewing} onOpenMeeting={openRoom}
                       innovations={mk.innovations} />
        </div>
        <div className="h-[720px] xl:h-auto xl:max-h-[760px]">
          {mk.meeting && (
            <div className="mb-2 flex gap-1 rounded-xl bg-white/[.04] p-1 text-[12px] font-semibold ring-1 ring-white/10">
              {(['reunion', 'agente'] as const).map((k) => (
                <button key={k} onClick={() => setSide(k)} className={cn('flex-1 rounded-lg py-1.5 transition', side === k ? 'bg-white/[.1] text-white' : 'text-[#8B97AB] hover:text-white')}>
                  {k === 'reunion' ? 'Sala de juntas' : `Expediente${agent ? ` · ${agent.name.split(' ')[0]}` : ''}`}
                </button>
              ))}
            </div>
          )}
          {mk.meeting && side === 'reunion' ? (
            <div className="h-[calc(100%-44px)]">
              <MeetingPanel meeting={mk.meeting} agents={mk.agents} projections={mk.projections} supabase={mk.supabase}
                            onSend={mk.meetingChat} onEnd={mk.endMeeting} onOpen={setViewing} getProjection={mk.getProjection} onOpenRoom={openRoom} />
            </div>
          ) : agent && (
            <AgentPanel agent={agent} agents={mk.agents} activity={mk.activity} tasks={mk.tasks}
                        spend={mk.spendByAgent[agent.id] ?? 0} supabase={mk.supabase}
                        onChat={mk.chat} onToggle={mk.setAgentEnabled}
                        onAssign={mk.assignTask} loadLedger={mk.loadLedger}
                        projections={mk.projections} onOpenProjection={setViewing} getProjection={mk.getProjection} />
          )}
        </div>
      </div>

      {convocar && <StartMeetingDialog agents={mk.agents} onStart={async (t, a) => { await mk.startMeeting(t, a); setSide('reunion'); }} onClose={() => setConvocar(false)} />}
      {viewing && <ProjectionModal p={viewing} agents={mk.agents} onClose={() => setViewing(null)} />}
      {roomOpen && mk.meeting && (
        <MeetingRoom meeting={mk.meeting} agents={mk.agents} projections={mk.projections} supabase={mk.supabase}
                     onSend={mk.meetingChat} onEnd={mk.endMeeting} onClose={closeRoom} getProjection={mk.getProjection} />
      )}

      {/* Secciones: plegables para que el chat nunca quede empujado */}
      <div className="rounded-3xl bg-[#0C1220] ring-1 ring-white/[.08]">
        <div className="flex items-center gap-2 px-3 py-3">
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Secciones de marketing">
            {TABS.map((t) => {
              const count = t.id === 'comments' ? mk.comments.filter((c) => c.status === 'nuevo' || c.status === 'escalado').length
                : t.id === 'requests' ? pendingRequests : t.id === 'innovation' ? pendingInnovations : 0;
              const on = open && tab === t.id;
              return (
                <button key={t.id} onClick={() => { setTab(t.id); setOpen(true); }}
                        className={cn('relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition',
                          on ? 'bg-white/[.09] text-white ring-1 ring-white/10' : 'text-[#8B97AB] hover:bg-white/[.04] hover:text-white')}>
                  <t.icon className={cn('h-4 w-4', on ? t.tone : 'text-[#6B778C]')} />{t.label}
                  {count > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-bold leading-[18px] text-[#0B1020]', t.id === 'innovation' ? 'bg-lime-400' : t.id === 'requests' ? 'bg-amber-400' : 'bg-sky-400')}>{count}</span>}
                </button>
              );
            })}
          </nav>
          <button onClick={() => setOpen(!open)} className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-semibold text-[#8B97AB] hover:bg-white/[.04] hover:text-white">
            {open ? 'Minimizar' : 'Abrir'}<ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <div className="border-t border-white/[.06] p-5">
            {tab === 'feed' && <ActivityFeed activity={mk.activity} agents={mk.agents} onSelect={setSelected} />}
            {tab === 'posts' && <PostsGrid posts={mk.posts} onDiscard={mk.discardPost} />}
            {tab === 'comments' && <CommentsView comments={mk.comments} onUnhide={mk.unhideComment} />}
            {tab === 'requests' && <><AdsConnect status={mk.settings.ads_status ?? null} onConnect={mk.connectAds} /><RequestsList requests={mk.requests} agents={mk.agents} onDecide={mk.decideRequest} /></>}
            {tab === 'manual' && <KnowledgeView knowledge={mk.knowledge} />}
            {tab === 'costs' && <><TeamCosts agents={mk.agents} spend={mk.spendByAgent} onSelect={setSelected} /><OutreachCard supabase={mk.supabase} policy={mk.settings.outreach_policy} onPreview={mk.previewOutreach} /></>}
            {tab === 'innovation' && <InnovationView innovations={mk.innovations} agents={mk.agents} kpis={mk.kpis} loop={mk.settings.innovation_loop}
                                                     onDecide={mk.decideInnovation} onOpenChat={selectAgent} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricLabel({ icon: Icon, tone, children }: { icon: typeof Users; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('grid h-8 w-8 place-items-center rounded-xl', tone)}><Icon className="h-4 w-4" /></span>
      <span className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-[#8B97AB]">{children}</span>
    </div>
  );
}

function Metric({ icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string | number; sub: string; tone: string }) {
  return (
    <div className="bg-[#0C1220] p-5">
      <MetricLabel icon={icon} tone={tone}>{label}</MetricLabel>
      <div className="mt-3 text-[30px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</div>
      <p className="mt-3 text-[12px] text-[#8B97AB]">{sub}</p>
    </div>
  );
}
