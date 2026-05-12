'use client';

import { useState, useRef } from 'react';
import { Loader2, Building2, Save, Phone, MapPin, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCard } from '../configuracion-shell';

// ══════════════════════════════════════════════════════════════════════
// Pestaña Negocio — editar perfil completo + logo.
//
// Schema real de business_profiles:
//   business_name, business_type, address, phone, alternative_phone, logo_url
// NO existe: description, business_email
// ══════════════════════════════════════════════════════════════════════

const LOGOS_BUCKET = 'business-logos';

export function BusinessTab({ userId, profile }: { userId: string; profile: any }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    phone: profile?.phone || '',
    alternative_phone: profile?.alternative_phone || '',
    address: profile?.address || '',
    business_type: profile?.business_type || '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logo_url || null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function uploadLogo(file: File) {
    // Validaciones cliente
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo debe pesar menos de 2 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (PNG, JPG, WebP)');
      return;
    }

    setUploadingLogo(true);
    const supabase = createClient();

    // Path: {userId}/logo-{timestamp}.{ext}
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(LOGOS_BUCKET)
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      console.error('[BusinessTab] upload error:', uploadError);
      toast.error('No pudimos subir el logo: ' + uploadError.message);
      setUploadingLogo(false);
      return;
    }

    const { data: publicData } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path);
    const newUrl = publicData.publicUrl;

    // Guardar URL inmediatamente en BD (no esperar al "Guardar cambios")
    const { error: dbError } = await supabase
      .from('business_profiles')
      .update({ logo_url: newUrl, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    setUploadingLogo(false);

    if (dbError) {
      toast.error('Logo subido pero no guardado: ' + dbError.message);
      return;
    }

    setLogoUrl(newUrl);
    toast.success('Logo actualizado');
  }

  async function removeLogo() {
    if (!confirm('¿Quitar el logo actual?')) return;
    setUploadingLogo(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('business_profiles')
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    setUploadingLogo(false);
    if (error) {
      toast.error('No pudimos quitar el logo');
      return;
    }
    setLogoUrl(null);
    toast.success('Logo eliminado');
  }

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
      alternative_phone: form.alternative_phone.trim() || null,
      address: form.address.trim() || null,
      business_type: form.business_type.trim() || null,
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
    <SettingsCard
      icon={Building2}
      title="Información del negocio"
      description="Estos datos aparecen en tu página pública de reservas y en los mensajes a clientes."
    >
      <div className="space-y-5">
        {/* Logo del negocio */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Logo del negocio</Label>
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}</>
                  )}
                </Button>
                {logoUrl && (
                  <Button size="sm" variant="outline" onClick={removeLogo} disabled={uploadingLogo} className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                    Quitar
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                PNG, JPG o WebP. Máx. 2 MB. Cuadrado recomendado.
              </p>
            </div>
          </div>
        </div>

        {/* Nombre */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Nombre del negocio <span className="text-destructive">*</span>
          </Label>
          <Input
            value={form.business_name}
            onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))}
            placeholder="Ej: Karen Nails Star Heart"
          />
        </div>

        {/* Tipo + teléfono principal */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de negocio</Label>
            <Input
              value={form.business_type}
              onChange={(e) => setForm((p) => ({ ...p, business_type: e.target.value }))}
              placeholder="Salón de uñas, barbería, spa..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Phone className="h-3 w-3 text-muted-foreground" /> Teléfono / WhatsApp
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="442 123 4567"
              type="tel"
            />
          </div>
        </div>

        {/* Teléfono alternativo */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <Phone className="h-3 w-3 text-muted-foreground" /> Teléfono alternativo
            <span className="text-[10px] font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            value={form.alternative_phone}
            onChange={(e) => setForm((p) => ({ ...p, alternative_phone: e.target.value }))}
            placeholder="442 765 4321"
            type="tel"
          />
        </div>

        {/* Dirección */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className="h-3 w-3 text-muted-foreground" /> Dirección
          </Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="Calle, número, colonia, ciudad"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Guardar cambios
              </>
            )}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
