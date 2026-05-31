import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUserServer } from '@/lib/admin-server';
import { createAdminClient } from '@/lib/supabase/admin';

// ═════════════════════════════════════════════════════════════════════
// POST /api/admin/create — Crear / invitar un nuevo administrador
//
// Flujo seguro:
//   1. Verifica que quien llama sea super_admin ACTIVO (sesión real).
//      Acepta el rol como 'super_admin' o 'superadmin' (la app móvil usa
//      la segunda forma; normalizamos igual que en la UI).
//   2. Valida el body con zod.
//   3. Resuelve el usuario de auth:
//        • Si NO existe  → lo crea e invita por correo (Resend SMTP).
//        • Si YA existe  → recupera su user_id (sin enviar correo).
//   4. Lo inserta en vylta_admins (o reactiva si estaba inactivo).
//
// La service_role key vive solo aquí (server). Nunca se expone al browser.
// ══════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform((e) => e.trim().toLowerCase()),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  role: z.enum(['admin', 'super_admin']).default('admin'),
});

/**
 * Normaliza el rol: acepta 'super_admin' y 'superadmin' como super admin.
 * (La app móvil guarda 'superadmin' sin guion bajo.)
 */
function isSuperAdminRole(role: string): boolean {
  return (role || '').toLowerCase().replace(/_/g, '') === 'superadmin';
}

/**
 * Busca el user_id de un usuario existente por email, sin efectos
 * secundarios (no envía correos). Pagina listUsers hasta encontrarlo.
 * A escala beta (miles de usuarios) es más que suficiente.
 */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => (u.email || '').toLowerCase() === email,
    );
    if (match) return match.id;
    if (data.users.length < perPage) break; // última página
  }
  return null;
}

export async function POST(request: Request) {
  // 1) Autorización: super_admin activo (acepta ambas formas del rol)
  const caller = await getAdminUserServer();
  if (!caller) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isSuperAdminRole(caller.role)) {
    return NextResponse.json(
      { error: 'Solo un super admin puede crear administradores' },
      { status: 403 },
    );
  }

  // 2) Validación
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { email, name, role } = body;

  const admin = createAdminClient();

  // 3) Resolver / crear el usuario de auth
  let userId: string | null = null;
  let emailed = false;

  const origin = new URL(request.url).origin;
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || origin}/login`;

  const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (invite.data?.user) {
    // Usuario nuevo → creado + correo de invitación enviado
    userId = invite.data.user.id;
    emailed = true;
  } else {
    const msg = invite.error?.message || '';
    const alreadyExists =
      invite.error?.status === 422 || /already|registered|exists/i.test(msg);

    if (alreadyExists) {
      // Ya tenía cuenta → solo recuperamos su id, sin enviar correo
      try {
        userId = await findUserIdByEmail(admin, email);
      } catch (e) {
        console.error('[admin/create] listUsers error', e);
      }
      if (!userId) {
        return NextResponse.json(
          { error: 'No se pudo localizar la cuenta existente' },
          { status: 500 },
        );
      }
    } else {
      console.error('[admin/create] invite error', invite.error);
      return NextResponse.json(
        { error: msg || 'No se pudo crear el usuario' },
        { status: 500 },
      );
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'No se pudo resolver el usuario' },
      { status: 500 },
    );
  }

  // 4) Insertar / reactivar en vylta_admins
  const { data: existing } = await admin
    .from('vylta_admins')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json(
        { status: 'already_admin', email },
        { status: 200 },
      );
    }
    const { error: updErr } = await admin
      .from('vylta_admins')
      .update({ is_active: true, name, email, role })
      .eq('id', existing.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ status: 'reactivated', email }, { status: 200 });
  }

  const { error: insErr } = await admin.from('vylta_admins').insert({
    user_id: userId,
    email,
    name,
    role,
    is_active: true,
  });
  if (insErr) {
    console.error('[admin/create] insert error', insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { status: emailed ? 'invited' : 'promoted', email },
    { status: 200 },
  );
}
