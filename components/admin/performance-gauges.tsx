'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database, HardDrive, Wifi, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardInfo } from '@/components/admin/dashboard-info';

// ═════════════════════════════════════════════════════════════════════
// PerformanceGauges (v5 — Umbrales actualizados para Plan PRO, May 23 2026)
//
// CAMBIOS EN v5:
//   • STORAGE: medido con pg_database_size() REAL (no estimación de 1KB/fila).
//     Nuevo límite: 8 GB de disco del Plan Pro (era 500 MB del Free).
//   • DATABASE LOAD: límite subido de 5K filas → 50K filas (cómodo en Pro).
//   • RESPONSE TIME: rangos relajados (era 400/800, ahora 500/1500).
//     Razón: 4 queries paralelas desde México hacia Sao Paulo siempre dan
//     400-800ms en condiciones normales — antes salía "Atención" todo el día.
//   • REALTIME: límite subido de 200 → 500 conexiones concurrentes (Pro).
//   • Nueva RPC get_system_health_stats() para obtener db_size_bytes REAL.
//
// LÍMITES PLAN PRO (verificados May 23 2026):
//   • Disk Size:          8 GB iniciales con auto-grow
//   • Storage (archivos): 100 GB
//   • Egress:             250 GB/mes
//   • Realtime concurrent: 500 conexiones
//   • Monthly Active Users: 100K
//   • Edge Functions:     2M invocations/mes
//
// HISTORIAL:
//   v4 (May 23 2026): Agregado tooltip ⓘ.
//   v3 (May 22 2026): Umbrales Free Plan (5K filas / 500 MB / 800ms / 200 ch).
// ═══════════════════════════════════════════════════════════════════════

// Límites del Plan Pro
const DB_ROW_LIMIT = 50_000;          // 50K filas como umbral confortable
const DISK_SIZE_BYTES = 8 * 1024 ** 3; // 8 GB iniciales Pro plan
const REALTIME_LIMIT = 500;            // 500 conexiones concurrentes Pro
// Response time: 500ms healthy, 500-1500ms warning, >1500ms critical
// (México → São Paulo: 150-300ms base + 4 queries paralelas + overhead)
const RT_GREEN_MAX = 500;
const RT_RED_MIN = 1500;

interface GaugeData {
  label: string;
  value: number;
  display: string;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
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
        { data: healthStats, error: healthError },
      ] = await Promise.all([
        supabase.from('business_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('subscription_plans').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_system_health_stats'),
      ]);

      const responseTime = Math.round(performance.now() - start);
      const totalRows = (totalRows1 || 0) + (totalRows2 || 0) + (totalRows3 || 0) + (totalRows4 || 0);

      if (healthError) console.warn('[PerformanceGauges] Health stats error:', healthError);
      const dbSizeBytes = Number((healthStats as any)?.[0]?.db_size_bytes) || 0;

      // ─── DATABASE LOAD: 50K filas como tope Pro
      const dbLoadPct = Math.min(Math.round((totalRows / DB_ROW_LIMIT) * 100), 100);
      const dbStatus: 'healthy' | 'warning' | 'critical' =
        dbLoadPct > 80 ? 'critical' : dbLoadPct > 50 ? 'warning' : 'healthy';

      // ─── STORAGE: tamaño REAL de la BD vs 8 GB del Pro
      const storagePct = Math.min(Math.round((dbSizeBytes / DISK_SIZE_BYTES) * 100), 100);
      const storageStatus: 'healthy' | 'warning' | 'critical' =
        storagePct > 80 ? 'critical' : storagePct > 60 ? 'warning' : 'healthy';
      const storageDisplay = `${formatBytes(dbSizeBytes)} / 8 GB`;

      // ─── RESPONSE TIME: umbrales realistas Méx → SP
      const responsePct = Math.min(Math.round((responseTime / 2000) * 100), 100);
      const responseStatus: 'healthy' | 'warning' | 'critical' =
        responseTime > RT_RED_MIN ? 'critical' :
        responseTime > RT_GREEN_MAX ? 'warning' :
        'healthy';

      // ─── REALTIME: por ahora estimamos por #business_profiles (cada negocio = 1 canal)
      // En el futuro se puede medir conexiones reales con Supabase Realtime metrics API.
      const realtimeChannels = totalRows1 || 0;
      const realtimePct = Math.min(Math.round((realtimeChannels / REALTIME_LIMIT) * 100), 100);
      const realtimeStatus: 'healthy' | 'warning' | 'critical' =
        realtimePct > 80 ? 'critical' : realtimePct > 50 ? 'warning' : 'healthy';

      const newGauges: GaugeData[] = [
        {
          label: 'DATABASE LOAD',
          value: dbLoadPct,
          display: `${totalRows.toLocaleString('es-MX')} filas`,
          status: dbStatus,
          Icon: Database,
          hint: `de ${DB_ROW_LIMIT.toLocaleString('es-MX')} cómodos`,
        },
        {
          label: 'STORAGE',
          value: storagePct,
          display: storageDisplay,
          status: storageStatus,
          Icon: HardDrive,
          hint: 'Plan Supabase Pro',
        },
        {
          label: 'RESPONSE TIME',
          value: responsePct,
          display: `${responseTime} ms`,
          status: responseStatus,
          Icon: Zap,
          hint: 'Méx → São Paulo',
        },
        {
          label: 'REALTIME',
          value: realtimePct,
          display: `${realtimeChannels} / ${REALTIME_LIMIT}`,
          status: realtimeStatus,
          Icon: Wifi,
          hint: 'Conexiones simultáneas',
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
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">
            Salud del sistema
          </h2>
          <DashboardInfo
            title="Salud del sistema"
            description="Medidores en tiempo real del estado técnico de VYLTA. Cada uno cambia de color según qué tan saludable está: verde (bien), amarillo (atención), rojo (crítico)."
            metrics={[
              { label: 'Database load', meaning: 'Cuántos registros tiene la base de datos. El plan Pro maneja cómodamente hasta 50 mil filas; hoy tenemos muy pocas.' },
              { label: 'Storage', meaning: 'Espacio real ocupado en disco. El plan Pro nos da 8 GB iniciales y crece automáticamente si los llenamos.' },
              { label: 'Response time', meaning: 'Cuánto tarda VYLTA en responder. De México a São Paulo (donde está la base de datos), entre 300 y 800 ms es normal. Solo es crítico arriba de 1.5 segundos.' },
              { label: 'Realtime', meaning: 'Conexiones simultáneas en vivo. El plan Pro permite hasta 500 al mismo tiempo. Cada negocio que tiene el CRM abierto suma una.' },
            ]}
            whyMatters="Si algún medidor pasa a rojo, hay que actuar pronto: optimizar queries, revisar capacidad, o si llegamos al tope, agregar add-ons al plan Pro. Por ahora todo cómodo: somos 17 negocios usando menos del 1% en todo."
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-vylta-subtle">
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
            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
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
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle mt-1">{label}</div>
          <div className="text-xs text-vylta-muted mt-0.5">{hint}</div>
        </div>
      </div>
    </div>
  );
}
