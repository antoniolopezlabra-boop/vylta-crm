'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Link2, Copy, ExternalLink, Loader2, Download, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// Tab: Link público de citas.
//
// ⚡ FIX (May 19 2026): el link público es para TODOS los planes,
// no solo Premium/Luxury. Lo que diferencia los planes es el LÍMITE
// MENSUAL de citas (Gratuito: 10/mes, Premium: ilimitado), pero el
// acceso al link es universal — es el corazón del producto VYLTA.
//
// ⚡ QR (Jun 2026): se agregó el código QR del link (igual que la app
// móvil). Se genera con la API pública api.qrserver.com (sin dependencias
// nuevas; el link es público, no hay datos sensibles) y se puede descargar
// como PNG para imprimirlo en el negocio.
// ══════════════════════════════════════════════════════════════════════

interface Props {
  userId: string;
  bookingLink: { is_active?: boolean | null; slug?: string | null } | null;
  /** Reservado para diferenciar features futuras (analytics, branding…) */
  isPremium: boolean;
}

export function BookingLinkTab({ userId, bookingLink }: Props) {
  const [isActive, setIsActive] = useState(bookingLink?.is_active === true);
  const [saving, setSaving] = useState(false);
  const slug = bookingLink?.slug || 'tu-negocio';
  const url = `https://book.vylta.lat/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(url)}`;

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

  async function downloadQr() {
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `vylta-qr-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('Código QR descargado');
    } catch {
      // Fallback robusto: abrir el QR en una pestaña nueva para guardar/imprimir
      window.open(qrUrl, '_blank');
    }
  }

  return (
    <SettingsCard
      icon={Link2}
      title="Link público de citas"
      description="Comparte este link para que tus clientes agenden citas directamente."
    >
      <div className="space-y-4">
        {/* Toggle activar/desactivar */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div>
            <Label className="text-sm font-semibold">
              Link público {isActive ? 'activo' : 'inactivo'}
            </Label>
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
            <div
              className={cn(
                'flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs',
                !isActive && 'opacity-60',
              )}
            >
              {url}
            </div>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title="Copiar"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <Link
              href={url}
              target="_blank"
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground',
                !isActive && 'pointer-events-none opacity-50',
              )}
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Código QR */}
        <div>
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <QrCode className="h-3.5 w-3.5" />
            Código QR
          </Label>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">
            Imprímelo en tu negocio para que tus clientes escaneen y agenden al instante.
          </p>
          <div
            className={cn(
              'flex flex-col items-center gap-4 rounded-xl border border-border bg-secondary/30 p-4 sm:flex-row',
              !isActive && 'opacity-60',
            )}
          >
            <div className="shrink-0 rounded-xl bg-white p-2.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="Código QR de tu link de reservas"
                width={176}
                height={176}
                className="h-44 w-44"
              />
            </div>
            <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Escanea con la cámara del teléfono para abrir tu página de reservas. Ideal para tu mostrador, tarjetas o vitrina.
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-vylta-bone transition hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar QR
              </button>
            </div>
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
