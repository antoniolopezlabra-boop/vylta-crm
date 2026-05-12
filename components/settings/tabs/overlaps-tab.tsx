'use client';

import { useState } from 'react';
import { Sparkles, Lock, Cake, Loader2 } from 'lucide-react';
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
    toast.success(value ? 'Cumpleaños automáticos activados' : 'Cumpleaños automáticos desactivados');
  }

  return (
    <div className="space-y-4">
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

      <SettingsCard
        icon={isLuxury ? Cake : Lock}
        title="Recordatorios de cumpleaños"
        description="Envía un WhatsApp automático de felicitación a tus clientes el día de su cumpleaños."
        badge={!isLuxury ? <span className="rounded-md bg-vylta-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-vylta-amber-700 dark:text-amber-400">LUXURY</span> : undefined}
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
          <div>
            <Label className="text-sm font-semibold">{birthdayEnabled ? 'Activado' : 'Desactivado'}</Label>
            <p className="text-[11px] text-muted-foreground">
              {isLuxury
                ? 'Asegúrate de capturar el cumpleaños de tus clientes para activar esto.'
                : 'Activa Luxury para enviar felicitaciones automáticas.'}
            </p>
          </div>
          <Switch checked={birthdayEnabled} onCheckedChange={toggleBirthday} disabled={savingBirthday || !isLuxury} />
        </div>
      </SettingsCard>
    </div>
  );
}
