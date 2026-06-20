import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminUserServer } from '@/lib/admin-server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { RouteTransition } from '@/components/layout/route-transition';
import { QueryProvider } from '@/components/providers/query-provider';
import { SessionTracker } from '@/components/session-tracker';
import { MobileNavProvider } from '@/components/layout/mobile-nav-context';

// Layout autenticado (App Shell) + React Query.
//  - Si el user es admin (vylta_admins) -> redirect /admin.
//  - Si el user es embajador (embajadores.user_id) -> redirect /embajador.
//  - El Sidebar muestra el branding del negocio (logo + nombre), no la marca VYLTA.
// IMPORTANTE: business_profiles NO tiene owner_name/description/business_email.
//   Pedir SOLO columnas reales (business_name, logo_url) o la query falla en silencio.
// SessionTracker registra la ultima conexion del dueno (igual que la app movil).

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Admin -> Control Center.
  const adminUser = await getAdminUserServer();
  if (adminUser) {
    redirect('/admin');
  }

  // Embajador? y perfil de negocio? Necesito ambos para decidir el routing
  // de las cuentas DUALES (un negocio que tambien es embajador).
  const { data: embajador } = await supabase
    .from('embajadores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Solo columnas que existen en el schema real (owner_name NO existe -> rompia la query).
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, logo_url')
    .eq('user_id', user.id)
    .maybeSingle();

  // Embajador PURO (sin negocio) -> directo a su portal.
  // Cuenta DUAL (negocio + embajador) -> se queda en su negocio y entra al
  //   portal de embajador por el switcher del sidebar (no lo expulsamos).
  if (embajador && !profile) {
    redirect('/embajador');
  }

  const isAmbassador = !!embajador;

  const displayName =
    profile?.business_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Usuario';

  const businessName = profile?.business_name || null;
  const logoUrl = profile?.logo_url || null;

  return (
    <QueryProvider>
      <SessionTracker userId={user.id} />

      <MobileNavProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <RouteTransition />

          <Sidebar businessName={businessName} logoUrl={logoUrl} isAmbassador={isAmbassador} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar
              user={{
                email: user.email,
                displayName,
              }}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 md:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </MobileNavProvider>
    </QueryProvider>
  );
}
