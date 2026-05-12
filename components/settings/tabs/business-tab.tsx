'use client';

import { useState } from 'react';
import { Loader2, Building2, Save, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SettingsCard } from '../configuracion-shell';

export function BusinessTab({ userId, profile }: { userId: string; profile: any }) {
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    business_type: profile?.business_type || '',
    description: profile?.description || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.business_name.trim()) {
      toast.error('El nombre del negocio es obligatorio');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload: any = {
      business_name: form.business_name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      business_type: form.business_type.trim() || null,
      description: form.description.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let error: any = null;
    if (profile) {
      const res = await supabase.from('business_profiles').update(payload).eq('user_id', userId);
      error = res.error;
    } else {
      payload.user_id = userId;
      const res = await supabase.from('business_profiles').insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error('No pudimos guardar: ' + error.message);
      return;
    }
    toast.success('Información del negocio guardada');
  }

  return (
    <SettingsCard icon={Building2} title="Información del negocio" description="Estos datos aparecen en tu página pública de reservas y en los mensajes de WhatsApp.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Nombre del negocio <span className="text-destructive">*</span></Label>
          <Input value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} placeholder="Ej: Karen Nails Star Heart" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Phone className="h-3 w-3 text-muted-foreground" /> Teléfono
            </Label>
            <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="442 123 4567" type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de negocio</Label>
            <Input value={form.business_type} onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))} placeholder="Salón de uñas, barbería, spa..." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className="h-3 w-3 text-muted-foreground" /> Dirección
          </Label>
          <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Calle, número, colonia, ciudad" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Descripción del negocio</Label>
          <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Cuenta a tus clientes qué te hace especial..." rows={3} />
          <p className="text-[11px] text-muted-foreground">Aparece en tu página pública de reservas.</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Guardar cambios</>}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
