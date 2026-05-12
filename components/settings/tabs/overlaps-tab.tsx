'use client';

import { useState } from 'react';
import { Sparkles, Lock, Cake, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';

interface Props {
  userId: string;
  profile: any | null;
  isLuxury: boolean;
}

export function OverlapsTab({ userId, profile, isLuxury }: Props) {
  const [allowOverlapping, setAllowOverlapping] = useState(profile?.allow_overlapping === true);
  const [birthdayEnabled, setBirthdayEnabled] = useState(profile?.birthday_reminders_enabled === true);
  const [savingOverlap, setSavingOverlap] = useState(false);
  const [savingBirthday, setSavingBirthday] = useState(false);

  async function updateField(field: 'allow_overlapping' | 'birthday_reminders_enabled', value: boolean) {
    const supabase = createClient();
    if (profile) {
      const { error } = await supabase
        .from('business_profiles')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      return error;
    } else {
      const { error } = await supabase
        .from('business_profiles')
        .insert({ user_id: userId, [field]: value });
      return error;
    }
  }

  async function toggleOverlap(value: boolean) {
    if (!isLuxury) {
      toast.error('Esta función requiere plan Luxury');
      return;
    }
    setSavingOverlap(true);
    const error = await updateField('allow_overlapping', value);
    setSavingOverlap(false);
    if (error) {
      toast.error('No se pudo guardar: ' + error.message);
      return;
    }
    setAllowOverlapping(value);
    toast.success(value ? 'Citas simultáneas activadas' : 'Citas simultáneas desactivadas');
  }

  async function toggleBirthday(value: boolean) {
    if (!isLuxury) {
      toast.error('Esta función requiere plan Luxury');
      return;
    }
    setSavingBirthday(true);
    const error = await updateField('birthday_reminders_enabled', value);
    setSavingBirthday(false);
    if (error) {
      toast.error('No se pudo guardar: ' + error.message);
      return;
    }
    setBirthdayEnabled(value);
    toast.success(value ? 'Felicitaciones por email activadas' : 'Felicitaciones por email desactivadas');
  }

  return (
    <div className="space-y-4">
      {/* Citas simultáneas */}
      <SettingsCard
        icon={isLuxury ? Sparkles : Lock}
        title="Citas simultáneas"
        description="Permite agendar más de una cita al mismo tiempo (útil si tienes equipo)."
        badge={!isLuxury ? <span className="rounded-md bg-vylta-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-vylta-amber-700 dark:text-amber-400">LUXURY</span> : undefined}
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
          <div>
            <Label className="text-sm font-semibold">{allowOverlapping ? 'Activado' : 'Desactivado'}</Label>
            <p className="text-[11px] text-muted-foreground">
              {isLuxury
                ? 'Con citas simultáneas, puedes asignar dos colaboradores a la misma hora.'
                : 'Activa Luxury para gestionar equipo y citas simultáneas.'}
            </p>
          </div>
          <Switch checked={allowOverlapping} onCheckedChange={toggleOverlap} disabled={savingOverlap || !isLuxury} />
        </div>
      </SettingsCard>

      {/* Felicitaciones de cumpleaños POR EMAIL (May 2026) */}
      <SettingsCard
        icon={isLuxury ? Cake : Lock}
        title="Felicitaciones de cumpleaños por email"
        description="Envía un email automático de felicitación a tus clientes el día de su cumpleaños."
        badge={!isLuxury ? <span className="rounded-md bg-vylta-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-vylta-amber-700 dark:text-amber-400">LUXURY</span> : undefined}
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
          <div>
            <Label className="text-sm font-semibold">{birthdayEnabled ? 'Activado' : 'Desactivado'}</Label>
            <p className="text-[11px] text-muted-foreground">
              {isLuxury
                ? 'Tus clientes recibirán un email cariñoso desde noreply@vylta.lat el día de su cumpleaños.'
                : 'Activa Luxury para enviar felicitaciones automáticas por email.'}
            </p>
          </div>
          <Switch checked={birthdayEnabled} onCheckedChange={toggleBirthday} disabled={savingBirthday || !isLuxury} />
        </div>

        {/* Info adicional + link a editor (cuando esté disponible en web) */}
        {isLuxury && birthdayEnabled && (
          <div className="mt-3 rounded-lg border border-pink-500/30 bg-pink-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-600 dark:text-pink-400" />
              <div className="text-pink-700 dark:text-pink-400">
                <p className="font-semibold">Solo se enviará a clientes con email + fecha de nacimiento registrados.</p>
                <p className="mt-1 text-pink-700/80 dark:text-pink-400/80">
                  Personaliza el asunto, el mensaje y el descuento opcional desde la app móvil en Configuración → Cumpleaños.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nota compliance Meta */}
        {isLuxury && (
          <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-[11px] text-blue-700 dark:text-blue-400">
            ℹ️ Las felicitaciones se envían por email (no WhatsApp) para cumplir con las políticas de Meta sobre mensajes promocionales.
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
