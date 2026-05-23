'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Calendar, CircleCheck, AlertTriangle, Clock, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// VendorPaymentsTable — Calendario de pagos a proveedores
//
// Lee de la tabla vendor_payments creada en la migracion del 22 mayo 2026.
// Solo admins activos pueden ver los datos (RLS via vylta_admins).
//
// CONTENIDO:
//   - Total mensual recurrente (sumatoria de pagos monthly pendientes)
//   - Total proximos 30 dias
//   - Tabla con cada pago: proveedor, categoria, monto, fecha, status
//   - Highlighting visual según status:
//       • pending  → amarillo
//       • paid     → verde tachado
//       • overdue  → rojo pulsing
//       • cancelled → gris
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
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: fetchVendorPayments,
  });

  const payments = data || [];

  // Calculos
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 86400000);

  const next30Days = payments.filter(p => {
    const due = new Date(p.due_date);
    return due <= thirtyDaysFromNow;
  });

  const monthlyRecurring = payments
    .filter(p => p.frequency === 'monthly')
    .reduce((sum, p) => sum + Number(p.amount_mxn), 0);

  const next30DaysTotal = next30Days.reduce((sum, p) => sum + Number(p.amount_mxn), 0);
  const overdueCount = payments.filter(p => p.status === 'overdue').length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px w-5 bg-vylta-gold/40" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-vylta-muted">
          Pagos a proveedores
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-xl border border-border bg-vylta-surface shadow-card overflow-hidden">
        {/* Header con totales */}
        <div className="grid grid-cols-3 gap-4 border-b border-border bg-vylta-card/40 p-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
              Recurrente mensual
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums tracking-tightest text-vylta-bone">
              ${monthlyRecurring.toLocaleString('es-MX')}
              <span className="text-xs text-vylta-muted ml-1.5">MXN</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
              Próximos 30 días
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums tracking-tightest text-vylta-gold">
              ${next30DaysTotal.toLocaleString('es-MX')}
              <span className="text-xs text-vylta-muted ml-1.5">MXN</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
              Vencidos
            </div>
            <div className={cn(
              'mt-1 text-2xl font-bold tabular-nums tracking-tightest',
              overdueCount > 0 ? 'text-vylta-rose' : 'text-vylta-muted'
            )}>
              {overdueCount}
              {overdueCount > 0 && (
                <AlertTriangle className="inline h-4 w-4 ml-2 mb-1 animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="p-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 mb-2 rounded shimmer" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="h-8 w-8 mx-auto text-vylta-subtle mb-2" />
            <div className="text-sm text-vylta-muted">
              Sin pagos pendientes registrados
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Frecuencia</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const due = new Date(p.due_date);
                const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / 86400000);
                const isOverdue = p.status === 'overdue';
                const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 transition-colors hover:bg-vylta-card/30"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-vylta-bone">{p.vendor_name}</div>
                      {p.notes && (
                        <div className="text-[10px] text-vylta-muted mt-0.5 line-clamp-1">
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider',
                        CATEGORY_COLORS[p.category] || 'text-vylta-muted'
                      )}>
                        {CATEGORY_LABELS[p.category] || p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-vylta-muted capitalize">
                        {p.frequency === 'monthly'   ? 'Mensual'
                        : p.frequency === 'annual'    ? 'Anual'
                        : p.frequency === 'quarterly' ? 'Trimestral'
                        : 'Una vez'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-bold tabular-nums text-vylta-bone">
                        ${Number(p.amount_mxn).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        <span className="text-[10px] text-vylta-muted ml-1">{p.currency}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs',
                        isOverdue ? 'text-vylta-rose font-bold'
                        : isUrgent ? 'text-vylta-gold font-bold'
                        : 'text-vylta-muted'
                      )}>
                        {isOverdue
                          ? <AlertTriangle className="h-3.5 w-3.5" />
                          : isUrgent
                            ? <Clock className="h-3.5 w-3.5" />
                            : <Calendar className="h-3.5 w-3.5 opacity-60" />
                        }
                        {due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        {!isOverdue && (
                          <span className="text-[10px] tabular-nums">
                            ({daysUntilDue >= 0 ? `${daysUntilDue}d` : `-${Math.abs(daysUntilDue)}d`})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ArrowUpRight className="h-3.5 w-3.5 text-vylta-subtle opacity-0 group-hover:opacity-100" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
