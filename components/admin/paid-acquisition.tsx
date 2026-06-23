'use client';

import {
  Megaphone, Eye, MousePointerClick, UserPlus, CreditCard, Loader2, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { usePaidAcquisition, type PaidSourceRow } from '@/hooks/use-paid-acquisition';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// PaidAcquisition — panel de adquisición por redes (Facebook + Google).
// Mide el embudo del landing /empieza: Visitas → Clic CTA → Registro → Pago,
// desglosado por canal (utm_source) y campaña (utm_campaign). Tiempo real.
// ═══════════════════════════════════════════════════════════════════════

const fmt = (n: number) => (n ?? 0).toLocaleString('es-MX');
const pct = (part: number, whole: number) => (!whole ? 0 : Math.round((part / whole) * 1000) / 10);

// Metadatos por canal (utm_source).
const SOURCE_META: Record<string, { label: string; color: string; dot: string }> = {
  fb: { label: 'Facebook / Instagram', color: '#60A5FA', dot: 'bg-vylta-sky' },
  google: { label: 'Google', color: '#FBBF24', dot: 'bg-vylta-gold' },
  directo: { label: 'Directo / otro', color: '#94A3B8', dot: 'bg-vylta-subtle' },
};
const meta = (s: string) => SOURCE_META[s] ?? { label: s, color: '#94A3B8', dot: 'bg-vylta-subtle' };

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Eye; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-vylta-card/40 p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-vylta-subtle">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-vylta-bone">{fmt(value)}</div>
    </div>
  );
}

export function PaidAcquisition({ days }: { days: number }) {
  const { data, isLoading } = usePaidAcquisition(days);

  const t = data?.totals ?? { visitas: 0, cta: 0, registros: 0, pago: 0 };
  const sources: PaidSourceRow[] = data?.by_source ?? [];
  const daily = (data?.daily ?? []).map((d) => ({ ...d }));

  return (
    <section className="rounded-3xl border border-vylta-sky/20 bg-gradient-to-b from-vylta-sky/[0.04] to-transparent p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vylta-sky/10">
          <Megaphone className="h-5 w-5 text-vylta-sky" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-vylta-bone">Adquisición por redes (Facebook + Google)</h2>
          <p className="text-xs text-vylta-muted">Tráfico de pago → landing /empieza → registro. En vivo.</p>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-vylta-sky" /></div>
      ) : (
        <>
          {/* Embudo de KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Eye} label="Visitas al landing" value={t.visitas} tone="bg-vylta-sky/15 text-vylta-sky" />
            <Kpi icon={MousePointerClick} label="Clics en CTA" value={t.cta} tone="bg-vylta-gold/15 text-vylta-gold" />
            <Kpi icon={UserPlus} label="Registros" value={t.registros} tone="bg-vylta-green/15 text-vylta-green" />
            <Kpi icon={CreditCard} label="De pago" value={t.pago} tone="bg-vylta-green/20 text-vylta-green" />
          </div>

          {/* Tasas de conversión */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-vylta-subtle">
            <span>Visita→CTA <b className="text-vylta-muted">{pct(t.cta, t.visitas)}%</b></span>
            <ArrowRight className="hidden h-3 w-3 sm:inline" />
            <span>Visita→Registro <b className="text-vylta-muted">{pct(t.registros, t.visitas)}%</b></span>
            <ArrowRight className="hidden h-3 w-3 sm:inline" />
            <span>Registro→Pago <b className="text-vylta-muted">{pct(t.pago, t.registros)}%</b></span>
          </div>

          {/* Por canal */}
          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-vylta-subtle">Por canal</h3>
          {sources.length === 0 ? (
            <p className="rounded-xl border border-border bg-vylta-card/30 p-4 text-sm text-vylta-muted">Sin tráfico de pago todavía en este rango.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {sources.map((s) => {
                const m = meta(s.source);
                return (
                  <div key={s.source} className="rounded-2xl border border-border bg-vylta-card/40 p-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', m.dot)} />
                      <span className="text-sm font-bold text-vylta-bone">{m.label}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                      <div><div className="text-lg font-bold tabular-nums text-vylta-bone">{fmt(s.visitas)}</div><div className="text-[10px] text-vylta-subtle">visitas</div></div>
                      <div><div className="text-lg font-bold tabular-nums text-vylta-bone">{fmt(s.cta)}</div><div className="text-[10px] text-vylta-subtle">CTA</div></div>
                      <div><div className="text-lg font-bold tabular-nums text-vylta-green">{fmt(s.registros)}</div><div className="text-[10px] text-vylta-subtle">registros</div></div>
                      <div><div className="text-lg font-bold tabular-nums text-vylta-green">{fmt(s.pago)}</div><div className="text-[10px] text-vylta-subtle">pago</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tendencia diaria */}
          {daily.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-vylta-subtle">Visitas por día y canal</h3>
              <div className="rounded-2xl border border-border bg-vylta-card/30 p-3" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#121826', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="fb" name="Facebook/IG" stackId="a" fill="#60A5FA" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="google" name="Google" stackId="a" fill="#FBBF24" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="directo" name="Directo" stackId="a" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Por campaña */}
          {(data?.by_campaign?.length ?? 0) > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-vylta-subtle">Por campaña</h3>
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-vylta-card/40 text-left text-[11px] uppercase tracking-wide text-vylta-subtle">
                      <th className="px-4 py-2.5 font-bold">Campaña</th>
                      <th className="px-4 py-2.5 font-bold">Canal</th>
                      <th className="px-4 py-2.5 text-right font-bold">Visitas</th>
                      <th className="px-4 py-2.5 text-right font-bold">CTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.by_campaign.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-vylta-bone">{c.campaign}</td>
                        <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs text-vylta-muted"><span className={cn('h-2 w-2 rounded-full', meta(c.source).dot)} />{meta(c.source).label}</span></td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-vylta-bone">{fmt(c.visitas)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-vylta-muted">{fmt(c.cta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
