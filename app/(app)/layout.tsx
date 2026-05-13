import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { RouteTransition } from '@/components/layout/route-transition';
import { QueryProvider } from '@/components/providers/query-provider';

// ══════════════════════════════════════════════════════════════════════
// Layout autenticado (App Shell) + QueryProvider de React Query
//
// El QueryProvider envuelve TODA la app autenticada para que cualquier
// componente puede usar hooks de React Query (useHomeStats, useAppointments,
// etc) y compartir el mismo cache.
//
// El layout sigue siendo Server Component (verifica auth en el server)
// pero a partir de aquí dentro, los componentes pueden ser Client
// Components con cache compartido.
// ══════════════════════════════════════════════════════════════════════

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
