'use client';

import { useEffect, useState } from 'react';
import { Mail, Loader2, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

// Seguimiento por correo: Iván le escribe a los negocios registrados que no
// pagan, según la etapa en que se quedaron. Apagado hasta que el fundador lo active.

type Sent = { id: string; business: string | null; subject: string; status: string; created_at: string };

export function OutreachCard({ supabase, policy, onPreview }: { supabase: SupabaseClient; policy: any; onPreview: () => Promise<{ subject: string; html: string }> }) {
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const openPreview = async () => { setLoadingPreview(true); try { setPreview(await onPreview()); } catch (e) { toast.error((e as Error).message); } finally { setLoadingPreview(false); } };
  const [on, setOn] = useState<boolean>(!!policy?.activo);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent[]>([]);
  useEffect(() => setOn(!!policy?.activo), [policy?.activo]);
  useEffect(() => {
    supabase.from('mk_outreach').select('id,business,subject,status,created_at').order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setSent((data ?? []) as Sent[]));
  }, [supabase, on]);

  const toggle = async () => {
    setBusy(true);
    const value = { ...(policy ?? {}), activo: !on };
    const { error } = await supabase.from('mk_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'outreach_policy');
    setBusy(false);
    if (error) return toast.error(error.message);
    setOn(!on);
    toast.success(!on ? 'Seguimiento por correo activado: Iván escribe lunes, miércoles y viernes' : 'Seguimiento por correo apagado');
  };

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Mail className="h-3.5 w-3.5 text-emerald-500" />Seguimiento por correo a negocios registrados</div>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            Iván (Growth) revisa en qué etapa se quedó cada negocio que se registró y no paga (sin servicios, sin citas, poco uso…) y le escribe un correo corto y personalizado a nombre de VYLTA.
            Máximo {policy?.max_por_dia ?? 10} al día, uno cada {policy?.dias_entre_correos ?? 14} días por negocio, con enlace para darse de baja. Tú no mandas nada.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button onClick={openPreview} disabled={loadingPreview} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Ver plantilla
        </button>
        <button onClick={toggle} disabled={busy}
                className={cn('inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold', on ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 text-slate-600 hover:bg-slate-50')}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{on ? 'Activado' : 'Apagado · Activar'}
        </button>
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="mk-light flex h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vista previa · así lo recibe el negocio</p>
                <p className="truncate text-sm font-semibold text-slate-900">Asunto (ejemplo): {preview.subject}</p>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <iframe title="Vista previa del correo" srcDoc={preview.html} className="w-full flex-1 bg-[#F3F4F8]" sandbox="" />
            <p className="border-t border-slate-200 px-5 py-2.5 text-[12px] text-slate-500">El texto cambia en cada correo: Iván lo escribe según la etapa de cada negocio. El diseño, el botón, las tiendas y la baja son fijos.</p>
          </div>
        </div>
      )}
      {sent.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 text-[12px]">
          {sent.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-slate-700"><b>{s.business ?? '—'}</b> · {s.subject}</span>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-semibold', s.status === 'enviado' ? 'bg-emerald-50 text-emerald-700' : s.status === 'baja' ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-700')}>
                {s.status} · {new Date(s.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
