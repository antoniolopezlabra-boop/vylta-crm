'use client';

import { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  Mail,
  KeyRound,
  Copy,
  ShieldOff,
  AlertTriangle,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createStaffAccount, deleteStaffAccount } from '@/lib/staff';

// ══════════════════════════════════════════════════════════════════════
// StaffAccessSection — gestión de acceso a la app móvil del colaborador.
//
// Se renderiza DENTRO del StaffFormDialog cuando se está editando un
// colaborador existente (no aplica al crear porque aún no hay ID).
//
// COMPORTAMIENTO:
//   ┌────────────────────────────────────────────────────────────┐
//   │ Sin cuenta:                                                │
//   │   • Card gris con icono no-accounts                        │
//   │   • Texto "Sin acceso a la app"                            │
//   │   • Botón "Crear acceso" → abre modal crear                │
//   └────────────────────────────────────────────────────────────┘
//   ┌────────────────────────────────────────────────────────────┐
//   │ Con cuenta:                                                │
//   │   • Card verde con icono check-circle                      │
//   │   • Texto "Acceso activo"                                  │
//   │   • Botón "Revocar acceso" → confirm + delete              │
//   └────────────────────────────────────────────────────────────┘
//
// MODALES:
//   1. Modal "Crear acceso" — pide email + password, invoca Edge Function
//   2. Modal "Credenciales creadas" — muestra creds (single-shot) +
//      botones Copiar y Compartir por WhatsApp
//
// SEGURIDAD UX:
//   • Las credenciales NUNCA se persisten en localStorage ni se logean
//   • Solo viven en state durante el modal post-creación
//   • Al cerrar el modal, se limpian del state
//   • Warning visible: "Esta es la única vez que verás la contraseña"
// ══════════════════════════════════════════════════════════════════════

interface Props {
  staffMemberId: string;
  staffName: string;
  hasAccount: boolean;
  /** Callback para que el padre refresque el estado tras crear/revocar */
  onChanged: () => void;
}

export function StaffAccessSection({ staffMemberId, staffName, hasAccount, onChanged }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // State para el modal de credenciales (se llena tras éxito en createStaffAccount)
  const [createdEmail, setCreatedEmail] = useState('');
  const [createdPassword, setCreatedPassword] = useState('');

  async function handleRevoke() {
    const confirmed = confirm(
      `¿Revocar el acceso a la app de ${staffName}?\n\n` +
      `El colaborador ya no podrá iniciar sesión en la app móvil. Sus citas históricas no se verán afectadas.`,
    );
    if (!confirmed) return;

    setRevoking(true);
    try {
      await deleteStaffAccount(staffMemberId);
      toast.success('Acceso revocado');
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'No pudimos revocar el acceso');
    } finally {
      setRevoking(false);
    }
  }

  function handleAccountCreated(email: string, password: string) {
    setCreatedEmail(email);
    setCreatedPassword(password);
    setCreateOpen(false);
    setCredsOpen(true);
    onChanged();
  }

  function handleCloseCreds() {
    setCredsOpen(false);
    // Limpiar las credenciales del state por seguridad
    setCreatedEmail('');
    setCreatedPassword('');
  }

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs font-semibold">
          <Smartphone className="h-3 w-3 text-muted-foreground" />
          Acceso a la app móvil
        </Label>

        {hasAccount ? (
          // ── Con cuenta ──
          <div className="space-y-3 rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="text-sm font-bold text-vylta-green-700 dark:text-vylta-green-400">
                  Acceso activo
                </div>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  {staffName} puede iniciar sesión en la app móvil de VYLTA con sus credenciales.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRevoke}
              disabled={revoking}
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              {revoking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Revocando...
                </>
              ) : (
                <>
                  <ShieldOff className="h-3.5 w-3.5" />
                  Revocar acceso
                </>
              )}
            </Button>
          </div>
        ) : (
          // ── Sin cuenta ──
          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <XCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="text-sm font-bold">Sin acceso a la app</div>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  Crea un acceso para que {staffName} pueda iniciar sesión en la app móvil y ver sus citas asignadas.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="w-full"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Crear acceso
            </Button>
          </div>
        )}
      </div>

      <CreateAccessDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        staffMemberId={staffMemberId}
        staffName={staffName}
        onCreated={handleAccountCreated}
      />

      <CredentialsDialog
        open={credsOpen}
        onOpenChange={(open) => { if (!open) handleCloseCreds(); }}
        email={createdEmail}
        password={createdPassword}
        staffName={staffName}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Modal: Crear acceso (pide email + password)
// ══════════════════════════════════════════════════════════════════════

function CreateAccessDialog({
  open,
  onOpenChange,
  staffMemberId,
  staffName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMemberId: string;
  staffName: string;
  onCreated: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setEmail('');
    setPassword('');
    setSubmitting(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await createStaffAccount({
        staffMemberId,
        email,
        password,
      });
      reset();
      onCreated(result.email, result.password);
    } catch (err: any) {
      // No reset — el usuario puede querer corregir el email/password
      toast.error(err?.message || 'No pudimos crear el acceso');
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length >= 8 && !submitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear acceso a la app</DialogTitle>
          <DialogDescription>
            Define las credenciales temporales que usará {staffName} para iniciar sesión en la app móvil de VYLTA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Mail className="h-3 w-3 text-muted-foreground" />
              Correo electrónico <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@ejemplo.com"
              autoComplete="off"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <KeyRound className="h-3 w-3 text-muted-foreground" />
              Contraseña temporal <span className="text-destructive">*</span>
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              disabled={submitting}
            />
            <p className={cn(
              'text-[11px]',
              password.length > 0 && password.length < 8 ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {password.length === 0
                ? 'Mínimo 8 caracteres. Podrás compartirla por WhatsApp.'
                : password.length < 8
                ? `${password.length}/8 caracteres mínimos`
                : '✓ Cumple los requisitos'}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-vylta-amber-500/5 border border-vylta-amber-500/30 p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-vylta-amber-700 dark:text-amber-400 mt-0.5" />
            <p className="text-[11px] text-vylta-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Importante:</strong> Esta contraseña solo se mostrará una vez. Asegúrate de compartirla con {staffName} inmediatamente después de crearla.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Crear acceso
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Modal: Credenciales creadas (mostrar single-shot + copiar/compartir)
// ══════════════════════════════════════════════════════════════════════

function CredentialsDialog({
  open,
  onOpenChange,
  email,
  password,
  staffName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  staffName: string;
}) {
  function buildShareText(): string {
    return (
      `Hola ${staffName}! Tu cuenta para VYLTA ya está lista 🎉\n\n` +
      `Descarga la app VYLTA desde Google Play y entra con estos datos:\n\n` +
      `📧 Email: ${email}\n` +
      `🔑 Contraseña: ${password}\n\n` +
      `Después de iniciar sesión podrás cambiar tu contraseña desde la configuración de tu perfil.`
    );
  }

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast.success('Credenciales copiadas al portapapeles');
    } catch {
      toast.error('No pudimos copiar. Cópialas manualmente.');
    }
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copiado');
    } catch {
      // silencioso
    }
  }

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Contraseña copiada');
    } catch {
      // silencioso
    }
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(buildShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-vylta-green-500/15">
            <PartyPopper className="h-6 w-6 text-vylta-green-700 dark:text-vylta-green-400" />
          </div>
          <DialogTitle className="text-center">¡Acceso creado!</DialogTitle>
          <DialogDescription className="text-center">
            Comparte estas credenciales con {staffName} para que pueda iniciar sesión en la app móvil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Card con credenciales */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <CredField
              label="Email"
              icon={Mail}
              value={email}
              onCopy={handleCopyEmail}
              mono
            />
            <div className="h-px bg-border" />
            <CredField
              label="Contraseña temporal"
              icon={KeyRound}
              value={password}
              onCopy={handleCopyPassword}
              mono
            />
          </div>

          {/* Warning seguridad */}
          <div className="flex items-start gap-2 rounded-md bg-vylta-amber-500/5 border border-vylta-amber-500/30 p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-vylta-amber-700 dark:text-amber-400 mt-0.5" />
            <p className="text-[11px] text-vylta-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Esta es la única vez que verás la contraseña.</strong> Cópiala o compártela ahora — después no podrás recuperarla, solo crear una nueva.
            </p>
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar todo
            </Button>
            <Button
              size="sm"
              onClick={handleShareWhatsApp}
              className="bg-[#25D366] text-white hover:bg-[#1FB554]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375c-.99-1.575-1.516-3.39-1.516-5.26 0-5.445 4.455-9.885 9.942-9.885 2.654 0 5.145 1.035 7.021 2.91 1.875 1.859 2.909 4.35 2.909 6.99-.004 5.444-4.46 9.885-9.935 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411"/>
              </svg>
              Compartir por WhatsApp
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredField({
  label,
  icon: Icon,
  value,
  onCopy,
  mono,
}: {
  label: string;
  icon: any;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex-1 truncate text-sm font-semibold',
          mono && 'font-mono',
        )}>
          {value}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary/50 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
