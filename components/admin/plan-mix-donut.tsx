'use client';

import { Gem, Crown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';

// ═══════════════════════════════════════════════════════════════════════
// PlanMixDonut — Donut chart de distribución de planes
//
// Muestra la proporcion de negocios en cada plan (Básico/Premium/Luxury).
// SVG nativo — zero dependencies, performance perfecta.
//
// ⓘ ACTUALIZACIÓN (May 23 2026):
// Agregado tooltip explicativo junto al titulo para que Hugo entienda
// que es la distribucion de planes y por que importa.
// ═══════════════════════════════════════════════════════════════════════

interface PlanMixDonutProps {
  premiumCount: number;
  luxuryCount: number;
  basicoCount: number;
}

export function PlanMixDonut({ premiumCount, luxuryCount, basicoCount }: PlanMixDonutProps) {
  const total = premiumCount + luxuryCount + basicoCount;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
          Distribución de planes
        </div>
        <div className="flex items-center justify-center h-40 text-sm text-vylta-muted">
          Sin negocios registrados aún
        </div>
      </div>
    );
  }

  const segments = [
    { label: 'Básico',  count: basicoCount,  color: '#64748B', icon: Users, price: 0 },
    { label: 'Premium', count: premiumCount, color: '#10B981', icon: Gem,   price: 399 },
    { label: 'Luxury',  count: luxuryCount,  color: '#A78BFA', icon: Crown, price: 799 },
  ];

  const radius = 60;
  const innerRadius = 40;
  const center = 75;

  let currentAngle = -Math.PI / 2;
  const paths = segments.map((seg) => {
    const pct = seg.count / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = currentAngle + angle;

    const x1 = center + radius * Math.cos(currentAngle);
    const y1 = center + radius * Math.sin(currentAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(currentAngle);
    const y4 = center + innerRadius * Math.sin(currentAngle);

    const largeArc = pct > 0.5 ? 1 : 0;

    const path = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;

    const result = { path, color: seg.color, label: seg.label, count: seg.count, pct, icon: seg.icon, price: seg.price };
    currentAngle = endAngle;
    return result;
  });

  return (
    <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <div className="w-0.5 h-10 rounded-full bg-vylta-gold" />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-vylta-bone">Distribución de planes</h3>
            <DashboardInfo
              title="Distribución de planes"
              description="Gráfica circular que muestra qué porcentaje de los negocios está en cada plan: Básico (gratis), Premium o Luxury."
              metrics={[
                { label: 'Básico', meaning: 'Plan gratuito con funciones básicas. Hasta 10 citas/mes.' },
                { label: 'Premium', meaning: 'Plan pagado a $399/mes. Citas ilimitadas + WhatsApp + reportes.' },
                { label: 'Luxury', meaning: 'Plan premium a $799/mes. Todo lo de Premium + multi-staff + agente AI.' },
              ]}
              whyMatters="Nos dice si VYLTA está logrando que la gente pague. Lo ideal es que Premium y Luxury juntos sean más de la mitad. Si la mayoría está en gratis, hay que mejorar las razones para pagar."
            />
          </div>
          <p className="text-[11px] text-vylta-muted mt-0.5">{total} negocios en total</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-center">
        {/* Donut SVG */}
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 150 150" className="w-full max-w-[160px]">
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.path}
                fill={p.color}
                stroke="#0F1424"
                strokeWidth={2}
                style={{ filter: `drop-shadow(0 0 4px ${p.color}40)` }}
              />
            ))}
            <text x={75} y={70} textAnchor="middle" fontSize={20} fontWeight={800} fill="#F1F5F9">
              {total}
            </text>
            <text x={75} y={85} textAnchor="middle" fontSize={8} fontWeight={700} fill="#94A3B8" letterSpacing={1}>
              NEGOCIOS
            </text>
          </svg>
        </div>

        {/* Leyenda */}
        <div className="space-y-2">
          {paths.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ background: p.color, boxShadow: `0 0 6px ${p.color}80` }}
                />
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                <div className="flex-1">
                  <div className="text-xs font-bold text-vylta-bone">{p.label}</div>
                  <div className="text-[10px] text-vylta-muted">
                    {p.price > 0 ? `$${p.price}/mes` : 'Gratis'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums" style={{ color: p.color }}>
                    {p.count}
                  </div>
                  <div className="text-[10px] text-vylta-subtle tabular-nums">
                    {Math.round(p.pct * 100)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
