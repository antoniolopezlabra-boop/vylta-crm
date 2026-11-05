import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUserServer } from '@/lib/admin-server';
import { createAdminClient } from '@/lib/supabase/admin';

// ══════════════════════════════════════════════════════════════════════
// POST /api/admin/reset-password — recuperación de acceso de un negocio
//
// Para el panel admin (/admin/tenants). El admin NUNCA ve ni fija la
// contraseña del usuario; solo dispara la recuperación estándar:
//   • mode "email": Supabase le manda al usuario el correo "Restablecer
//     contraseña" (mismo flujo que "¿Olvidaste tu contraseña?" de la app).
//   • mode "link":  genera el enlace de recuperación (sin enviar correo)
//     para que el admin se lo comparta por WhatsApp si el correo no llega.
//     El enlace es de un solo uso y caduca; solo super_admin.
// Ambos terminan en book.vylta.lat/reset.html, donde el usuario elige su
// contraseña nueva.
// ══════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIRECT_TO = 'https://book.vylta.lat/reset.html';

const BodySchema = z.object({
  user_id: z.string().uuid(),
  mode: z.enum(['email', 'link']),
});

function isSuperAdminRole(role: string): boolean {
  return (role || '').toLowerCase().replace(/_/g, '') === 'superadmin';
}

export async function POST(request: Request) {
  const caller = await getAdminUserServer();
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  if (body.mode === 'link' && !isSuperAdminRole(caller.role)) {
    return NextResponse.json(
      { error: 'Solo un super admin puede generar enlaces de recuperación' },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(body.user_id);
  const email = target?.user?.email;
  if (getErr || !email) {
    return NextResponse.json({ error: 'Usuario no encontrado o sin correo' }, { status: 404 });
  }

  console.info('[admin/reset-password]', { by: caller.user_id, target: body.user_id, mode: body.mode });

  if (body.mode === 'email') {
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO });
    if (error) {
      const rate = /rate|seconds|too many/i.test(error.message);
      return NextResponse.json(
        { error: rate ? 'Ya se envió un correo hace poco. Espera un minuto y reintenta.' : error.message },
        { status: rate ? 429 : 500 },
      );
    }
    return NextResponse.json({ ok: true, email });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT_TO },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    return NextResponse.json({ error: error?.message || 'No se pudo generar el enlace' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, email, link });
}
