import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QueryProvider } from '@/components/providers/query-provider';
import { EmbajadorTopbar } from '@/components/embajador/embajador-topbar';

// Layout del portal del embajador.
// Candado: solo entran embajadores con cuenta vinculada
// (embajadores.user_id = auth.uid()). Cualquier otro usuario se va a /dashboard
// (el layout de negocios a su vez manda a los admins a /admin).
export default async function EmbajadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: emb } = await supabase
    .from('embajadores')
    .select('id, nombre')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!emb) {
    redirect('/dashboard');
  }

  return (
    <QueryProvider>
      <div className="flex min-h-screen flex-col bg-vylta-admin-bg">
        <EmbajadorTopbar nombre={emb.nombre} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1100px] p-5 md:p-8">{children}</div>
        </main>
      </div>
    </QueryProvider>
  );
}
