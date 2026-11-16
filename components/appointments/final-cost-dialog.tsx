'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { cn, formatCurrency } from '@/lib/utils';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payment-methods';

// ══════════════════════════════════════════════════════════════════════
// Cobrar cita / Ajustar precio final (nov 2026)
//
// El dueño puede cambiar el monto final (ej. reservó $400 y al final el
// trabajo fue de $500). Se guarda en appointments.service_cost (lo que
// suman los reportes); el trigger track_appointment_cost_adjust guarda el
// precio con que se reservó en original_cost. Si hubo anticipo en línea se
// muestra cuánto falta por cobrar.
//   mode 'cobrar'  → guarda el monto y cierra la cita como Pagado.
//   mode 'ajustar' → solo cambia el monto (cualquier estado abierto o Pagado).
// ══════════════════════════════════════════════════════════════════════

export interface FinalCostAppointment {
  id: string;
  service_cost: number | null;
  original_cost?: number | null;
  cost_adjust_note?: string | null;
  status?: string | null;
  payment_method?: string | null;
}

const QUICK = [-100, -50, 50, 100, 200];

export function FinalCostDialog({
  open,
  onOpenChange,
  appointment,
  mode,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: FinalCostAppointment;
  mode: 'cobrar' | 'ajustar';
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [prepaid, setPrepaid] = useState(0);
  const [saving, setSaving] = useState(false);
  // Forma de pago: obligatoria al cobrar; editable en citas ya pagadas.
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const askMethod = mode === 'cobrar' || appointment.status === 'Pagado';

  const booked = Number(appointment.original_cost ?? appointment.service_cost ?? 0);

  useEffect(() => {
    if (!open) return;
    setAmount(String(Number(appointment.service_cost ?? 0)));
    setNote(appointment.cost_adjust_note || '');
    setMethod((PAYMENT_METHODS.find(m => m.value === appointment.payment_method)?.value) ?? null);
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('prepayments')
        .select('amount_prepay, status')
        .eq('appointment_id', appointment.id)
        .eq('status', 'succeeded');
      if (!cancelled) setPrepaid((data || []).reduce((s, p: any) => s + Number(p.amount_prepay || 0) / 100, 0));
    })();
    return () => { cancelled = true; };
  }, [open, appointment.id, appointment.service_cost, appointment.cost_adjust_note, appointment.payment_method]);

  const value = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 999999;
  const diff = valid ? value - booked : 0;
  const remaining = valid ? Math.max(0, value - prepaid) : 0;

  const methodOk = mode !== 'cobrar' || !!method;

  async function save() {
    if (!valid) return;
    if (!methodOk) { toast.error('Elige cómo te pagaron: efectivo, tarjeta o transferencia'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const changed = value !== Number(appointment.service_cost ?? 0);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (changed) patch.service_cost = Math.round(value * 100) / 100;
      // La nota solo tiene sentido si el monto final difiere del reservado.
      patch.cost_adjust_note = value !== booked && note.trim() ? note.trim().slice(0, 200) : null;
      if (askMethod && method) patch.payment_method = method;
      if (mode === 'cobrar') patch.status = 'Pagado';
      const { error } = await supabase.from('appointments').update(patch).eq('id', appointment.id);
      if (error) throw error;
      toast.success(mode === 'cobrar'
        ? `Cita cobrada por ${formatCurrency(value)}${method ? ' · ' + PAYMENT_METHODS.find(m => m.value === method)!.label : ''}`
        : `Precio final actualizado a ${formatCurrency(value)}`);
      onOpenChange(false);
      onDone();
    } catch (err) {
      console.error('[finalCost] error:', err);
      toast.error('No pudimos guardar el monto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-vylta-green" />
            {mode === 'cobrar' ? 'Cobrar cita' : 'Ajustar precio final'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'cobrar'
              ? 'Confirma cuánto se cobró. Si el servicio salió más caro o más barato, cámbialo aquí.'
              : 'Cambia el monto final de esta cita. Así se reflejará en tus reportes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-vylta-card/50 px-3 py-2 text-sm">
            <span className="text-vylta-muted">Precio al reservar</span>
            <span className="font-semibold text-vylta-bone">{formatCurrency(booked)}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-vylta-muted">Monto final cobrado (MXN)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-vylta-green">$</span>
              <Input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                className="h-12 pl-8 text-xl font-bold"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(a => String(Math.max(0, (Number(a) || 0) + q)))}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone"
                >
                  {q > 0 ? `+${q}` : q}
                </button>
              ))}
              {value !== booked && (
                <button
                  type="button"
                  onClick={() => setAmount(String(booked))}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-vylta-green hover:underline"
                >
                  Volver al precio original
                </button>
              )}
            </div>
            {valid && diff !== 0 && (
              <p className={diff > 0 ? 'text-xs font-semibold text-vylta-green' : 'text-xs font-semibold text-vylta-amber'}>
                {diff > 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))} respecto al precio de reserva
              </p>
            )}
          </div>

          {valid && value !== booked && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-vylta-muted">Motivo del ajuste (opcional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="Ej.: diseño más elaborado, se agregó decoración"
              />
            </div>
          )}

          {askMethod && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-vylta-muted">
                ¿Cómo te pagaron?{mode === 'cobrar' && <span className="text-destructive"> *</span>}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const on = method === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      aria-pressed={on}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-bold transition',
                        on
                          ? 'border-vylta-green bg-vylta-green/10 text-vylta-bone'
                          : 'border-border text-vylta-muted hover:border-vylta-green/40 hover:text-vylta-bone',
                      )}
                    >
                      <span className="text-xl leading-none">{m.emoji}</span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {prepaid > 0 && valid && (
            <div className="space-y-1 rounded-lg border border-vylta-green/30 bg-vylta-green/5 px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-vylta-muted">Anticipo pagado en línea</span><span className="font-semibold">{formatCurrency(prepaid)}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-vylta-bone">Resta por cobrar</span><span className="font-bold text-vylta-green">{formatCurrency(remaining)}</span></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !valid || !methodOk}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              : mode === 'cobrar' ? `Cobrar ${valid ? formatCurrency(value) : ''}` : 'Guardar precio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
