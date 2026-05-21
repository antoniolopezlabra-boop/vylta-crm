import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminUserServer } from '@/lib/admin-server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { RouteTransition } from '@/components/layout/route-transition';
import { QueryProvider } from '@/components/providers/query-provider';

// ═════════════════════════════════════════════════════════════════════
// Layout autenticado (App Shell) + QueryProvider de React Query
//
// CHECK ADMIN (Sprint A, Mayo 14 2026):
// Antes de renderizar el CRM, verifica si el user_id está en vylta_admins.
// Si lo está → redirect('/admin') para evitar que vea el dashboard de
// dueño de negocio. Esto replica el comportamiento de la app móvil
// donde antonio.lopez.labra@hotmail.com va directo al Control Center.
//
// NOTA: importamos getAdminUserServer desde admin-server.ts (no admin.ts)
// para evitar que cookies() se bundle al cliente.
//
// ⚡ FEATURE BRANDING DEL CLIENTE (May 19 2026):
// El sidebar muestra el LOGO + NOMBRE DEL NEGOCIO del cliente (no la
// marca VYLTA), para que sientan que el sistema es parte de su negocio.
// La marca VYLTA se mueve a un footer discreto del sidebar.
// Pasamos businessName + logoUrl al Sidebar para que los renderice.
//
// ⚡ BUG FIX (May 19 2026):
// La query original incluía 'owner_name' que NO existe en el schema
// real de business_profiles. Esto causaba que Supabase fallara
// silenciosamente y profile siempre fuera null, mostrando "Mi negocio"
// como fallback aunque el usuario SÍ tuviera negocio configurado.
//
// Schema real (confirmado en components/settings/tabs/business-tab.tsx):
//   business_name, business_type, address, phone, alternative_phone, logo_url
// NO existe: description, business_email, owner_name
// ═════════════════════════════════════════════════════════════════════

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

  // CHECK ADMIN — redirige al Control Center si el usuario es admin.
  // No usamos try/catch: si falla la consulta, mejor caer al CRM normal
  // que dejar al usuario sin acceso a nada.
  const adminUser = await getAdminUserServer();
  if (adminUser) {
    redirect('/admin');
  }

  // ⚡ Solo pedimos columnas que SÍ existen en el schema real.
  // Antes incluíamos 'owner_name' (no existe) y eso rompía toda la query.
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, logo_url')
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName =
    profile?.business_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Usuario';

  // Datos del branding para pasar al Sidebar
  const businessName = profile?.business_name || null;
  const logoUrl = profile?.logo_url || null;

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <RouteTransition />

        <Sidebar businessName={businessName} logoUrl={logoUrl} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            user={{
              email: user.email,
              displayName,
            }}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
