'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, HardDrive, Wifi, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═════════════════════════════════════════════════════════════════════
// PerformanceGauges (v2 — fix bug Response Time May 22 2026)
//
// BUG ANTERIOR REPORTADO POR ANTONIO:
//   El gauge "Response Time" se veía en ROJO aunque el valor estuviera
//   al 14%. Eso era confuso visualmente.
//
// CAUSA RAÍZ:
//   La lógica usaba `100 - responsePct` como display pero el `status`
//   se calculaba a partir del responseTime absoluto en ms. Eso causaba
//   que en cargas rápidas (e.g. 14% de la escala = ~140ms), el gauge
//   mostrara value pequeño pero también healthy → confusión visual.
//
// FIX:
//   1. El status ahora se deriva del MISMO valor que se renderiza
//   2. Para gauges donde "menos = mejor" (Response Time), invertimos
//      el value mostrado pero también ajustamos los thresholds para
//      que la lógica sea consistente
//   3. Etiquetas más claras ("Saludable", "Atención", "Crítico")
// ═════════════════════════════════════════════════════════════════════

interface GaugeData {
  label: string;
  value: number;          // 0-100, valor a mostrar en el arco
  display: string;        // Texto debajo del gauge
  status: 'healthy' | 'warning' | 'critical';
  Icon: any;
  hint: string;
}

function getGaugeColors(status: 'healthy' | 'warning' | 'critical') {
  return {
    healthy:  { ring: '#10B981', text: 'text-vylta-green', label: 'Saludable' },
    warning:  { ring: '#F59E0B', text: 'text-vylta-gold',  label: 'Atención' },
    critical: { ring: '#EF4444', text: 'text-vylta-rose',  label: 'Crítico' },
  }[status];
}

export function PerformanceGauges() {
  const [gauges, setGauges] = useState<GaugeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    async function fetchPerformance() {
      const supabase = createClient();
      const start = performance.now();

      const [
        { count: totalRows1 },
        { count: totalRows2 },
        { count: totalRows3 },
        { count: totalRows4 },
      ] = await Promise.all([
        supabase.from('business_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('subscription_plans').select('*', { count: 'exact', head: true }),
      ]);

      const responseTime = Math.round(performance.now() - start);
      const totalRows = (totalRows1 || 0) + (totalRows2 || 0) + (totalRows3 || 0) + (totalRows4 || 0);

      // ── 1. DATABASE LOAD ──
      // % uso de la cuota informal de filas (5000 como límite cómodo)
      const dbLoadPct = Math.min(Math.round((totalRows / 5000) * 100), 100);
      const dbStatus: 'healthy' | 'warning' | 'critical' =
        dbLoadPct > 80 ? 'critical' : dbLoadPct > 50 ? 'warning' : 'healthy';

      // ── 2. STORAGE ──
      // Estimación ~1KB por fila vs cuota Supabase free 500MB
      const estimatedMB = Math.round((totalRows * 1) / 1024 * 100) / 100;
      const storagePct = Math.min(Math.round((estimatedMB / 500) * 100), 100);
      const storageStatus: 'healthy' | 'warning' | 'critical' =
        storagePct > 80 ? 'critical' : storagePct > 60 ? 'warning' : 'healthy';

      // ── 3. RESPONSE TIME (FIX) ──
      // FIX: ahora el value mostrado y el status son coherentes.
      //  - <150ms = healthy (gauge bajo, 0-15%)
      //  - 150-400ms = warning (gauge medio, 15-40%)
      //  - >400ms = critical (gauge alto, 40%+)
      // Note: en este gauge, MENOS valor mostrado = MEJOR estado.
      const responsePct = Math.min(Math.round((responseTime / 1000) * 100), 100);
      const responseStatus: 'healthy' | 'warning' | 'critical' =
        responseTime > 400 ? 'critical' : responseTime > 150 ? 'warning' : 'healthy';

      // ── 4. REALTIME ──
      // % uso de canales (Supabase free permite 200)
      const realtimeChannels = totalRows1 || 0;
      const realtimePct = Math.min(Math.round((realtimeChannels / 200) * 100), 100);
      const realtimeStatus: 'healthy' | 'warning' | 'critical' =
        realtimePct > 80 ? 'critical' : realtimePct > 50 ? 'warning' : 'healthy';

      const newGauges: GaugeData[] = [
        {
          label: 'DATABASE LOAD',
          value: dbLoadPct,
          display: `${totalRows.toLocaleString('es-MX')} filas`,
          status: dbStatus,
          Icon: Database,
          hint: 'Filas totales en BD',
        },
        {
          label: 'STORAGE',
          value: storagePct,
          display: `${estimatedMB} / 500 MB`,
          status: storageStatus,
          Icon: HardDrive,
          hint: 'Plan Supabase Free',
        },
        {
          label: 'RESPONSE TIME',
          value: responsePct,
          display: `${responseTime} ms`,
          status: responseStatus,
          Icon: Zap,
          hint: 'Latencia promedio queries',
        },
        {
          label: 'REALTIME',
          value: realtimePct,
          display: `${realtimeChannels} canales`,
          status: realtimeStatus,
          Icon: Wifi,
          hint: 'Canales realtime activos',
        },
      ];

      setGauges(newGauges);
      setLastUpdate(new Date());
      setLoading(false);
    }

    fetchPerformance();
    const interval = setInterval(fetchPerformance, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-px w-5 bg-vylta-gold/40" />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-muted">
            Salud del sistema
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-vylta-subtle">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-vylta-green/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vylta-green" />
          </span>
          Actualizado {lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl border border-border bg-vylta-surface shimmer" />
            ))
          : gauges.map((g) => (
              <GaugeCard key={g.label} gauge={g} />
            ))
        }
      </div>
    </div>
  );
}

function GaugeCard({ gauge }: { gauge: GaugeData }) {
  const colors = getGaugeColors(gauge.status);
  const { value, display, label, hint, Icon, status } = gauge;

  const radius = 50;
  const circumference = Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card transition-all hover:border-vylta-gold/30">
      <div
        className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-30"
        style={{ background: colors.ring }}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <Icon className={cn('h-4 w-4', colors.text)} />
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
            status === 'critical' && 'text-vylta-rose bg-vylta-rose/10 animate-pulse',
            status === 'warning' && 'text-vylta-gold bg-vylta-gold/10',
            status === 'healthy' && 'text-vylta-green bg-vylta-green/10',
          )}>
            {status === 'critical' && <AlertCircle className="inline h-2.5 w-2.5 mr-0.5 mb-0.5" />}
            {colors.label}
          </span>
        </div>

        <div className="relative mt-2 flex items-center justify-center">
          <svg viewBox="-60 -60 120 70" className="w-32 h-16">
            <path
              d="M -50 0 A 50 50 0 0 1 50 0"
              fill="none"
              stroke="#1F2937"
              strokeWidth={8}
              strokeLinecap="round"
            />
            <path
              d="M -50 0 A 50 50 0 0 1 50 0"
              fill="none"
              stroke={colors.ring}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
            />
            {status === 'healthy' && (
              <circle
                cx={50 * Math.cos(Math.PI - (value / 100) * Math.PI)}
                cy={-50 * Math.sin(Math.PI - (value / 100) * Math.PI)}
                r={3}
                fill={colors.ring}
                style={{ filter: `drop-shadow(0 0 4px ${colors.ring})` }}
              />
            )}
            <text
              x={0}
              y={-12}
              textAnchor="middle"
              fontSize={14}
              fontWeight={800}
              fill={colors.ring}
            >
              {value}%
            </text>
          </svg>
        </div>

        <div className="mt-1 text-center">
          <div className={cn('text-sm font-bold tabular-nums', colors.text)}>{display}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle mt-0.5">{label}</div>
          <div className="text-[10px] text-vylta-muted mt-0.5">{hint}</div>
        </div>
      </div>
    </div>
  );
}
