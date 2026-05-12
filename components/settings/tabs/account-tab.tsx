'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, LogOut, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';

interface Props {
  email: string;
  userId: string;
}

export function AccountTab({ email, userId }: Props) {
  const router = useRouter();
  const [pwd, setPwd] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function changePassword() {
    if (pwd.next.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setSaving(false);
    if (error) {
      toast.error('No pudimos cambiar tu contraseña: ' + error.message);
      return;
    }
    setPwd({ next: '', confirm: '' });
    toast.success('Contraseña actualizada');
  }

  async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Hasta pronto 👋');
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={Mail} title="Tu cuenta" description="Datos de acceso a VYLTA.">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Email</Label>
          <Input value={email} disabled />
          <p className="text-[11px] text-muted-foreground">
            Para cambiar tu email, contacta a soporte.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard icon={Lock} title="Cambiar contraseña" description="Elige una contraseña fuerte (mínimo 8 caracteres).">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nueva contraseña</Label>
            <Input type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Confirmar nueva contraseña</Label>
            <Input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Vuelve a escribir tu contraseña" />
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Cambiar contraseña</>}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={LogOut} title="Sesión" description="Cierra tu sesión en este navegador.">
        <Button variant="outline" onClick={logout} disabled={loggingOut}>
          {loggingOut ? <><Loader2 className="h-4 w-4 animate-spin" /> Cerrando...</> : <><LogOut className="h-4 w-4" /> Cerrar sesión</>}
        </Button>
      </SettingsCard>

      <SettingsCard
        icon={Trash2}
        title="Zona de peligro"
        description="Estas acciones son permanentes e irreversibles."
      >
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">
            ⚠️ Para eliminar tu cuenta permanentemente, contacta a soporte en <strong>hola@vylta.lat</strong>.
          </p>
        </div>
      </SettingsCard>

      <p className="text-[11px] text-muted-foreground">
        ID de usuario: <span className="font-mono">{userId}</span>
      </p>
    </div>
  );
}
