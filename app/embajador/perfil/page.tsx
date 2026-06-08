'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, KeyRound, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useEmbajadorResumen } from '@/hooks/use-embajador-portal';

export default function EmbajadorPerfilPage() {
  const queryClient = useQueryClient();
  const { data: resumen, isLoading } = useEmbajadorResumen();

  const [telefono, setTelefono] = useState('');
  const [banco, setBanco] = useState('');
  const [clabe, setClabe] = useState('');
  const [titular, setTitular] = useState('');
  const [rfc, setRfc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [saving, setSaving] = useState(false);

  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (resumen) {
      setTelefono(resumen.telefono || '');
      setBanco(resumen.banco || '');
      setClabe(resumen.clabe || '');
      setTitular(resumen.titular_cuenta || '');
      setRfc(resumen.rfc || '');
      setDireccion(resumen.direccion || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen?.id]);

  if (isLoading || !resumen) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  async function guardarPerfil() {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: res, error } = await supabase.rpc('embajador_actualizar_perfil', {
        p_telefono: telefono.trim() || null,
        p_banco: banco.trim() || null,
        p_clabe: clabe.trim() || null,
        p_titular_cuenta: titular.trim() || null,
        p_rfc: rfc.trim() || null,
        p_direccion: direccion.trim() || null,
      });
      if (error) throw error;
      const r = res as { ok: boolean; error?: string };
      if (!r?.ok) {
        toast.error(r?.error || 'No se pudo guardar');
        return;
      }
      toast.success('Datos guardados');
      queryClient.invalidateQueries({ queryKey: ['embajador-resumen'] });
    } catch (e: any) {
      console.error('[Portal perfil] error:', e);
      toast.error('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function cambiarPassword() {
    if (pass1.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (pass1 !== pass2) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    try {
      setSavingPass(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pass1 });
      if (error) throw error;
      toast.success('Contraseña actualizada');
      setPass1('');
      setPass2('');
    } catch (e: any) {
      console.error('[Portal perfil] password error:', e);
      toast.error('No se pudo cambiar la contraseña.');
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-vylta-bone">Mi perfil</h1>
        <p className="mt-1 text-sm text-vylta-muted">
          Tus datos para recibir pagos y tu seguridad. {resumen.email ? `Tu correo de acceso: ${resumen.email}` : ''}
        </p>
      </div>

      {/* Datos bancarios / fiscales */}
      <div className="rounded-2xl border border-vylta-gold/20 bg-vylta-surface p-6 shadow-card-lg">
        <div className="mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-vylta-gold" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Datos para tus pagos</h2>
        </div>
        <p className="mb-5 text-sm text-vylta-muted">
          Con estos datos te enviamos tus comisiones por transferencia (SPEI) cada mes. Manténlos completos y correctos.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Titular de la cuenta" value={titular} onChange={setTitular} placeholder="Nombre tal cual aparece en el banco" />
          <Campo label="Banco" value={banco} onChange={setBanco} placeholder="Ej. BBVA, Banorte, Nu" />
          <Campo label="CLABE (18 dígitos)" value={clabe} onChange={setClabe} placeholder="18 dígitos" />
          <Campo label="RFC" value={rfc} onChange={setRfc} placeholder="Tu RFC con homoclave" />
          <Campo label="Teléfono" value={telefono} onChange={setTelefono} placeholder="442 123 4567" />
          <Campo label="Dirección" value={direccion} onChange={setDireccion} placeholder="Calle, número, ciudad" />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={guardarPerfil}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-vylta-gold/40 bg-vylta-gold/10 px-4 py-2 text-sm font-bold text-vylta-gold transition hover:bg-vylta-gold/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
      </div>

      {/* Seguridad: cambiar contrasena */}
      <div className="rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-vylta-gold" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-vylta-muted">Cambiar mi contraseña</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nueva contraseña" value={pass1} onChange={setPass1} placeholder="Mínimo 6 caracteres" type="password" />
          <Campo label="Confirmar contraseña" value={pass2} onChange={setPass2} placeholder="Repítela" type="password" />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={cambiarPassword}
            disabled={savingPass}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-vylta-card/40 px-4 py-2 text-sm font-bold text-vylta-muted transition hover:text-vylta-bone disabled:opacity-50"
          >
            {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {savingPass ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-vylta-subtle">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-vylta-admin-bg px-3 py-2 text-sm text-vylta-bone placeholder:text-vylta-subtle/60 focus:border-vylta-gold/50 focus:outline-none"
      />
    </div>
  );
}
