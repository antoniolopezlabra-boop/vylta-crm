'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  Activity,
  Crown,
  Gem,
  Coins,
  ArrowRight,
  Loader2,
  Ticket,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ═════════════════════════════════════════════════════════════════════
// Control Center Dashboard — VYLTA Admin
//
// MRR en vivo basado en planes activos:
//   - basicCount (interno: 'Basico')   = Premium visible ($399)
//   - premiumCount (interno: 'Premium')= Luxury visible ($799)
//   - gratuitoCount (interno: 'Gratuito') = Basico visible ($0)
//
// KPIs en tarjetas con accent colors:
//   - Negocios (verde)
//   - Activos 30d (azul) — con sesión en user_sessions
//   - Retención (gold) — active/total %
//   - Citas mes (purple)
//
// 2 Line charts SVG con datos reales:
//   - Citas últimos 14 días
//   - Nuevos negocios últimas 8 semanas
// ═════════════════════════════════════════════════════════════════════

interface DashboardData {
  totalTenants: number;
  activeTenants: number;
  retentionRate: number;
  totalAppointments: number;
  monthAppointments: number;
  basicCount: number;
  premiumCount: number;
  gratuitoCount: number;
  mrr: number;
  dailyCitas: { label: string; value: number }[];
  weeklyNegocios: { label: string; value: number }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const supabase = createClient();

    try {
      const todayLocal = new Date();
      const monthStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
      const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

      const fourteenAgo = new Date();
      fourteenAgo.setDate(fourteenAgo.getDate() - 14);
      const fourteenAgoStr = `${fourteenAgo.getFullYear()}-${String(fourteenAgo.getMonth() + 1).padStart(2, '0')}-${String(fourteenAgo.getDate()).padStart(2, '0')}`;

      const fiftySixAgo = new Date(Date.now() - 56 * 86400000);
      const thirtyAgo = new Date(Date.now() - 30 * 86400000);

      const [
        { count: totalTenants },
        { count: totalAppointments },
        { count: monthAppointments },
        { data: sessions },
        { data: dailyApts },
        { data: weeklyRegs },
        { data: plans, error: plansError },
      ] = await Promise.all([
        supabase.from('business_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', monthStartStr),
        supabase.from('user_sessions').select('user_id').gte('last_seen_at', thirtyAgo.toISOString()),
        supabase.from('appointments').select('date').gte('date', fourteenAgoStr).order('date'),
        supabase.from('business_profiles').select('created_at').gte('created_at', fiftySixAgo.toISOString()).order('created_at'),
        supabase.rpc('get_all_subscription_plans'),
      ]);

      if (plansError) console.error('[Admin] Plans RPC error:', plansError);

      const basicCount = plans?.filter((p: any) =>
        ['basico', 'básico'].includes((p.plan_type || '').toLowerCase().trim())
      ).length || 0;
      const premiumCount = plans?.filter((p: any) =>
        (p.plan_type || '').toLowerCase().trim() === 'premium'
      ).length || 0;
      const gratuitoCount = plans?.filter((p: any) =>
        (p.plan_type || '').toLowerCase().trim() === 'gratuito'
      ).length || 0;

      // MRR: Basico interno = $399 visible Premium, Premium interno = $799 visible Luxury
      const mrr = basicCount * 399 + premiumCount * 799;
      const activeTenants = sessions?.length || 0;
      const retentionRate = totalTenants ? Math.round((activeTenants / (totalTenants || 1)) * 100) : 0;

      // Citas últimos 14 días
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days[`${d.getDate()}/${d.getMonth() + 1}`] = 0;
      }
      dailyApts?.forEach((a: any) => {
        const d = new Date(a.date + 'T12:00:00');
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (days[key] !== undefined) days[key]++;
      });

      // Nuevos negocios últimas 8 semanas
      const weeks: Record<string, number> = {};
      for (let i = 7; i >= 0; i--) weeks[`S${8 - i}`] = 0;
      weeklyRegs?.forEach((p: any) => {
        const weeksAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (7 * 86400000));
        const key = `S${8 - weeksAgo}`;
        if (weeks[key] !== undefined) weeks[key]++;
      });

      setData({
        totalTenants: totalTenants || 0,
        activeTenants,
        retentionRate,
        totalAppointments: totalAppointments || 0,
        monthAppointments: monthAppointments || 0,
        basicCount,
        premiumCount,
        gratuitoCount,
        mrr,
        dailyCitas: Object.entries(days).map(([label, value]) => ({ label, value })),
        weeklyNegocios: Object.entries(weeks).map(([label, value]) => ({ label, value })),
      });
    } catch (e) {
      console.error('[Admin Dashboard]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-vylta-gold/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vylta-gold" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-vylta-gold">Control Center</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tightest text-vylta-bone">VYLTA</h1>
          <p className="text-sm text-vylta-muted mt-1">Panel de administración global del sistema</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-xs font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
        >
          {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {refreshing ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      </div>

      {/* MRR HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/30 bg-vylta-surface p-7 shadow-card-lg">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-vylta-gold/10 blur-[80px]" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.08]" />

        <div className="relative flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-vylta-gold" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-gold">MRR en vivo</span>
            </div>
            <span className="text-[10px] text-vylta-muted">
              {new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div>
            <div className="text-7xl font-bold tabular-nums tracking-tightest text-vylta-gold">
              ${data.mrr.toLocaleString('es-MX')}
            </div>
            <div className="mt-2 text-sm text-vylta-muted font-semibold">MXN / mes</div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-5">
            <PlanCount label="Premium" count={data.basicCount} price={399} color="text-vylta-green" Icon={Gem} />
            <PlanCount label="Luxury" count={data.premiumCount} price={799} color="text-vylta-luxury" Icon={Crown} />
            <PlanCount label="Básico" count={data.gratuitoCount} price={0} color="text-vylta-subtle" Icon={Users} />
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <section>
        <SectionHeader label="Indicadores" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Negocios" value={data.totalTenants} hint="Total registrados" Icon={Building2} accent="green" href="/admin/tenants" />
          <KpiCard label="Activos 30d" value={data.activeTenants} hint="Con sesión" Icon={Activity} accent="blue" pulse />
          <KpiCard label="Retención" value={`${data.retentionRate}%`} hint="Activos / Total" Icon={TrendingUp} accent="gold" />
          <KpiCard label="Citas mes" value={data.monthAppointments} hint={`Histórico: ${data.totalAppointments}`} Icon={CalendarCheck} accent="luxury" />
        </div>
      </section>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Citas últimos 14 días"
          subtitle={`${data.totalAppointments} citas históricas totales`}
          accentColor="#A78BFA"
          data={data.dailyCitas}
          gradientId="citasGrad"
        />
        <ChartCard
          title="Nuevos negocios (8 semanas)"
          subtitle={`${data.totalTenants} negocios en total`}
          accentColor="#10B981"
          data={data.weeklyNegocios}
          gradientId="negociosGrad"
        />
      </div>

      {/* QUICK ACTIONS */}
      <section>
        <SectionHeader label="Acciones rápidas" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard
            href="/admin/tenants"
            Icon={Building2}
            title="Negocios"
            description="Ver y administrar todos los negocios registrados"
            color="green"
          />
          <ActionCard
            href="/admin/promo-codes"
            Icon={Ticket}
            title="Códigos promo"
            description="Crear y administrar códigos de descuento"
            color="gold"
          />
          <ActionCard
            href="/admin/admins"
            Icon={ShieldCheck}
            title="Administradores"
            description="Gestionar usuarios con acceso al Control Center"
            color="luxury"
          />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-px flex-1 bg-border max-w-[20px]" />
      <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-muted">{label}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function PlanCount({
  label, count, price, color, Icon,
}: {
  label: string; count: number; price: number; color: string; Icon: any;
}) {
  return (
    <div className="text-center">
      <Icon className={cn('mx-auto h-4 w-4 mb-1.5', color)} />
      <div className={cn('text-3xl font-bold tabular-nums', color)}>{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-muted mt-1">{label}</div>
      <div className="text-[10px] text-vylta-subtle mt-0.5 tabular-nums">
        {price > 0 ? `$${price}/mes` : 'Gratis'}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, Icon, accent, pulse, href,
}: {
  label: string;
  value: number | string;
  hint: string;
  Icon: any;
  accent: 'green' | 'blue' | 'gold' | 'luxury';
  pulse?: boolean;
  href?: string;
}) {
  const colorMap = {
    green: { text: 'text-vylta-green', halo: '#10B981' },
    blue: { text: 'text-vylta-sky', halo: '#0EA5E9' },
    gold: { text: 'text-vylta-gold', halo: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
  }[accent];

  const inner = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card transition-all hover:border-border/80 hover:-translate-y-0.5">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-25 transition-opacity group-hover:opacity-40"
        style={{ background: colorMap.halo }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className={cn('text-3xl font-bold tabular-nums tracking-tightest', colorMap.text)}>{value}</div>
          {pulse && (
            <span className="relative flex h-2 w-2 mt-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-vylta-sky/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vylta-sky" />
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-vylta-muted">{hint}</div>
        {href && (
          <div className="mt-2 text-[10px] font-bold text-vylta-muted group-hover:text-vylta-bone flex items-center gap-0.5">
            Ver detalle <ArrowRight className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ChartCard({
  title, subtitle, accentColor, data, gradientId,
}: {
  title: string; subtitle: string; accentColor: string;
  data: { label: string; value: number }[]; gradientId: string;
}) {
  const W = 460;
  const H = 160;
  const pad = 16;

  const max = Math.max(...data.map((d) => d.value), 1);
  const step = (W - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => ({
    x: pad + i * step,
    y: H - pad - (d.value / max) * (H - pad * 2),
    v: d.value,
    label: d.label,
  }));

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    linePath += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const activePts = pts.filter((p) => p.v > 0);

  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
      <div className="mb-4 flex items-start gap-2">
        <div className="w-0.5 h-10 rounded-full" style={{ backgroundColor: accentColor }} />
        <div>
          <h3 className="text-sm font-bold text-vylta-bone">{title}</h3>
          <p className="text-[11px] text-vylta-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
            <stop offset="70%" stopColor={accentColor} stopOpacity={0.05} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <line x1={pad} y1={H} x2={W - pad} y2={H} stroke="#334155" strokeWidth={0.5} />
        <path d={linePath} stroke={accentColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {activePts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#0A0E1A" stroke={accentColor} strokeWidth={1.5} />
            <text x={p.x} y={p.y - 8} fontSize={9} fill={accentColor} textAnchor="middle" fontWeight="bold">{p.v}</text>
          </g>
        ))}
        {pts.filter((_, i) => i % 2 === 0).map((p, i) => (
          <text key={`l-${i}`} x={p.x} y={H + 14} fontSize={8} fill="#64748B" textAnchor="middle">{p.label}</text>
        ))}
      </svg>
    </div>
  );
}

function ActionCard({
  href, Icon, title, description, color,
}: {
  href: string; Icon: any; title: string; description: string;
  color: 'green' | 'gold' | 'luxury';
}) {
  const colorMap = {
    green: 'text-vylta-green border-vylta-green/30 bg-vylta-green/5 hover:bg-vylta-green/10',
    gold: 'text-vylta-gold border-vylta-gold/30 bg-vylta-gold/5 hover:bg-vylta-gold/10',
    luxury: 'text-vylta-luxury border-vylta-luxury/30 bg-vylta-luxury/5 hover:bg-vylta-luxury/10',
  }[color];

  return (
    <Link
      href={href}
      className={cn('group relative overflow-hidden rounded-xl border p-5 shadow-card transition-all hover:-translate-y-0.5', colorMap)}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold">{title}</h3>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-[11px] text-vylta-muted mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
