'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar, AlertTriangle, Clock, Pencil, Check, X, Loader2,
  Trash2, Plus, CircleCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════
// VendorPaymentsTable (v3 — EDITABLE INLINE May 22 2026)
//
// ANTONIO PIDIÓ:
//   "quiero poder manipular las fechas de vencimiento, de igual manera
//    los costos mensuales, por si necesito hacer actualizaciones de
//    membresias, por que en todas aparece el 31 de mayo y no es correcta
//    esa información... casi casi como tabla de excel"
//
// IMPLEMENTACIÓN HÍBRIDA (mejor de ambos mundos):
//   • Campos rápidos (monto, fecha) → EDICIÓN INLINE (click → edita → Enter)
//   • Marcar pagado → BOTÓN RÁPIDO (1 click)
//   • Eliminar → confirmación inline
//
// RECALCULO EN VIVO:
//   Cuando guardas un cambio, TanStack Query invalida la cache y
//   los KPIs del header (Recurrente mensual, Próximos 30 días) se
//   actualizan automáticamente sin reload.
// ═══════════════════════════════════════════════════════════════════════

interface VendorPayment {
  id: string;
  vendor_name: string;
  category: string;
  amount_mxn: number;
  currency: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'annual';
  notes: string | null;
}

async function fetchVendorPayments(): Promise<VendorPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vendor_payments')
    .select('*')
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true });
  if (error) {
    console.error('[VendorPaymentsTable] Error:', error);
    return [];
  }
  return data as VendorPayment[];
}

const CATEGORY_LABELS: Record<string, string> = {
  infraestructura: 'Infraestructura',
  comunicaciones: 'Comunicaciones',
  automatizacion: 'Automatización',
  pagos: 'Pagos',
  desarrollo: 'Desarrollo',
  marketing: 'Marketing',
  legal: 'Legal',
  otro: 'Otro',
};

const CATEGORY_COLORS: Record<string, string> = {
  infraestructura: 'text-vylta-sky',
  comunicaciones: 'text-vylta-green',
  automatizacion: 'text-vylta-luxury',
  pagos: 'text-vylta-gold',
  desarrollo: 'text-vylta-gold',
  marketing: 'text-vylta-rose',
  legal: 'text-vylta-bone',
  otro: 'text-vylta-muted',
};

export function VendorPaymentsTable() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: fetchVendorPayments,
  });

  const payments = data || [];

  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 86400000);

  const monthlyRecurring = payments
    .filter(p => p.frequency === 'monthly')
    .reduce((sum, p) => sum + Number(p.amount_mxn), 0);

  const next30Days = payments.filter(p => {
    const due = new Date(p.due_date);
    return due <= thirtyDaysFromNow;
  });
  const next30DaysTotal = next30Days.reduce((sum, p) => sum + Number(p.amount_mxn), 0);
  const overdueCount = payments.filter(p => p.status === 'overdue').length;

  function refreshTable() {
    queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
  }

  return (
    <div className="rounded-xl border border-border bg-vylta-surface shadow-card overflow-hidden">
      {/* Header con totales — recalcula en vivo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border bg-vylta-card/40 p-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">
            Recurrente mensual
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tightest text-vylta-bone">
            ${monthlyRecurring.toLocaleString('es-MX')}
            <span className="text-sm text-vylta-muted ml-2">MXN</span>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">
            Próximos 30 días
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tightest text-vylta-gold">
            ${next30DaysTotal.toLocaleString('es-MX')}
            <span className="text-sm text-vylta-muted ml-2">MXN</span>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">
            Vencidos
          </div>
          <div className={cn(
            'mt-2 text-3xl font-bold tabular-nums tracking-tightest',
            overdueCount > 0 ? 'text-vylta-rose' : 'text-vylta-muted'
          )}>
            {overdueCount}
            {overdueCount > 0 && (
              <AlertTriangle className="inline h-5 w-5 ml-2 mb-1 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 mb-2 rounded shimmer" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="p-10 text-center">
          <Calendar className="h-10 w-10 mx-auto text-vylta-subtle mb-3" />
          <div className="text-base text-vylta-muted">
            Sin pagos pendientes registrados
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-[0.15em] text-vylta-subtle">
                <th className="px-6 py-4">Proveedor</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Frecuencia</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4">Vence</th>
                <th className="px-6 py-4 text-right w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} today={today} onUpdate={refreshTable} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══ ROW EDITABLE ═══
function PaymentRow({
  payment,
  today,
  onUpdate,
}: {
  payment: VendorPayment;
  today: Date;
  onUpdate: () => void;
}) {
  const [editingField, setEditingField] = useState<'amount' | 'due_date' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const due = new Date(payment.due_date + 'T12:00:00');
  const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / 86400000);
  const isOverdue = payment.status === 'overdue';
  const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

  function startEdit(field: 'amount' | 'due_date') {
    setEditingField(field);
    setTempValue(
      field === 'amount'
        ? String(Number(payment.amount_mxn))
        : payment.due_date
    );
  }

  function cancelEdit() {
    setEditingField(null);
    setTempValue('');
  }

  async function saveEdit() {
    if (!editingField) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const update: any = {};

      if (editingField === 'amount') {
        const num = Number(tempValue);
        if (isNaN(num) || num < 0) {
          toast.error('Monto inválido');
          setSaving(false);
          return;
        }
        update.amount_mxn = num;
      } else if (editingField === 'due_date') {
        if (!tempValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          toast.error('Formato de fecha inválido');
          setSaving(false);
          return;
        }
        update.due_date = tempValue;
      }

      const { error } = await supabase
        .from('vendor_payments')
        .update(update)
        .eq('id', payment.id);

      if (error) throw error;

      toast.success('Actualizado');
      setEditingField(null);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function markAsPaid() {
    if (!confirm(`¿Marcar como pagado el pago a ${payment.vendor_name}?`)) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('vendor_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payment.id);
      if (error) throw error;
      toast.success(`✓ ${payment.vendor_name} marcado como pagado`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment() {
    if (!confirm(`¿Eliminar permanentemente el pago a ${payment.vendor_name}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('vendor_payments')
        .delete()
        .eq('id', payment.id);
      if (error) throw error;
      toast.success(`${payment.vendor_name} eliminado`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-vylta-card/30">
      {/* Proveedor */}
      <td className="px-6 py-4">
        <div className="text-base font-semibold text-vylta-bone">{payment.vendor_name}</div>
        {payment.notes && (
          <div className="text-xs text-vylta-muted mt-1 line-clamp-1">{payment.notes}</div>
        )}
      </td>

      {/* Categoría */}
      <td className="px-6 py-4">
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          CATEGORY_COLORS[payment.category] || 'text-vylta-muted'
        )}>
          {CATEGORY_LABELS[payment.category] || payment.category}
        </span>
      </td>

      {/* Frecuencia */}
      <td className="px-6 py-4">
        <span className="text-sm text-vylta-muted">
          {payment.frequency === 'monthly'   ? 'Mensual'
          : payment.frequency === 'annual'    ? 'Anual'
          : payment.frequency === 'quarterly' ? 'Trimestral'
          : 'Una vez'}
        </span>
      </td>

      {/* MONTO EDITABLE */}
      <td className="px-6 py-4 text-right">
        {editingField === 'amount' ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-vylta-muted">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-28 rounded border border-vylta-gold/40 bg-vylta-card px-2 py-1 text-right text-base font-bold tabular-nums text-vylta-bone focus:outline-none focus:border-vylta-gold"
            />
            <button
              onClick={saveEdit}
              disabled={saving}
              className="p-1 text-vylta-green hover:bg-vylta-green/10 rounded"
              title="Guardar"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="p-1 text-vylta-rose hover:bg-vylta-rose/10 rounded"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEdit('amount')}
            className="group/edit inline-flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-vylta-card transition"
            title="Click para editar"
          >
            <span className="text-base font-bold tabular-nums text-vylta-bone">
              ${Number(payment.amount_mxn).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-vylta-muted">{payment.currency}</span>
            <Pencil className="h-3 w-3 text-vylta-subtle opacity-0 group-hover/edit:opacity-100 transition" />
          </button>
        )}
      </td>

      {/* FECHA EDITABLE */}
      <td className="px-6 py-4">
        {editingField === 'due_date' ? (
          <div className="flex items-center gap-1">
            <input
              type="date"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="rounded border border-vylta-gold/40 bg-vylta-card px-2 py-1 text-sm text-vylta-bone focus:outline-none focus:border-vylta-gold"
            />
            <button
              onClick={saveEdit}
              disabled={saving}
              className="p-1 text-vylta-green hover:bg-vylta-green/10 rounded"
              title="Guardar"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="p-1 text-vylta-rose hover:bg-vylta-rose/10 rounded"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEdit('due_date')}
            className={cn(
              'group/edit inline-flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-vylta-card transition text-sm',
              isOverdue ? 'text-vylta-rose font-bold'
              : isUrgent ? 'text-vylta-gold font-bold'
              : 'text-vylta-muted'
            )}
            title="Click para editar fecha"
          >
            {isOverdue
              ? <AlertTriangle className="h-4 w-4" />
              : isUrgent
                ? <Clock className="h-4 w-4" />
                : <Calendar className="h-4 w-4 opacity-60" />
            }
            {due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
            {!isOverdue && (
              <span className="text-xs tabular-nums">
                ({daysUntilDue >= 0 ? `${daysUntilDue}d` : `-${Math.abs(daysUntilDue)}d`})
              </span>
            )}
            <Pencil className="h-3 w-3 text-vylta-subtle opacity-0 group-hover/edit:opacity-100 transition" />
          </button>
        )}
      </td>

      {/* ACCIONES */}
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={markAsPaid}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border border-vylta-green/30 bg-vylta-green/5 px-2.5 py-1 text-xs font-bold text-vylta-green transition hover:bg-vylta-green/10"
            title="Marcar como pagado"
          >
            <CircleCheck className="h-3.5 w-3.5" />
            Pagado
          </button>
          <button
            onClick={deletePayment}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md border border-vylta-rose/20 bg-transparent p-1.5 text-vylta-subtle transition hover:border-vylta-rose/40 hover:bg-vylta-rose/5 hover:text-vylta-rose"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
