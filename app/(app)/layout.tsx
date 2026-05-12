import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

// ══════════════════════════════════════════════════════════════════════
// Layout autenticado (App Shell del CRM)
//
// Este layout envuelve todas las rutas autenticadas:
//   /dashboard, /citas, /clientes, /servicios, /reportes, /marketing,
//   /equipo, /chat-ia, /configuracion
//
// Hace 3 cosas:
//   1. Verifica sesión en server (redirect a /login si no hay)
//   2. Carga perfil del negocio una sola vez y lo pasa al topbar
//   3. Renderiza el shell: sidebar + topbar + contenido
//
// El (app) entre paréntesis es un "route group" de Next.js — agrupa rutas
// que comparten layout sin afectar la URL final. Ej: /dashboard sigue siendo
// /dashboard, no /(app)/dashboard.
// ══════════════════════════════════════════════════════════════════════

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Verificar sesión (defensa en profundidad — el middleware ya redirige)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Cargar perfil del negocio (mismo schema que la app móvil)
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, owner_name')
    .eq('user_id', user.id)
    .maybeSingle();

  // Nombre a mostrar: negocio → owner → metadata → email
  const displayName =
    profile?.business_name ||
    profile?.owner_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Usuario';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
