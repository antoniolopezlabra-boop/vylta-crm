'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// VendorPaymentsTable (v2 — Tipografia ejecutiva May 22 2026)
//
// ANTONIO REPORTO: "la arial esta muy pequeña me cuesta mucho trabajo leerla"
//
// FIX: subir todas las font-sizes 2 niveles:
//    text-[10px] → text-xs (12px)
//    text-xs    → text-sm (14px)
//    text-sm    → text-base (16px)
//
// Tambien aumenta padding vertical de las celdas para mas respiracion.
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
      <div className="rounded-xl border border-border bg-vylta-surface shadow-card overflow-hidden">
        {/* Header con totales — tipografia subida */}
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

        {/* Tabla con tipografia mas grande */}
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
                      <td className="px-6 py-4">
                        <div className="text-base font-semibold text-vylta-bone">{p.vendor_name}</div>
                        {p.notes && (
                          <div className="text-xs text-vylta-muted mt-1 line-clamp-1">
                            {p.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'text-xs font-bold uppercase tracking-wider',
                          CATEGORY_COLORS[p.category] || 'text-vylta-muted'
                        )}>
                          {CATEGORY_LABELS[p.category] || p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-vylta-muted">
                          {p.frequency === 'monthly'   ? 'Mensual'
                          : p.frequency === 'annual'    ? 'Anual'
                          : p.frequency === 'quarterly' ? 'Trimestral'
                          : 'Una vez'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-base font-bold tabular-nums text-vylta-bone">
                          ${Number(p.amount_mxn).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          <span className="text-xs text-vylta-muted ml-1">{p.currency}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          'flex items-center gap-2 text-sm',
                          isOverdue ? 'text-vylta-rose font-bold'
                          : isUrgent ? 'text-vylta-gold font-bold'
                          : 'text-vylta-muted'
                        )}>
                          {isOverdue
                            ? <AlertTriangle className="h-4 w-4" />
                            : isUrgent
                              ? <Clock className="h-4 w-4" />
                              : <Calendar className="h-4 w-4 opacity-60" />
                          }
                          {due.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          {!isOverdue && (
                            <span className="text-xs tabular-nums">
                              ({daysUntilDue >= 0 ? `${daysUntilDue}d` : `-${Math.abs(daysUntilDue)}d`})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
