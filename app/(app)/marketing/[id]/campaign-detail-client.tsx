'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Megaphone,
  Pencil,
  Copy,
  Trash2,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ══════════════════════════════════════════════════════════════════════
// CampaignDetailClient — detalle de campaña con preview + acciones.
//
// ACCIONES SEGÚN STATUS:
//   • borrador  → "Continuar editando" → navega a /marketing/new?draftId=...
//   • enviada   → "Duplicar campaña"   → navega a /marketing/new?subject=...&body=...
//   • fallida   → "Reintentar campaña" → navega a /marketing/new?subject=...&body=...
//
// SIEMPRE disponible:
//   • Eliminar (con modal de confirmación).
// ══════════════════════════════════════════════════════════════════════

interface Campaign {
  id: string;
  subject: string;
  body: string;
  segment: 'todos' | 'activos' | 'inactivos';
  status: 'enviada' | 'borrador' | 'fallida';
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  todos: 'Todos los clientes',
  activos: 'Solo activos',
  inactivos: 'Solo inactivos',
};

const STATUS_META: Record<
  string,
  { label: string; icon: any; bgClass: string; textClass: string; ringClass: string }
> = {
  enviada: {
    label: 'Enviada',
    icon: CheckCircle2,
    bgClass: 'bg-vylta-green/10',
    textClass: 'text-vylta-green',
    ringClass: 'ring-vylta-green/30',
  },
  borrador: {
    label: 'Borrador',
    icon: Pencil,
    bgClass: 'bg-vylta-amber-500/10',
    textClass: 'text-vylta-amber-500',
    ringClass: 'ring-vylta-amber-500/30',
  },
  fallida: {
    label: 'Fallida',
    icon: XCircle,
    bgClass: 'bg-destructive/10',
    textClass: 'text-destructive',
    ringClass: 'ring-destructive/30',
  },
};

export function CampaignDetailClient({
  campaign,
  businessName,
  userId,
}: {
  campaign: Campaign;
  businessName: string;
  userId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isDraft = campaign.status === 'borrador';
  const isSent  = campaign.status === 'enviada';
  const isFailed = campaign.status === 'fallida';

  const statusMeta = STATUS_META[campaign.status] || STATUS_META.borrador;
  const StatusIcon = statusMeta.icon;

  // Preview con sustituciones demo ("María")
  const previewSubject = useMemo(
    () => campaign.subject
      .replace(/\{\{nombre\}\}/g, 'María')
      .replace(/\{\{negocio\}\}/g, businessName),
    [campaign.subject, businessName],
  );
  const previewBody = useMemo(
    () => campaign.body
      .replace(/\{\{nombre\}\}/g, 'María')
      .replace(/\{\{negocio\}\}/g, businessName),
    [campaign.body, businessName],
  );

  // CONTINUAR EDITANDO (borrador): pasa draftId para que el form haga UPDATE en vez de INSERT
  function handleEditDraft() {
    const url = `/marketing/new?draftId=${encodeURIComponent(campaign.id)}` +
      `&subject=${encodeURIComponent(campaign.subject)}` +
      `&body=${encodeURIComponent(campaign.body)}` +
      `&segment=${encodeURIComponent(campaign.segment)}`;
    router.push(url);
  }

  // DUPLICAR (campaña enviada o fallida): NO pasa draftId, será una campaña nueva
  function handleDuplicate() {
    const url = `/marketing/new?subject=${encodeURIComponent(campaign.subject)}` +
      `&body=${encodeURIComponent(campaign.body)}` +
      `&segment=${encodeURIComponent(campaign.segment)}`;
    router.push(url);
  }

  // ELIMINAR
  async function handleDelete() {
    setConfirmDeleteOpen(false);
    setDeleting(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', campaign.id)
      .eq('user_id', userId);

    setDeleting(false);

    if (error) {
      toast.error('No pudimos eliminar la campaña: ' + error.message);
      return;
    }

    toast.success('Campaña eliminada');
    router.push('/marketing');
    router.refresh();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/marketing"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-vylta-card transition-colors hover:bg-vylta-card/60"
            aria-label="Volver a Marketing"
          >
            <ArrowLeft className="h-5 w-5 text-vylta-muted" strokeWidth={2} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">
              Detalle de campaña
            </h1>
            <p className="text-sm text-vylta-muted">
              {isDraft ? 'Borrador sin enviar' : isSent ? 'Campaña enviada' : 'Campaña fallida'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
            className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            {deleting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando…</>
            ) : (
              <><Trash2 className="h-4 w-4" /> Eliminar</>
            )}
          </Button>
        </div>
      </div>

      {/* STATUS CARD */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border p-4 ring-1',
          statusMeta.bgClass,
          statusMeta.ringClass,
        )}
      >
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', 'bg-vylta-surface')}>
          <StatusIcon className={cn('h-5 w-5', statusMeta.textClass)} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('text-sm font-bold', statusMeta.textClass)}>
            {statusMeta.label}
          </div>
          <div className="text-xs text-vylta-muted mt-0.5">
            {isSent
              ? `Enviada el ${formatLongDate(campaign.sent_at)}`
              : `Creada el ${formatLongDate(campaign.created_at)}`}
          </div>
        </div>
        {isSent && (
          <div className="flex items-center gap-1.5 rounded-full bg-vylta-surface px-3 py-1 ring-1 ring-vylta-green/30">
            <Users className="h-3.5 w-3.5 text-vylta-green" />
            <span className="text-xs font-bold text-vylta-green tabular-nums">
              {campaign.recipient_count}
            </span>
          </div>
        )}
      </div>

      {/* INFO RAPIDA (segmento) */}
      <section className="space-y-2">
        <SectionLabel>Segmento</SectionLabel>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-vylta-surface p-4 shadow-card">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <Filter className="h-4 w-4 text-vylta-green" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold text-vylta-bone">
            {SEGMENT_LABELS[campaign.segment] || campaign.segment}
          </span>
        </div>
      </section>

      {/* VISTA PREVIA */}
      <section className="space-y-2">
        <SectionLabel>Vista previa del email</SectionLabel>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center gap-2.5 bg-vylta-green px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">{businessName}</span>
          </div>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-base font-bold text-slate-900">
              {previewSubject || '(sin asunto)'}
            </h3>
          </div>
          <div className="mx-4 h-px bg-slate-200" />
          <div className="whitespace-pre-wrap px-4 py-4 text-sm text-slate-700 leading-relaxed">
            {previewBody || '(sin contenido)'}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
            <p className="text-center text-[11px] text-slate-400">
              Enviado con VYLTA
            </p>
          </div>
        </div>
        <p className="text-[11px] text-vylta-subtle italic">
          {isSent
            ? 'Así se vio el email enviado. El nombre “María” es solo un ejemplo de personalización.'
            : 'Así se verá el email cuando se envíe. El nombre “María” es solo un ejemplo de personalización.'}
        </p>
      </section>

      {/* ACCIONES PRINCIPALES */}
      <div className="flex justify-end pt-2">
        {isDraft && (
          <Button size="lg" onClick={handleEditDraft} className="min-w-[220px]">
            <Pencil className="h-4 w-4" />
            Continuar editando
          </Button>
        )}
        {isSent && (
          <Button size="lg" onClick={handleDuplicate} className="min-w-[220px]">
            <Copy className="h-4 w-4" />
            Duplicar campaña
          </Button>
        )}
        {isFailed && (
          <Button size="lg" onClick={handleDuplicate} className="min-w-[220px]">
            <Send className="h-4 w-4" />
            Reintentar campaña
          </Button>
        )}
      </div>

      {/* MODAL CONFIRMAR ELIMINAR */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Eliminar campaña
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Seguro que deseas eliminar{' '}
              <strong className="text-vylta-bone">
                “{campaign.subject || 'Sin asunto'}”
              </strong>
              ? Esta acción no se puede deshacer.
              {isSent && (
                <span className="block mt-2 text-vylta-amber-500">
                  Esta campaña ya fue enviada. Eliminarla solo borra el registro histórico;
                  los emails ya enviados no se pueden recuperar.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">
      {children}
    </div>
  );
}

/**
 * Formato largo de fecha: "4 de mayo de 2026, 15:30".
 * Maneja ambos: timestamps ISO completos y YYYY-MM-DD.
 */
function formatLongDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.includes('T') ? new Date(value) : new Date(value + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
