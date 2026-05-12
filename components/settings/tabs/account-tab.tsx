'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock, Mail, LogOut, Trash2, Loader2, Save, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  email: string;
  userId: string;
}

// ══════════════════════════════════════════════════════════════════════
// AccountTab — Datos de cuenta, cambio de contraseña, sesión y zona
// de peligro (eliminar cuenta).
//
// ELIMINAR CUENTA:
//   Usa la misma RPC 'delete_user_account' que la app móvil. Esa función
//   PostgreSQL (security definer) borra cascada todos los datos del
//   usuario y al final cierra sesión.
//
//   Doble confirmación obligatoria:
//     1. Modal con descripción de qué se borra
//     2. El usuario debe escribir "ELIMINAR" literalmente para activar
//        el botón final
// ══════════════════════════════════════════════════════════════════════

const CONFIRMATION_PHRASE = 'ELIMINAR';

export function AccountTab({ email, userId }: Props) {
  const router = useRouter();
  const [pwd, setPwd] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  async function deleteAccount() {
    if (deleteText.trim().toUpperCase() !== CONFIRMATION_PHRASE) {
      toast.error(`Escribe "${CONFIRMATION_PHRASE}" para confirmar`);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    try {
      // Misma RPC que usa la app móvil — función PostgreSQL security
      // definer que borra en cascada todos los datos del usuario.
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      // Cerrar sesión local. La RPC ya invalidó el usuario en BD.
      await supabase.auth.signOut();

      toast.success('Cuenta eliminada. Hasta pronto.');
      // Redirige a login. router.refresh para limpiar caché.
      router.push('/login');
      router.refresh();
    } catch (err: any) {
      console.error('[deleteAccount] Error:', err);
      toast.error('No pudimos eliminar la cuenta: ' + (err.message || 'Error desconocido'));
      setDeleting(false);
    }
  }

  function openDeleteModal() {
    setDeleteText('');
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) return; // no permitir cerrar mientras borra
    setDeleteOpen(false);
    setDeleteText('');
  }

  const deleteEnabled = deleteText.trim().toUpperCase() === CONFIRMATION_PHRASE;

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
            <Input
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Confirmar nueva contraseña</Label>
            <Input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="Vuelve a escribir tu contraseña"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="h-4 w-4" /> Cambiar contraseña</>
              )}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={LogOut} title="Sesión" description="Cierra tu sesión en este navegador.">
        <Button variant="outline" onClick={logout} disabled={loggingOut}>
          {loggingOut ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Cerrando...</>
          ) : (
            <><LogOut className="h-4 w-4" /> Cerrar sesión</>
          )}
        </Button>
      </SettingsCard>

      {/* Zona de peligro */}
      <SettingsCard
        icon={Trash2}
        title="Zona de peligro"
        description="Estas acciones son permanentes e irreversibles."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-destructive">
                  Eliminar tu cuenta borrará permanentemente:
                </p>
                <ul className="space-y-0.5 text-[11px] text-destructive/90">
                  <li>• Todas tus citas (pasadas y futuras)</li>
                  <li>• Tu base de clientes completa</li>
                  <li>• Servicios, colaboradores y bloqueos de tiempo</li>
                  <li>• Configuración del negocio (logo, horarios, etc.)</li>
                  <li>• Tu suscripción (no se reembolsará automáticamente)</li>
                  <li>• Historial de campañas y recordatorios de cumpleaños</li>
                </ul>
                <p className="pt-1 text-[11px] font-semibold text-destructive">
                  Esta acción es <span className="underline">inmediata e irreversible</span>.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={openDeleteModal}
            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar mi cuenta
          </Button>
        </div>
      </SettingsCard>

      <p className="text-[11px] text-muted-foreground">
        ID de usuario: <span className="font-mono">{userId}</span>
      </p>

      {/* Modal de confirmación final */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && closeDeleteModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar tu cuenta?
            </DialogTitle>
            <DialogDescription>
              Vas a borrar permanentemente toda tu información de VYLTA. Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-destructive">
                Para confirmar, escribe la palabra <strong className="font-mono">{CONFIRMATION_PHRASE}</strong> en
                el siguiente campo.
              </p>
            </div>
            <Input
              autoFocus
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              className="font-mono"
              disabled={deleting}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={deleteAccount}
              disabled={!deleteEnabled || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Sí, eliminar todo</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
