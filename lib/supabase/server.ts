import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase para Server Components y Route Handlers.
 *
 * Lee/escribe cookies a través de la API de Next.js para mantener la sesión
 * sincronizada entre cliente y servidor.
 *
 * NOTA: Tiene que ser async porque cookies() en Next 15 es async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll() llamado desde Server Component → ignorar
            // si hay middleware refrescando sesiones.
          }
        },
      },
    },
  );
}
