'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// ══════════════════════════════════════════════════════════════════════
// Asistentes en el CRM (nov 2026): solo Citas y Clientes.
// Sin reportes de ventas, equipo, servicios, marketing, configuración ni
// "eliminar cuenta". Cualquier otra ruta → /citas.
// (Defensa de interfaz; los datos los protegen RLS + getActingUser: las
// pantallas no permitidas consultan con el id propio de la asistente y
// salen vacías.)
// ══════════════════════════════════════════════════════════════════════

export const ASSISTANT_ALLOWED = ['/citas', '/clientes'];
const BLOCKED = ['/clientes/import'];

export function isAssistantAllowed(pathname: string): boolean {
  if (BLOCKED.some(p => pathname.startsWith(p))) return false;
  return ASSISTANT_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function AssistantGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = isAssistantAllowed(pathname);

  useEffect(() => {
    if (!allowed) router.replace('/citas');
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
