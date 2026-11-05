'use client';

import { useState } from 'react';
import { KeyRound, Mail, Link2, Wand2, Loader2, Copy, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// PasswordResetControl — recuperar el acceso de un negocio desde el panel.
//
// Tres vías: (1) contraseña temporal generada por el servidor (se muestra una
// vez para probar el acceso y pasársela al dueño; luego él la cambia en la app),
// (2) correo de "restablecer contraseña", (3) enlace de recuperación por WhatsApp.
// Backend: POST /api/admin/reset-password (service role, valida admin).
// ══════════════════════════════════════════════════════════════════════

interface Props {
  userId: string;
  businessName: string;
  email?: string | null;
  phone?: string | null;
  /** "icon" = botón compacto para la fila de la tabla; "button" = botón con texto. */
  variant?: 'icon' | 'button';
}

type Mode = 'email' | 'link' | 'temp';

export function PasswordResetControl({ userId, businessName, email, phone, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(mode: Mode) {
    setBusy(mode);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo completar');
      if (mode === 'email') {
        toast.success(`Correo enviado a ${data.email}`, {
          description: 'Le llega un enlace para crear su contraseña nueva (válido 1 hora).',
        });
        setOpen(false);
      } else if (mode === 'temp') {
        setTemp(data.password);
      } else {
        setLink(data.link);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  const shown = temp ?? link;

  async function copy() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  const waPhone = (phone || '').replace(/\D/g, '');
  const waNumber = waPhone.length === 10 ? `52${waPhone}` : waPhone;
  const waText = temp
    ? `Hola, ya quedó tu acceso a VYLTA (${businessName}).\nCorreo: ${email ?? ''}\nContraseña temporal: ${temp}\nCuando gustes la cambias en la app: Ajustes → Contraseña.`
    : link
      ? `Hola, te comparto el enlace para crear tu contraseña nueva de VYLTA (${businessName}). Es de un solo uso y vence en 1 hora:\n${link}`
      : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setLink(null);
          setTemp(null);
          setCopied(false);
        }
      }}
    >
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            title="Restablecer contraseña"
            aria-label={`Restablecer contraseña de ${businessName}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-vylta-subtle transition hover:bg-vylta-gold/10 hover:text-vylta-gold"
          >
            <KeyRound className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Restablecer contraseña
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-vylta-gold" />
            Restablecer contraseña
          </DialogTitle>
          <DialogDescription>
            <b className="text-vylta-bone">{businessName}</b>
            {email ? ` · ${email}` : ''}
          </DialogDescription>
        </DialogHeader>

        {!shown ? (
          <div className="flex flex-col gap-3 pt-1">
            <OptionButton
              Icon={Wand2}
              title="Generar contraseña temporal"
              desc="Reemplaza su contraseña actual por una nueva que ves aquí. Úsala para probar el acceso y pásasela; luego la cambia en la app."
              loading={busy === 'temp'}
              disabled={!!busy}
              onClick={() => run('temp')}
            />
            <OptionButton
              Icon={Mail}
              title="Enviarle el correo de recuperación"
              desc="Le llega un correo con un botón para crear su contraseña nueva."
              loading={busy === 'email'}
              disabled={!!busy}
              onClick={() => run('email')}
            />
            <OptionButton
              Icon={Link2}
              title="Generar enlace para mandarlo por WhatsApp"
              desc="Úsalo si el correo no le llega o cae en spam. Un solo uso, vence en 1 hora."
              loading={busy === 'link'}
              disabled={!!busy}
              onClick={() => run('link')}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            {temp ? (
              <div className="rounded-lg border border-vylta-gold/40 bg-vylta-gold/5 p-3">
                <div className="text-[11px] text-vylta-muted">Correo</div>
                <div className="text-sm font-semibold text-vylta-bone break-all">{email}</div>
                <div className="mt-2 text-[11px] text-vylta-muted">Contraseña temporal</div>
                <div className="font-mono text-lg font-bold tracking-wide text-vylta-gold select-all">{temp}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-vylta-card/40 p-3 text-[11px] text-vylta-muted break-all max-h-24 overflow-auto">
                {link}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : temp ? 'Copiar contraseña' : 'Copiar enlace'}
              </Button>
              {waNumber && (
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Abrir WhatsApp ({phone})
                  </a>
                </Button>
              )}
            </div>
            <p className="text-[11px] text-vylta-subtle">
              {temp
                ? 'Ya está activa: su contraseña anterior dejó de funcionar. Solo se muestra esta vez; cópiala antes de cerrar.'
                : 'Compártelo solo con el dueño del negocio: quien lo abra puede cambiar la contraseña.'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OptionButton({
  Icon, title, desc, loading, disabled, onClick,
}: {
  Icon: typeof Mail; title: string; desc: string; loading: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-vylta-card/30 p-3 text-left transition',
        'hover:border-vylta-gold/40 hover:bg-vylta-gold/5 disabled:opacity-60',
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vylta-gold/10 text-vylta-gold">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-bold text-vylta-bone">{title}</span>
        <span className="block text-[11px] text-vylta-muted">{desc}</span>
      </span>
    </button>
  );
}
