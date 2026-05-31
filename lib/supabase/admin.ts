import 'server-only';
import { createClient } from '@supabase/supabase-js';

// ═════════════════════════════════════════════════════════════════════
// Cliente Supabase con SERVICE ROLE — SOLO server-side.
//
// 'server-only' hace que el build falle si alguien lo importa desde un
// Client Component. Este cliente USA la service_role key, que tiene
// permisos totales (bypassa RLS y accede a auth.admin), así que NUNCA
// debe llegar al navegador.
//
// Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (sin el
// prefijo NEXT_PUBLIC_ a propósito, para que nunca se bundle al cliente).
// ═════════════════════════════════════════════════════════════════════

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno',
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
