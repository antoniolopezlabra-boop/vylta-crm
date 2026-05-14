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

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, owner_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName =
    profile?.business_name ||
    profile?.owner_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Usuario';

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <RouteTransition />

        <Sidebar />
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
