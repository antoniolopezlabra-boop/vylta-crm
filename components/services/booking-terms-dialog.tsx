'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ══════════════════════════════════════════════════════════════════════
// Términos y condiciones de reserva (nov 2026)
//
// Texto libre del negocio (business_profiles.booking_terms). En el link de
// reservas se muestra ANTES de confirmar (el cliente debe marcar "Acepto")
// y DESPUÉS en la pantalla de cita confirmada. Vacío = no se muestra.
// ══════════════════════════════════════════════════════════════════════

const MAX = 2000;
const EXAMPLE =
  'Todos nuestros precios del catálogo son precios base y pueden cambiar tras la evaluación directa en el salón.';

export function BookingTermsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (terms: string) => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('business_profiles')
        .select('booking_terms')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setText(data?.booking_terms || '');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function save(value: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesión expirada');
      const clean = value.trim();
      const { error } = await supabase
        .from('business_profiles')
        .update({ booking_terms: clean || null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success(clean ? 'Términos guardados: ya aparecen en tu link de reservas' : 'Términos eliminados');
      onSaved?.(clean);
      onOpenChange(false);
    } catch (err) {
      console.error('[bookingTerms] error:', err);
      toast.error('No pudimos guardar los términos');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-vylta-green" />
            Términos y condiciones
          </DialogTitle>
          <DialogDescription>
            Tus clientes los verán al reservar en línea: antes de confirmar deberán marcar
            &ldquo;Acepto&rdquo;, y se los volvemos a mostrar con su cita confirmada.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-vylta-green" />
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder={`Ej.: ${EXAMPLE}`}
              rows={7}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              {!text.trim() ? (
                <button type="button" onClick={() => setText(EXAMPLE)} className="font-semibold text-vylta-green hover:underline">
                  Usar ejemplo
                </button>
              ) : <span />}
              <span>{text.length}/{MAX}</span>
            </div>

            {text.trim() && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-left">
                <div className="text-xs font-bold text-amber-800">📋 Así lo verán tus clientes</div>
                <p className="mt-1 whitespace-pre-line text-sm text-amber-900">{text.trim()}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {text.trim() ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving || loading}
              onClick={() => { if (window.confirm('¿Quitar los términos y condiciones de tu link de reservas?')) save(''); }}
            >
              Quitar términos
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => save(text)} disabled={saving || loading || !text.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
