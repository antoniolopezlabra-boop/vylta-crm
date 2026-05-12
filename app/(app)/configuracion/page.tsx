import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CreditCard,
  MessageCircle,
  Link2,
  LogOut,
  ArrowRight,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// /configuracion — Settings del negocio + plan
//
// Server Component que carga el perfil del negocio + plan activo.
// Por ahora es una vista de SOLO LECTURA: mostramos toda la información
// pero la edición se hace en la app móvil (deep-link). En siguientes
// iteraciones podemos agregar formularios editables aquí también.
// ══════════════════════════════════════════════════════════════════════

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // El plan se identifica por la tabla user_plans (mismo schema que móvil)
  const { data: planData } = await supabase
    .from('user_plans')
    .select('plan_name, status, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  const planLabel = getPlanLabel(planData?.plan_name);
  const slug = profile?.slug || 'tu-negocio';
  const bookingUrl = `https://book.vylta.lat/${slug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra tu negocio, plan y configuraciones de cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Mi negocio */}
        <SettingsCard
          icon={Building2}
          title="Mi negocio"
          description="Datos básicos visibles para tus clientes."
        >
          <DataRow label="Nombre del negocio" value={profile?.business_name || '—'} />
          <DataRow label="Propietario" value={profile?.owner_name || '—'} />
          <DataRow icon={Mail} label="Email" value={user.email || '—'} />
          {profile?.phone && <DataRow icon={Phone} label="Teléfono" value={profile.phone} />}
          {profile?.address && <DataRow icon={MapPin} label="Dirección" value={profile.address} />}
        </SettingsCard>

        {/* Plan */}
        <SettingsCard
          icon={Sparkles}
          title="Plan activo"
          description="Tu suscripción actual de VYLTA."
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{planLabel.name}</span>
                <span className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                  planLabel.badgeClass,
                )}>
                  {planLabel.tier}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{planLabel.description}</p>
            </div>
            <span className="text-2xl font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
              {planLabel.price}
            </span>
          </div>

          {planData?.current_period_end && (
            <div className="mt-3 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Renovación: {new Date(planData.current_period_end).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </div>
          )}

          {(!planData || planData.plan_name === 'Gratuito') && (
            <Link
              href="https://vylta.lat#pricing"
              target="_blank"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-vylta-green-500 to-vylta-green-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-vylta-green-500/25 transition hover:shadow-lg hover:shadow-vylta-green-500/30"
            >
              Ver planes Premium y Luxury
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </SettingsCard>

        {/* Link público */}
        <SettingsCard
          icon={Link2}
          title="Tu link público de citas"
          description="Compártelo en Instagram, WhatsApp, Google Maps."
        >
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div className="truncate font-mono text-xs text-foreground">{bookingUrl}</div>
          </div>
          <Link
            href={bookingUrl}
            target="_blank"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400"
          >
            Abrir mi página de reservas
            <ExternalLink className="h-3 w-3" />
          </Link>
        </SettingsCard>

        {/* WhatsApp Business */}
        <SettingsCard
          icon={MessageCircle}
          title="WhatsApp Business"
          description="Recordatorios automáticos para tus clientes."
        >
          {planData?.plan_name === 'Basico' || planData?.plan_name === 'Premium' ? (
            <div className="flex items-center gap-2 rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 px-3 py-2 text-sm">
              <Shield className="h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" />
              <span className="font-semibold text-vylta-green-700 dark:text-vylta-green-400">
                WhatsApp activo
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Confirmación + 24 h + 2 h antes
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Disponible en planes Premium y Luxury
            </div>
          )}
        </SettingsCard>

        {/* Pagos (solo si tiene plan pagado) */}
        {(planData?.plan_name === 'Basico' || planData?.plan_name === 'Premium') && (
          <SettingsCard
            icon={CreditCard}
            title="Pagos"
            description="Administra tu método de pago y facturas."
          >
            <Link
              href="https://billing.stripe.com/p/login/test_xxx"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
            >
              Abrir Portal de Pagos
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Cambia tu tarjeta, descarga facturas o cancela tu suscripción.
            </p>
          </SettingsCard>
        )}
      </div>

      {/* Footer con info de cuenta */}
      <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
        <div>
          ID de usuario: <span className="font-mono">{user.id}</span>
        </div>
        <div>
          Cuenta creada: {new Date(user.created_at).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ──

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/10 text-vylta-green-600 dark:text-vylta-green-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function DataRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: any;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

// ── Helper para mapear el nombre interno del plan a etiquetas amigables ──
function getPlanLabel(planName?: string | null) {
  switch (planName) {
    case 'Basico':
      return {
        name: 'Premium',
        tier: 'PREMIUM',
        description: 'Citas ilimitadas + WhatsApp automático',
        price: '$399',
        badgeClass: 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400',
      };
    case 'Premium':
      return {
        name: 'Luxury',
        tier: 'LUXURY',
        description: 'Todo Premium + Equipo + Marketing',
        price: '$799',
        badgeClass: 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400',
      };
    case 'Gratuito':
    default:
      return {
        name: 'Básico',
        tier: 'GRATIS',
        description: 'Hasta 10 citas al mes',
        price: '$0',
        badgeClass: 'bg-secondary text-muted-foreground',
      };
  }
}
