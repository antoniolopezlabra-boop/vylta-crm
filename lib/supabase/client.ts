import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para componentes del LADO CLIENTE ('use client').
 *
 * Lee las credenciales de NEXT_PUBLIC_* (visibles al cliente, eso está bien
 * con anon key porque la seguridad real vive en Row Level Security en DB).
 *
 * Maneja sesión persistente via cookies (lo que permite que el usuario
 * permanezca logueado al recargar la página).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
