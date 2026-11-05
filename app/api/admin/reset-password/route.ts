import { randomInt } from 'node:crypto';
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
//   • mode "temp":  fija una contraseña temporal generada aquí (nunca la
//     escribe el admin) y la devuelve UNA vez para compartirla con el dueño.
//     También confirma el correo. El usuario la cambia luego desde la app
//     (Ajustes → Contraseña). Solo super_admin.
// Ambos terminan en book.vylta.lat/reset.html, donde el usuario elige su
// contraseña nueva.
// ══════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIRECT_TO = 'https://book.vylta.lat/reset.html';

const BodySchema = z.object({
  user_id: z.string().uuid(),
  mode: z.enum(['email', 'link', 'temp']),
});

// Sin caracteres ambiguos (0/O, 1/I/l). Formato: Vylta-ABCD-1234
function tempPassword(): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const D = '23456789';
  const pick = (a: string, n: number) => Array.from({ length: n }, () => a[randomInt(a.length)]).join('');
  return `Vylta-${pick(L, 4)}-${pick(D, 4)}`;
}

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

  if (body.mode !== 'email' && !isSuperAdminRole(caller.role)) {
    return NextResponse.json(
      { error: 'Solo un super admin puede hacer esto' },
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

  if (body.mode === 'temp') {
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error('[admin/reset-password] temp', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, email, password });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT_TO },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    console.error('[admin/reset-password] link', error?.message);
    return NextResponse.json({ error: error?.message || 'No se pudo generar el enlace' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, email, link });
}
