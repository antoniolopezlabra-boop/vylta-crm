'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

// ══════════════════════════════════════════════════════════════════════
// StaffLimitEditor — control admin del límite de colaboradores por tenant
//
// Permite a un administrador leer y modificar cuántos colaboradores puede
// registrar un negocio específico (columna subscription_plans.max_staff).
//
// SEGURIDAD: usa dos funciones RPC SECURITY DEFINER que verifican que el
// llamante esté en vylta_admins (is_active = true) antes de leer/escribir.
// Esto es necesario porque el RLS normal impide que un usuario toque las
// filas de otro. Mismo patrón que get_all_subscription_plans (lectura).
//   • admin_get_staff_limit(p_target_user_id) -> integer
//   • admin_set_staff_limit(p_target_user_id, p_max_staff) -> integer
//
// Es un widget autocontenido: gestiona su propio estado y no depende del
// flujo de datos del detalle del tenant. Base para la futura suscripción
// Enterprise (donde el límite será mayor y, idealmente, validado server-side).
// ══════════════════════════════════════════════════════════════════════

interface Props {
  userId: string;
  planLabel: string;
}

export function StaffLimitEditor({ userId, planLabel }: Props) {
  const [limit, setLimit] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setUnavailable(false);
      const supabase = createClient();
      const { data, error } = await supabase.rpc('admin_get_staff_limit', {
        p_target_user_id: userId,
      });
      if (cancelled) return;
      if (error) {
        // La RPC aún no existe (migración no corrida) o falló: degradar con gracia.
        console.error('[StaffLimitEditor] get error:', error);
        setUnavailable(true);
      } else {
        const v = typeof data === 'number' ? data : 5;
        setLimit(v);
        setDraft(String(v));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < 1 || n > 50) {
      toast.error('Ingresa un número entre 1 y 50');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_set_staff_limit', {
      p_target_user_id: userId,
      p_max_staff: n,
    });
    setSaving(false);
    if (error) {
      console.error('[StaffLimitEditor] set error:', error);
      toast.error(error.message || 'No se pudo guardar el límite');
      return;
    }
    const v = typeof data === 'number' ? data : n;
    setLimit(v);
    setDraft(String(v));
    toast.success(`Límite actualizado a ${v} colaboradores`);
  }

  const changed = limit !== null && draft.trim() !== String(limit);
  const notLuxury = planLabel !== 'Luxury';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border bg-vylta-card/40 px-5 py-3">
        <Users className="h-4 w-4 text-vylta-gold" />
        <h3 className="text-sm font-bold text-vylta-bone">Límite de colaboradores</h3>
        <span className="ml-auto rounded-md bg-vylta-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-muted">
          Enterprise
        </span>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-vylta-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando límite...
          </div>
        ) : unavailable ? (
          <div className="flex items-start gap-2 rounded-lg border border-vylta-amber/30 bg-vylta-amber/5 p-3 text-xs text-vylta-amber">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Función no disponible todavía.</p>
              <p className="mt-0.5 opacity-90">
                Ejecuta la migración SQL (columna max_staff + funciones admin_get/set_staff_limit) en Supabase para habilitar este control.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-vylta-muted">
              Define cuántos colaboradores puede registrar este negocio. El plan Luxury permite 5 por defecto; auméntalo para clientes tipo Enterprise.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={50}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-24 rounded-lg border border-border bg-vylta-card/60 px-3 py-2 text-sm font-bold tabular-nums text-vylta-bone outline-none transition-colors focus:border-vylta-gold/50 focus:ring-2 focus:ring-vylta-gold/15"
              />
              <span className="text-sm text-vylta-muted">colaboradores</span>
              <Button
                size="sm"
                onClick={save}
                disabled={saving || !changed}
                className="ml-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
            {notLuxury && (
              <p className="mt-3 text-[11px] text-vylta-subtle">
                Nota: este negocio tiene plan {planLabel}. La gestión de equipo requiere plan Luxury, así que el límite solo tendrá efecto cuando el negocio cuente con acceso a equipo.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
