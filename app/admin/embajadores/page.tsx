'use client';

import { useMemo } from 'react';
import {
  Users, Loader2, RefreshCw, Wallet, Building2, TrendingUp, Plus, Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAdminEmbajadores } from '@/hooks/use-admin-embajadores';

const MXN = (n: number) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

// Nivel/comision del mes en curso segun clientes nuevos (primer pago este mes).
function tierFromNuevos(n: number): { pct: string; cls: string } {
  if (n >= 16) return { pct: '30%', cls: 'text-vylta-gold border-vylta-gold/40 bg-vylta-gold/10' };
  if (n >= 11) return { pct: '25%', cls: 'text-vylta-sky border-vylta-sky/40 bg-vylta-sky/10' };
  if (n >= 1) return { pct: '20%', cls: 'text-vylta-green border-vylta-green/40 bg-vylta-green/10' };
  return { pct: '—', cls: 'text-vylta-subtle border-border bg-vylta-card/40' };
}

function estatusBadge(estatus: string): string {
  if (estatus === 'activo') return 'text-vylta-green border-vylta-green/40 bg-vylta-green/10';
  if (estatus === 'pausado') return 'text-vylta-gold border-vylta-gold/40 bg-vylta-gold/10';
  return 'text-vylta-rose border-vylta-rose/40 bg-vylta-rose/10';
}

export default function AdminEmbajadoresPage() {
  const { data, isLoading, isFetching, refetch } = useAdminEmbajadores();
  const embajadores = data || [];

  const totals = useMemo(() => {
    return embajadores.reduce(
      (acc, e) => {
        acc.activos += e.estatus === 'activo' ? 1 : 0;
        acc.clientes += Number(e.clientes_total) || 0;
        acc.activosClientes += Number(e.clientes_activos) || 0;
        acc.porPagar += Number(e.por_pagar) || 0;
        return acc;
      },
      { activos: 0, clientes: 0, activosClientes: 0, porPagar: 0 },
    );
  }, [embajadores]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-vylta-muted">
            Cargando embajadores
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-vylta-bone">Red de Embajadores</h1>
          <p className="mt-1 text-sm text-vylta-muted">
            Quién trae clientes nuevos, su nivel del mes y cuánto le toca en el próximo corte.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/10 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            {isFetching ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={() => toast.info('El alta de embajadores llega en el siguiente paso.')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-3 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20"
          >
            <Plus className="h-4 w-4" />
            Nuevo embajador
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Embajadores" value={embajadores.length} hint={`${totals.activos} activos`} Icon={Users} accent="gold" />
        <Kpi label="Clientes atribuidos" value={totals.clientes} hint={`${totals.activosClientes} pagando`} Icon={Building2} accent="green" />
        <Kpi label="Por pagar (corte)" value={MXN(totals.porPagar)} hint="Cortes pendientes" Icon={Wallet} accent="gold" isMoney />
        <Kpi label="Pagando" value={totals.activosClientes} hint="Clientes con plan activo" Icon={TrendingUp} accent="luxury" />
      </div>

      {/* TABLA */}
      <div className="overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface shadow-card-lg">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Crown className="h-4 w-4 text-vylta-gold" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Embajadores</h2>
        </div>

        {embajadores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Users className="h-10 w-10 text-vylta-subtle" />
            <p className="text-sm font-semibold text-vylta-bone">Aún no hay embajadores</p>
            <p className="max-w-sm text-sm text-vylta-muted">
              Cuando des de alta a tu primer embajador, aquí verás sus clientes, su nivel y su comisión.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-vylta-subtle">
                  <th className="px-6 py-3 font-bold">Embajador</th>
                  <th className="px-4 py-3 font-bold">Estatus</th>
                  <th className="px-4 py-3 text-center font-bold">Clientes</th>
                  <th className="px-4 py-3 text-center font-bold">Nuevos del mes</th>
                  <th className="px-4 py-3 text-center font-bold">Nivel</th>
                  <th className="px-4 py-3 text-right font-bold">Comisión acumulada</th>
                  <th className="px-6 py-3 text-right font-bold">Por pagar</th>
                </tr>
              </thead>
              <tbody>
                {embajadores.map((e) => {
                  const tier = tierFromNuevos(Number(e.nuevos_mes) || 0);
                  return (
                    <tr key={e.id} className="border-b border-border/60 transition-colors hover:bg-vylta-card/30">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-vylta-bone">{e.nombre}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded bg-vylta-card/60 px-1.5 py-0.5 font-mono text-[11px] text-vylta-gold">{e.ref_code}</span>
                          {!e.perfil_completo && (
                            <span className="text-[11px] text-vylta-gold/80">perfil incompleto</span>
                          )}
                        </div>
                        {e.email && <div className="mt-0.5 text-xs text-vylta-muted">{e.email}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', estatusBadge(e.estatus))}>
                          {e.estatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="font-bold tabular-nums text-vylta-bone">{e.clientes_total}</div>
                        <div className="text-[11px] text-vylta-muted">{e.clientes_activos} pagando</div>
                      </td>
                      <td className="px-4 py-4 text-center font-bold tabular-nums text-vylta-bone">{e.nuevos_mes}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold', tier.cls)}>
                          {tier.pct}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-vylta-bone">{MXN(e.comision_total)}</td>
                      <td className="px-6 py-4 text-right font-bold tabular-nums text-vylta-gold">{MXN(e.por_pagar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-vylta-subtle">
        El “Nivel” es la comisión del mes según los clientes nuevos: 20% (1–10), 25% (11–15), 30% (16+).
        Los cortes se calculan solos el día 1 de cada mes y quedan pendientes hasta que pagas por SPEI.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, Icon, accent, isMoney }: {
  label: string; value: number | string; hint: string; Icon: any;
  accent: 'green' | 'gold' | 'luxury' | 'blue'; isMoney?: boolean;
}) {
  const colorMap = {
    green: { text: 'text-vylta-green', halo: '#10B981' },
    gold: { text: 'text-vylta-gold', halo: '#F59E0B' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
    blue: { text: 'text-vylta-sky', halo: '#0EA5E9' },
  }[accent];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-5 shadow-card transition-all hover:border-vylta-gold/30">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-25" style={{ background: colorMap.halo }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className={cn('mt-3 font-bold tabular-nums tracking-tightest', colorMap.text, isMoney ? 'text-2xl' : 'text-3xl')}>{value}</div>
        <div className="mt-1 text-sm text-vylta-muted">{hint}</div>
      </div>
    </div>
  );
}
