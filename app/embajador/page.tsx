'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Crown, Users, Wallet, TrendingUp, ArrowRight, Copy,
  HeartHandshake, Rocket, Sparkles, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useEmbajadorResumen, useEmbajadorClientes } from '@/hooks/use-embajador-portal';

const MXN = (n: number) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

function nivelPct(n: number): string {
  if (n >= 16) return '30%';
  if (n >= 11) return '25%';
  if (n >= 1) return '20%';
  return '—';
}

export default function EmbajadorHomePage() {
  const queryClient = useQueryClient();
  const { data: resumen, isLoading } = useEmbajadorResumen();
  const { data: clientes } = useEmbajadorClientes();
  const [accepting, setAccepting] = useState(false);

  if (isLoading || !resumen) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  async function aceptarBienvenida() {
    try {
      setAccepting(true);
      const supabase = createClient();
      const { error } = await supabase.rpc('embajador_aceptar_bienvenida');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['embajador-resumen'] });
    } catch (e) {
      toast.error('No se pudo continuar. Intenta de nuevo.');
    } finally {
      setAccepting(false);
    }
  }

  // ═══ PANTALLA DE BIENVENIDA (primera vez) ═══
  if (!resumen.bienvenida_aceptada) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4 animate-fade-in">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-vylta-gold/30 bg-vylta-surface p-8 text-center shadow-card-lg">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-vylta-gold/15 blur-[90px]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-vylta-gold/15">
              <Crown className="h-8 w-8 text-vylta-gold" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-vylta-bone">
              Bienvenido a VYLTA, {resumen.nombre.split(' ')[0]}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-base text-vylta-muted">
              Hoy te conviertes en parte de algo que está cambiando la vida de cientos de micro-negocios en México. Y esto apenas empieza.
            </p>
          </div>
        </div>

        {/* Que significa */}
        <div className="rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
          <p className="text-sm leading-relaxed text-vylta-bone">
            Ser <span className="font-bold text-vylta-gold">Embajador VYLTA</span> no es solo recomendar una app. Es ayudar a que una estética, una barbería o un consultorio dejen de perder clientes por WhatsApp y empiecen a llenar su agenda. Cada negocio que traes, crece — y tú creces con él.
          </p>
          <div className="mt-5 space-y-4">
            <Punto Icon={HeartHandshake} titulo="Representas a VYLTA" texto="Tu palabra es nuestra palabra. Trata a cada negocio con honestidad y cercanía: confían en ti, y eso es una responsabilidad bonita." />
            <Punto Icon={Rocket} titulo="Impulsas a quien lo necesita" texto="Les pones en las manos una herramienta que de verdad les cambia el día a día. Eso vale mucho más que una venta." />
            <Punto Icon={Wallet} titulo="Ganas de verdad" texto="Por cada negocio que confía en ti, recibes comisión mes con mes. Entre más ayudas, más ganas." />
          </div>
        </div>

        {/* Simulador de ingresos */}
        <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/30 bg-vylta-surface p-6 shadow-card-lg">
          <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-vylta-gold/10 blur-[80px]" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-vylta-gold" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-gold">Imagina tu primer mes en grande</span>
            </div>
            <p className="mt-3 text-sm text-vylta-muted">
              Si traes <span className="font-bold text-vylta-bone">20 negocios</span> en un mes, llegas al nivel <span className="font-bold text-vylta-gold">Oro</span>: 30% de comisión.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-4xl font-bold tabular-nums tracking-tightest text-vylta-gold">~$2,394</div>
                <div className="text-xs font-semibold text-vylta-muted">MXN al mes</div>
              </div>
              <div className="flex items-center gap-2 text-vylta-subtle">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div>
                <div className="text-4xl font-bold tabular-nums tracking-tightest text-vylta-bone">~$14,364</div>
                <div className="text-xs font-semibold text-vylta-muted">en 6 meses, de ese solo mes</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-vylta-subtle">
              Ejemplo con el plan Premium ($399/mes): cada negocio te paga comisión hasta por 6 meses. Y cada mes que sumas negocios nuevos, tus ingresos se acumulan unos sobre otros.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="mb-4 text-sm text-vylta-muted">Cuando estés listo para cambiar vidas — la tuya incluida.</p>
          <button
            onClick={aceptarBienvenida}
            disabled={accepting}
            className="inline-flex items-center gap-2 rounded-xl border border-vylta-gold/40 bg-vylta-gold/10 px-6 py-3 text-base font-bold text-vylta-gold transition hover:bg-vylta-gold/20 disabled:opacity-50"
          >
            {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
            Comenzar mi camino como Embajador
          </button>
        </div>
      </div>
    );
  }

  // ═══ DASHBOARD ═══
  const lista = clientes || [];
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Saludo + codigo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-vylta-bone">Hola, {resumen.nombre.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-vylta-muted">Este es tu centro como embajador. Entre más negocios traes, más ganas.</p>
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(resumen.ref_code); toast.success('Código copiado'); }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-vylta-gold/30 bg-vylta-gold/5 px-4 py-2.5 transition hover:bg-vylta-gold/10"
        >
          <div className="text-left">
            <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-muted">Tu código</div>
            <div className="font-mono text-lg font-bold text-vylta-gold">{resumen.ref_code}</div>
          </div>
          <Copy className="h-4 w-4 text-vylta-gold" />
        </button>
      </div>

      {/* Banner perfil incompleto */}
      {!resumen.perfil_completo && (
        <Link
          href="/embajador/perfil"
          className="flex items-center gap-3 rounded-xl border border-vylta-gold/40 bg-vylta-gold/10 px-4 py-3 transition hover:bg-vylta-gold/15"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-vylta-gold" />
          <span className="flex-1 text-sm font-semibold text-vylta-bone">
            Completa tus datos bancarios para poder recibir tus pagos.
          </span>
          <ArrowRight className="h-4 w-4 text-vylta-gold" />
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Mis clientes" value={resumen.clientes_total} hint={`${resumen.clientes_activos} pagando`} Icon={Users} />
        <Kpi label="Nuevos del mes" value={resumen.nuevos_mes} hint={`Nivel ${nivelPct(resumen.nuevos_mes)}`} Icon={TrendingUp} />
        <Kpi label="Comisión acumulada" value={MXN(resumen.comision_total)} hint="Confirmada" Icon={Sparkles} isMoney />
        <Kpi label="Tu próximo corte" value={MXN(resumen.por_pagar)} hint="Pendiente de pago" Icon={Wallet} isMoney />
      </div>

      {/* Mis clientes */}
      <div className="overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface shadow-card-lg">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Users className="h-4 w-4 text-vylta-gold" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Negocios que has traído</h2>
        </div>
        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-9 w-9 text-vylta-subtle" />
            <p className="text-sm font-semibold text-vylta-bone">Todavía no hay negocios con tu código</p>
            <p className="max-w-xs text-sm text-vylta-muted">Comparte tu código <span className="font-mono font-bold text-vylta-gold">{resumen.ref_code}</span> y aquí verás a cada negocio que se une gracias a ti.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-vylta-subtle">
                  <th className="px-5 py-3 font-bold">Negocio</th>
                  <th className="px-4 py-3 font-bold">Plan</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c, i) => {
                  const pagando = c.status === 'active';
                  return (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-5 py-3 font-semibold text-vylta-bone">{c.business_name}</td>
                      <td className="px-4 py-3 text-vylta-muted">{c.plan_type}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold', pagando ? 'border-vylta-green/40 bg-vylta-green/10 text-vylta-green' : 'border-border bg-vylta-card/40 text-vylta-subtle')}>
                          {pagando ? 'Pagando' : 'Sin plan'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Como ganas */}
      <div className="rounded-2xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-vylta-gold" />
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Cómo ganas</span>
        </div>
        <p className="mt-3 text-sm text-vylta-muted">
          Tu comisión del mes depende de cuántos negocios nuevos traes: <span className="font-bold text-vylta-bone">20%</span> (1–10), <span className="font-bold text-vylta-sky">25%</span> (11–15) y <span className="font-bold text-vylta-gold">30%</span> (16+). Cada negocio te genera comisión hasta por 6 meses, y tus pagos se hacen por transferencia (SPEI) cada mes.
        </p>
      </div>
    </div>
  );
}

function Punto({ Icon, titulo, texto }: { Icon: any; titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vylta-gold/10">
        <Icon className="h-4 w-4 text-vylta-gold" />
      </div>
      <div>
        <div className="text-sm font-bold text-vylta-bone">{titulo}</div>
        <div className="mt-0.5 text-sm text-vylta-muted">{texto}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, Icon, isMoney }: {
  label: string; value: number | string; hint: string; Icon: any; isMoney?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-vylta-gold/15 blur-2xl opacity-25" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className="h-4 w-4 text-vylta-gold" />
        </div>
        <div className={cn('mt-3 font-bold tabular-nums tracking-tightest text-vylta-bone', isMoney ? 'text-2xl' : 'text-3xl')}>{value}</div>
        <div className="mt-1 text-sm text-vylta-muted">{hint}</div>
      </div>
    </div>
  );
}
