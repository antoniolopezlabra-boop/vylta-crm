'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Link2, Copy, ExternalLink, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';
import { cn } from '@/lib/utils';

interface Props {
  userId: string;
  bookingLink: { is_active?: boolean | null; slug?: string | null } | null;
  isPremium: boolean;
}

export function BookingLinkTab({ userId, bookingLink, isPremium }: Props) {
  const [isActive, setIsActive] = useState(bookingLink?.is_active === true);
  const [saving, setSaving] = useState(false);
  const slug = bookingLink?.slug || 'tu-negocio';
  const url = `https://book.vylta.lat/${slug}`;

  if (!isPremium) {
    return (
      <SettingsCard icon={Lock} title="Link público de citas" description="Disponible en planes Premium y Luxury." badge={<span className="rounded-md bg-vylta-green-500/15 px-2 py-0.5 text-[10px] font-bold text-vylta-green-700 dark:text-vylta-green-400">PREMIUM</span>}>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">
            Activa Premium para que tus clientes agenden citas desde Instagram, WhatsApp y Google Maps con un solo link.
          </p>
          <Link
            href="https://vylta.lat#pricing"
            target="_blank"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-vylta-green-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-vylta-green-600"
          >
            Ver planes
          </Link>
        </div>
      </SettingsCard>
    );
  }

  async function toggle(value: boolean) {
    setSaving(true);
    const supabase = createClient();
    if (bookingLink) {
      const { error } = await supabase
        .from('booking_links')
        .update({ is_active: value, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) {
        toast.error('No se pudo actualizar: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('booking_links')
        .insert({ user_id: userId, is_active: value, slug });
      if (error) {
        toast.error('No se pudo crear: ' + error.message);
        setSaving(false);
        return;
      }
    }
    setIsActive(value);
    setSaving(false);
    toast.success(value ? 'Link público activado' : 'Link público desactivado');
  }

  function copyUrl() {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  }

  return (
    <SettingsCard icon={Link2} title="Link público de citas" description="Comparte este link para que tus clientes agenden citas directamente.">
      <div className="space-y-4">
        {/* Toggle activar/desactivar */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
          <div>
            <Label className="text-sm font-semibold">Link público {isActive ? 'activo' : 'inactivo'}</Label>
            <p className="text-[11px] text-muted-foreground">
              {isActive
                ? 'Tus clientes pueden agendar citas en línea.'
                : 'El link está desactivado. Activa para empezar a recibir reservas.'}
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={toggle} disabled={saving} />
        </div>

        {/* URL */}
        <div>
          <Label className="text-xs font-semibold">Tu link de reservas</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <div className={cn(
              'flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs',
              !isActive && 'opacity-60',
            )}>
              {url}
            </div>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title="Copiar"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <Link
              href={url}
              target="_blank"
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground',
                !isActive && 'pointer-events-none opacity-50',
              )}
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs">
          <p className="font-semibold text-blue-700 dark:text-blue-400">💡 Dónde compartirlo</p>
          <ul className="mt-1.5 space-y-0.5 text-blue-700/80 dark:text-blue-400/80">
            <li>• Bio de Instagram, TikTok, Facebook</li>
            <li>• Estado y mensajes de WhatsApp Business</li>
            <li>• Ficha de Google Maps / Google My Business</li>
            <li>• QR impreso en tu negocio</li>
          </ul>
        </div>
      </div>
    </SettingsCard>
  );
}
