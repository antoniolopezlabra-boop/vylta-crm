import { redirect } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SoloAppSignOut } from './sign-out-button';

// ══════════════════════════════════════════════════════════════════════
// /solo-app (nov 2026)
// Las cuentas de COLABORADOR y ASISTENTE (staff_accounts) solo funcionan en
// la app móvil VYLTA. El CRM web es del dueño del negocio: aquí están los
// reportes de ventas, el equipo, la configuración y "eliminar cuenta".
// (app)/layout y /setup redirigen aquí a cualquier cuenta de colaborador.
// ══════════════════════════════════════════════════════════════════════

export default async function SoloAppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-vylta-green-500/10">
          <Smartphone className="h-6 w-6 text-vylta-green-600" />
        </div>
        <h1 className="text-lg font-bold">Tu acceso es para la app VYLTA</h1>
        <p className="text-sm text-muted-foreground">
          Las cuentas de colaborador se usan desde la app VYLTA en tu celular
          (Android o iPhone). El panel web es solo para el dueño del negocio.
        </p>
        <SoloAppSignOut />
      </div>
    </div>
  );
}
