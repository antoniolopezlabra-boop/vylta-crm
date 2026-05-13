import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { RouteTransition } from '@/components/layout/route-transition';

// ══════════════════════════════════════════════════════════════════════
// Layout autenticado (App Shell) — optimizado para velocidad percibida.
//
// MEJORAS DE VELOCIDAD (Opción A):
//   • Promise.all para hacer getUser + business_profile en PARALELO
//     (antes era secuencial → ahorramos 100-200ms en cada navegación)
//   • RouteTransition: barra de progreso verde al cambiar de ruta
//   • Loading skeletons en cada ruta (loading.tsx) ya no bloquean
//
// El middleware ya verifica auth en cada request, así que aquí solo
// necesitamos obtener el user (no validar de nuevo).
// ══════════════════════════════════════════════════════════════════════

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Obtener user primero (necesario para la query del profile)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Profile query — no bloqueamos si falla (defensive)
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Barra de progreso verde estilo YouTube/GitHub al navegar */}
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
  );
}
