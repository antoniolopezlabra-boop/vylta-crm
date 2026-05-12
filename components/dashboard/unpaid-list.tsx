'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import type { UnpaidAppointment } from '@/lib/home-stats';

export function UnpaidList({ appointments }: { appointments: UnpaidAppointment[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [paying, setPaying] = useState<string | null>(null);

  async function markAsPaid(id: string, name: string, amount: number) {
    const ok = confirm(`Registrar pago de ${name}${amount ? ' — ' + formatCurrency(amount) : ''}?`);
    if (!ok) return;
    setPaying(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'Pagado', updated_at: new Date().toISOString() })
      .eq('id', id);
    setPaying(null);
    if (error) {
      toast.error('No se pudo registrar el pago: ' + error.message);
      return;
    }
    toast.success('Pago registrado');
    startTransition(() => router.refresh());
  }

  return (
    <ul className="divide-y divide-vylta-amber-500/20 border-t border-vylta-amber-500/20 bg-card/60">
      {appointments.map((a) => {
        const dateLabel = new Date(a.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        const isPaying = paying === a.id;
        return (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-vylta-amber-500/5">
            <Link href={`/citas/${a.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {a.staff && (
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.staff.color }} title={a.staff.name} />
                )}
                <span className="truncate text-sm font-semibold">{a.client_name}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {a.service_name}{a.staff ? ' · ' + a.staff.name : ''} · {dateLabel} {a.start_time?.slice(0, 5)}
              </div>
            </Link>
            {a.service_cost ? (
              <span className="shrink-0 text-sm font-bold tabular-nums text-vylta-green-600 dark:text-vylta-green-400">
                {formatCurrency(a.service_cost)}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => markAsPaid(a.id, a.client_name, a.service_cost || 0)}
              disabled={isPaying}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-lg bg-vylta-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-vylta-amber-600 disabled:opacity-60',
              )}
            >
              {isPaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Cobrar
            </button>
          </li>
        );
      })}
    </ul>
  );
}
