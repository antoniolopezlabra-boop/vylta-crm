'use client';

import { Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';
import type { BusinessTypeDistribution } from '@/hooks/use-admin-growth-metrics';

// ═══════════════════════════════════════════════════════════════════════
// BusinessTypeChart — Distribución por tipo de negocio (May 23 2026)
//
// Bar chart horizontal mostrando cantidad de negocios por categoria
// (Barbería, Salón, Spa, Clinica dental, etc) con sub-bar:
//   • Verde = paga plan
//   • Gris = plan gratuito
//
// Permite ver rapidamente que verticales convierten mejor a pago.
// ═══════════════════════════════════════════════════════════════════════

interface BusinessTypeChartProps {
  data: BusinessTypeDistribution[];
  loading?: boolean;
}

export function BusinessTypeChart({ data, loading }: BusinessTypeChartProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
        <div className="h-64 shimmer rounded-lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-4 w-4 text-vylta-gold" />
          <h3 className="text-sm font-bold text-vylta-bone">Tipos de negocio</h3>
        </div>
        <div className="text-sm text-vylta-subtle italic py-8 text-center">
          Sin negocios clasificados aún
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.total_count), 1);
  const totalNegocios = data.reduce((sum, d) => sum + d.total_count, 0);
  const totalPagados = data.reduce((sum, d) => sum + d.paid_count, 0);
  const conversionRate = totalNegocios > 0
    ? Math.round((totalPagados / totalNegocios) * 100)
    : 0;

  // Categoria con mejor conversion (al menos 2 negocios para que sea significativo)
  const bestConverter = [...data]
    .filter(d => d.total_count >= 2)
    .sort((a, b) => (b.paid_count / b.total_count) - (a.paid_count / a.total_count))[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg">
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-vylta-gold/8 blur-[80px]" />

      <div className="relative">
        <div className="mb-5 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-vylta-gold" />
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-vylta-bone">
            Tipos de negocio
          </h3>
          <DashboardInfo
            title="Tipos de negocio"
            description="Qué tipo de negocios usan VYLTA: barberías, salones, psicólogos, etc. Cada barra muestra cuántos hay y de esos, cuántos pagan plan vs están en gratis."
            metrics={[
              { label: 'Barra verde', meaning: 'Negocios que pagan plan ($399 o $799 al mes).' },
              { label: 'Barra gris', meaning: 'Negocios en plan Básico (gratis).' },
              { label: '% conversión', meaning: 'Qué porcentaje de cada categoría logra convertir a plan pagado.' },
            ]}
            whyMatters="Nos dice qué tipos de negocio convierten mejor a pagar. Si las barberías convierten más que los salones, vale la pena enfocar marketing y features hacia barberías. También revela qué categorías aún no atacamos y representan oportunidad."
          />
        </div>

        {/* Resumen ejecutivo */}
        <div className="grid grid-cols-3 gap-3 mb-5 pb-5 border-b border-border">
          <div>
            <div className="text-2xl font-bold tabular-nums text-vylta-bone">{data.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-subtle">Categorías</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-vylta-gold">{conversionRate}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-subtle">Conversión total</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-vylta-green">{totalPagados}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-subtle">Pagan plan</div>
          </div>
        </div>

        {/* Lista de categorias */}
        <div className="space-y-2.5">
          {data.map((category) => {
            const totalPct = (category.total_count / maxCount) * 100;
            const paidPct = category.total_count > 0
              ? (category.paid_count / category.total_count) * 100
              : 0;
            const isBest = bestConverter && category.business_type === bestConverter.business_type;

            return (
              <div key={category.business_type}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-vylta-bone">
                      {category.business_type}
                    </span>
                    {isBest && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-vylta-green bg-vylta-green/10 px-1.5 py-0.5 rounded">
                        Mejor conversión
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] tabular-nums">
                    <span className="text-vylta-green font-bold">{category.paid_count} paga</span>
                    <span className="text-vylta-subtle">/</span>
                    <span className="text-vylta-muted">{category.free_count} gratis</span>
                    <span className="text-vylta-gold font-bold ml-1">= {category.total_count}</span>
                  </div>
                </div>

                {/* Barra de progreso con stack pago vs gratis */}
                <div className="h-2 rounded-full bg-vylta-card overflow-hidden flex">
                  <div
                    className="h-full bg-vylta-green transition-all duration-700"
                    style={{ width: `${(category.paid_count / maxCount) * 100}%` }}
                  />
                  <div
                    className="h-full bg-vylta-muted/40 transition-all duration-700"
                    style={{ width: `${(category.free_count / maxCount) * 100}%` }}
                  />
                </div>

                {category.total_count >= 2 && paidPct > 0 && (
                  <div className="text-[10px] text-vylta-subtle tabular-nums mt-0.5">
                    {Math.round(paidPct)}% paga plan
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-5 pt-4 border-t border-border flex items-center gap-4 justify-center text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded bg-vylta-green" />
            <span className="text-vylta-muted">Paga plan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded bg-vylta-muted/40" />
            <span className="text-vylta-muted">Gratis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
