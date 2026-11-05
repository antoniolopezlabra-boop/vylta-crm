'use client';

import { useState } from 'react';
import { KeyRound, Mail, Link2, Loader2, Copy, Check, MessageCircle } from 'lucide-react';
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
// El admin no ve ni escribe contraseñas: o se le manda al usuario el correo
// de "restablecer contraseña", o se genera el enlace de recuperación para
// compartirlo por WhatsApp (si el correo no llega / cae en spam).
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

export function PasswordResetControl({ userId, businessName, email, phone, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'email' | 'link' | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(mode: 'email' | 'link') {
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
      } else {
        setLink(data.link);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  const waPhone = (phone || '').replace(/\D/g, '');
  const waNumber = waPhone.length === 10 ? `52${waPhone}` : waPhone;
  const waText = link
    ? `Hola, te comparto el enlace para crear tu contraseña nueva de VYLTA (${businessName}). Es de un solo uso y vence en 1 hora:\n${link}`
    : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setLink(null);
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
            {email ? ` · ${email}` : ''}. El usuario elige su contraseña nueva; tú nunca la ves.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="flex flex-col gap-3 pt-1">
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
            <div className="rounded-lg border border-border bg-vylta-card/40 p-3 text-[11px] text-vylta-muted break-all max-h-24 overflow-auto">
              {link}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar enlace'}
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
              Compártelo solo con el dueño del negocio: quien lo abra puede cambiar la contraseña.
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
