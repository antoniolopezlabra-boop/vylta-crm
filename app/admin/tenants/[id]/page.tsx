'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  Gem,
  Crown,
  TrendingUp,
  DollarSign,
  Activity,
  Globe,
  ExternalLink,
  CalendarDays,
  Briefcase,
} from 'lucide-react';
import { formatLastSeen } from '@/lib/admin-tenants';
import { useAdminTenantDetail } from '@/hooks/use-admin-tenants';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { getApptStatusStyle } from '@/lib/appointments';
import { MONTHS_ES } from '@/lib/date-utils';
import { StaffLimitEditor } from '@/components/admin/staff-limit-editor';

// ══════════════════════════════════════════════════════════════════════
// /admin/tenants/[id] — Detalle de un negocio específico
//
// OPTIMIZADO con TanStack Query (useAdminTenantDetail):
//   • Si el user pasó por /admin/tenants y hizo hover sobre la fila,
//     el detalle YA ESTÁ EN CACHE → carga instantánea, sin spinner
//   • Si volvió de otra ruta dentro de 30s, también instantáneo
//   • Cache key compuesto: ['admin-tenant', userId] — cada tenant
//     tiene su propio cache independiente
//
// ⚡ Jun 2026: añadido <StaffLimitEditor> para que un admin ajuste el
// límite de colaboradores de este negocio (base para Enterprise).
// ══════════════════════════════════════════════════════════════════════

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: tenant, isLoading, error } = useAdminTenantDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-vylta-card/30 py-16 text-center">
        <Building2 className="h-10 w-10 text-vylta-subtle mb-3" />
        <h3 className="text-sm font-bold text-vylta-bone">Negocio no encontrado</h3>
        <p className="text-xs text-vylta-muted mt-1">El tenant que buscas no existe o fue eliminado.</p>
        <Link
          href="/admin/tenants"
          prefetch
          className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-vylta-gold hover:text-vylta-gold/80"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a la lista
        </Link>
      </div>
    );
  }

  const planColors = {
    Basico:  'bg-vylta-card/60 text-vylta-muted border-border',
    Premium: 'bg-vylta-green/10 text-vylta-green border-vylta-green/30',
    Luxury:  'bg-vylta-luxury/10 text-vylta-luxury border-vylta-luxury/30',
  }[tenant.plan_label] || 'bg-vylta-card text-vylta-muted border-border';

  const createdDate = new Date(tenant.created_at);
  const createdLabel = `${createdDate.getDate()} de ${MONTHS_ES[createdDate.getMonth()].toLowerCase()} ${createdDate.getFullYear()}`;

  const bookingUrl = tenant.business_slug ? `https://book.vylta.lat/${tenant.business_slug}` : null;
  const phoneClean = tenant.phone?.replace(/\D/g, '') || null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/tenants"
          prefetch
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold text-vylta-muted">
          Negocios · <span className="text-vylta-bone">{tenant.business_name}</span>
        </h1>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-vylta-gold/8 blur-[80px]" />
        <div className="relative flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-vylta-gold/10 text-lg font-bold text-vylta-gold ring-1 ring-vylta-gold/30">
            {tenant.business_logo_url ? (
              <img src={tenant.business_logo_url} alt={tenant.business_name} className="h-full w-full rounded-2xl object-cover" />
            ) : (
              getInitials(tenant.business_name)
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-vylta-bone tracking-tightest">{tenant.business_name}</h2>
              <div className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', planColors)}>
                {tenant.plan_label === 'Premium' && <Gem className="h-2.5 w-2.5" />}
                {tenant.plan_label === 'Luxury' && <Crown className="h-2.5 w-2.5" />}
                {tenant.plan_label}
                {tenant.plan_price > 0 && <span className="opacity-70">· ${tenant.plan_price}</span>}
              </div>
              {tenant.is_active_30d && (
                <div className="inline-flex items-center gap-1 rounded border border-vylta-green/30 bg-vylta-green/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-green">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-vylta-green/60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-vylta-green" />
                  </span>
                  Activo
                </div>
              )}
            </div>

            {tenant.business_type && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-vylta-muted">
                <Briefcase className="h-3 w-3" />
                {tenant.business_type}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-vylta-muted">
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="flex items-center gap-1 hover:text-vylta-bone transition-colors">
                  <Mail className="h-3 w-3" />
                  {tenant.email}
                </a>
              )}
              {tenant.phone && phoneClean && (
                <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-vylta-whatsapp transition-colors">
                  <Phone className="h-3 w-3" />
                  {tenant.phone}
                </a>
              )}
              {tenant.business_address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {tenant.business_address}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-vylta-subtle">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Alta: {createdLabel}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Última visita: {formatLastSeen(tenant.last_seen_at)}
              </span>
            </div>
          </div>
        </div>

        {bookingUrl && (
          <div className="relative mt-4 pt-4 border-t border-border">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 px-3 py-1.5 text-xs font-bold text-vylta-gold transition hover:bg-vylta-gold/10">
              <Globe className="h-3 w-3" />
              Ver booking público
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailKpi label="Citas totales" value={tenant.appointments_count} Icon={Calendar} color="green" />
        <DetailKpi label="Clientes" value={tenant.clients_count} Icon={Users} color="luxury" />
        <DetailKpi label="Citas este mes" value={tenant.appointments_this_month} Icon={TrendingUp} color="sky" />
        <DetailKpi label="Ingresos históricos" value={formatCurrency(tenant.total_revenue)} Icon={DollarSign} color="gold" tabular />
      </div>

      {/* Control admin del límite de colaboradores (base Enterprise) */}
      <StaffLimitEditor userId={tenant.user_id} planLabel={tenant.plan_label} />

      <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border bg-vylta-card/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-vylta-gold" />
            <h3 className="text-sm font-bold text-vylta-bone">Últimas 10 citas</h3>
            <span className="rounded-full bg-vylta-card px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-vylta-muted">
              {tenant.recent_appointments.length}
            </span>
          </div>
          {tenant.appointments_paid > 0 && (
            <span className="text-[11px] text-vylta-muted">{tenant.appointments_paid} citas cobradas históricas</span>
          )}
        </div>

        {tenant.recent_appointments.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-vylta-subtle mb-3" />
            <p className="text-sm font-semibold text-vylta-muted">Sin citas registradas</p>
            <p className="text-xs text-vylta-subtle mt-1">Este negocio aún no ha creado citas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tenant.recent_appointments.map((apt) => {
              const style = getApptStatusStyle(apt.status);
              const dateObj = new Date(apt.date + 'T12:00:00');
              const dateShort = `${dateObj.getDate()} ${MONTHS_ES[dateObj.getMonth()].slice(0, 3)}`;
              return (
                <li key={apt.id} className="flex items-center gap-3 px-5 py-3 hover:bg-vylta-card/30 transition-colors">
                  <div className="flex flex-col items-center justify-center rounded-lg bg-vylta-card/60 px-3 py-2 tabular-nums border border-border">
                    <span className="text-sm font-bold leading-none text-vylta-bone">{apt.start_time?.slice(0, 5)}</span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-vylta-subtle">{dateShort}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-vylta-bone">{apt.client_name}</span>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: style.barColor }}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-vylta-muted">{apt.service_name}</div>
                  </div>
                  {apt.service_cost ? (
                    <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green">{formatCurrency(apt.service_cost)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DetailKpi({
  label, value, Icon, color, tabular,
}: {
  label: string;
  value: number | string;
  Icon: any;
  color: 'green' | 'luxury' | 'sky' | 'gold';
  tabular?: boolean;
}) {
  const colorMap = {
    green:  { text: 'text-vylta-green',  halo: '#10B981' },
    luxury: { text: 'text-vylta-luxury', halo: '#A78BFA' },
    sky:    { text: 'text-vylta-sky',    halo: '#0EA5E9' },
    gold:   { text: 'text-vylta-gold',   halo: '#F59E0B' },
  }[color];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-20" style={{ background: colorMap.halo }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</span>
          <Icon className={cn('h-4 w-4', colorMap.text)} />
        </div>
        <div className={cn('mt-3 text-2xl font-bold tracking-tightest', colorMap.text, tabular && 'tabular-nums')}>
          {value}
        </div>
      </div>
    </div>
  );
}
