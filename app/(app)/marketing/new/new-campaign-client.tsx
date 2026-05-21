'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Megaphone,
  Users,
  UserCheck,
  UserX,
  Mail,
  Eye,
  Send,
  Save,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
// NewCampaignClient — Form para crear/editar/duplicar campaña.
//
// ⚡ FASE 3 (May 19 2026):
//   Ahora soporta 3 modos de entrada vía query params:
//
//     1. CREAR (sin params): form vacío, segment='todos'
//     2. EDITAR BORRADOR (?draftId=X&subject=Y&body=Z&segment=W):
//        form precargado, los Save/Send hacen UPDATE en lugar de INSERT
//     3. DUPLICAR (?subject=Y&body=Z&segment=W, sin draftId):
//        form precargado pero el Save/Send hacen INSERT nuevo
//
//   El flag isEditingDraft distingue 2 y 3.
// ══════════════════════════════════════════════════════════════════════

type Segment = 'todos' | 'activos' | 'inactivos';

interface SegmentOption {
  value: Segment;
  label: string;
  description: string;
  icon: typeof Users;
}

const SEGMENTS: SegmentOption[] = [
  { value: 'todos',     label: 'Todos los clientes', description: 'Con email registrado',     icon: Users },
  { value: 'activos',   label: 'Solo activos',        description: 'Con visita reciente',      icon: UserCheck },
  { value: 'inactivos', label: 'Solo inactivos',      description: 'Sin visita en 90+ días',   icon: UserX },
];

const VARIABLES = [
  { token: '{{nombre}}',  label: 'Nombre del cliente' },
  { token: '{{negocio}}', label: 'Tu negocio' },
];

export function NewCampaignClient({
  userId,
  businessName,
}: {
  userId: string;
  businessName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Leer params (puede venir de "Continuar editando" o "Duplicar")
  const draftId = searchParams.get('draftId') || '';
  const initialSubject = searchParams.get('subject') || '';
  const initialBody = searchParams.get('body') || '';
  const initialSegRaw = searchParams.get('segment') || 'todos';
  const initialSegment: Segment =
    (['todos', 'activos', 'inactivos'].includes(initialSegRaw) ? initialSegRaw : 'todos') as Segment;

  const isEditingDraft = !!draftId;
  // isDuplicating: hay datos precargados pero no es borrador (es duplicado de enviada/fallida)
  const isDuplicating = !draftId && (!!initialSubject || !!initialBody);

  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  // Contar destinatarios cada vez que cambia el segmento
  useEffect(() => {
    let cancelled = false;

    async function countRecipients() {
      setLoadingCount(true);
      setRecipientCount(null);

      const supabase = createClient();
      let query = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('email', 'is', null)
        .neq('email', '');

      if (segment === 'activos') {
        query = query.eq('is_active', true);
      } else if (segment === 'inactivos') {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        query = query.lt('last_visit', `${yyyy}-${mm}-${dd}`);
      }

      const { count, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error('[NewCampaign] count error:', error);
        setRecipientCount(0);
      } else {
        setRecipientCount(count || 0);
      }
      setLoadingCount(false);
    }

    countRecipients();
    return () => { cancelled = true; };
  }, [segment, userId]);

  const previewSubject = useMemo(
    () => subject.replace(/\{\{nombre\}\}/g, 'María').replace(/\{\{negocio\}\}/g, businessName),
    [subject, businessName],
  );
  const previewBody = useMemo(
    () => body.replace(/\{\{nombre\}\}/g, 'María').replace(/\{\{negocio\}\}/g, businessName),
    [body, businessName],
  );

  function insertVariable(token: string) {
    setBody(prev => (prev ? prev + ' ' + token : token));
  }

  function validate(): string | null {
    if (!subject.trim()) return 'El asunto del email es requerido';
    if (!body.trim())    return 'El contenido del email es requerido';
    if (recipientCount === 0) {
      return 'No hay clientes con email registrado para este segmento. Agrega emails a tus clientes desde su perfil.';
    }
    return null;
  }

  // GUARDAR BORRADOR (INSERT o UPDATE)
  async function handleSaveDraft() {
    if (!subject.trim() && !body.trim()) {
      toast.error('Agrega al menos un asunto o contenido para guardar el borrador');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    let error: any = null;
    if (isEditingDraft) {
      // UPDATE del borrador existente
      const res = await supabase
        .from('email_campaigns')
        .update({
          subject: subject.trim() || '(Sin asunto)',
          body: body.trim(),
          segment,
          recipient_count: recipientCount || 0,
        })
        .eq('id', draftId)
        .eq('user_id', userId);
      error = res.error;
    } else {
      // INSERT nuevo borrador
      const res = await supabase.from('email_campaigns').insert({
        user_id: userId,
        subject: subject.trim() || '(Sin asunto)',
        body: body.trim(),
        segment,
        status: 'borrador',
        recipient_count: recipientCount || 0,
      });
      error = res.error;
    }

    setSaving(false);

    if (error) {
      toast.error('No pudimos guardar el borrador: ' + error.message);
      return;
    }

    toast.success(isEditingDraft ? 'Borrador actualizado' : 'Borrador guardado');
    router.push('/marketing');
    router.refresh();
  }

  // ENVIAR CAMPAÑA
  async function handleSend() {
    setConfirmSendOpen(false);
    setSending(true);

    const supabase = createClient();

    let payload: any;
    if (isEditingDraft) {
      // Primero actualizar el borrador para que send-campaign use el contenido más reciente
      await supabase
        .from('email_campaigns')
        .update({
          subject: subject.trim(),
          body: body.trim(),
          segment,
          recipient_count: recipientCount || 0,
        })
        .eq('id', draftId)
        .eq('user_id', userId);
      payload = { campaignId: draftId };
    } else {
      payload = {
        userId,
        subject: subject.trim(),
        body: body.trim(),
        segment,
        recipientCount: recipientCount || 0,
      };
    }

    const { data, error } = await supabase.functions.invoke('send-campaign', { body: payload });

    setSending(false);

    if (data?.error) {
      toast.error('Error al enviar: ' + data.error);
      return;
    }

    if (error && !data) {
      toast.error('No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
      return;
    }

    if (error) {
      toast.error('Error al enviar la campaña: ' + error.message);
      return;
    }

    const sentCount = data?.sent || recipientCount || 0;
    toast.success(`¡Campaña enviada a ${sentCount} cliente${sentCount !== 1 ? 's' : ''}!`);
    router.push('/marketing');
    router.refresh();
  }

  function attemptSend() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setConfirmSendOpen(true);
  }

  function attemptPreview() {
    if (!subject.trim() && !body.trim()) {
      toast.error('Agrega contenido para ver la vista previa');
      return;
    }
    setPreviewOpen(true);
  }

  const canSend = !sending && !saving && recipientCount !== null && recipientCount > 0;

  // Título y subtítulo según el modo
  const pageTitle = isEditingDraft ? 'Editar borrador' : isDuplicating ? 'Duplicar campaña' : 'Nueva campaña';
  const pageSubtitle = isEditingDraft
    ? 'Continúa donde lo dejaste'
    : isDuplicating
      ? 'Crea una nueva campaña basada en una anterior'
      : 'Envía un email a tus clientes';

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
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">{pageTitle}</h1>
            <p className="text-sm text-vylta-muted">{pageSubtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || sending}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            ) : (
              <><Save className="h-4 w-4" /> {isEditingDraft ? 'Guardar cambios' : 'Guardar borrador'}</>
            )}
          </Button>
        </div>
      </div>

      {/* BANNER DE MODO */}
      {isEditingDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-vylta-amber-500/30 bg-vylta-amber-500/10 px-3 py-2 text-sm text-vylta-amber-500">
          <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>Estás editando un borrador existente. Los cambios sobrescribirán el borrador.</span>
        </div>
      )}
      {isDuplicating && (
        <div className="flex items-center gap-2 rounded-lg border border-vylta-green/30 bg-vylta-green/10 px-3 py-2 text-sm text-vylta-green">
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>Esta es una copia. Se creará una campaña nueva al enviar o guardar.</span>
        </div>
      )}

      {/* DESTINATARIOS */}
      <section className="space-y-3">
        <SectionLabel>Destinatarios</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SEGMENTS.map((opt) => (
            <SegmentButton
              key={opt.value}
              option={opt}
              active={segment === opt.value}
              onClick={() => setSegment(opt.value)}
            />
          ))}
        </div>
        <RecipientBanner count={recipientCount} loading={loadingCount} />
      </section>

      {/* ASUNTO */}
      <section className="space-y-2">
        <SectionLabel>Asunto del email</SectionLabel>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ej: ¡Oferta especial solo para ti!"
          className="h-11 bg-vylta-card/60"
          maxLength={200}
        />
      </section>

      {/* CONTENIDO */}
      <section className="space-y-2">
        <SectionLabel>Contenido</SectionLabel>
        <div className="rounded-lg border border-border bg-vylta-card/60 focus-within:border-vylta-green/50 focus-within:ring-2 focus-within:ring-vylta-green/15 transition-colors">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe el contenido de tu email. Puedes usar variables como {{nombre}} y {{negocio}} para personalizar."
            className="w-full resize-y bg-transparent px-3 py-2 text-sm text-vylta-bone outline-none placeholder:text-vylta-subtle min-h-[160px] leading-relaxed"
            rows={8}
            maxLength={5000}
          />
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vylta-subtle mr-1">
              Variables:
            </span>
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVariable(v.token)}
                className="inline-flex items-center gap-1 rounded-md border border-vylta-green/30 bg-vylta-green/10 px-2 py-0.5 text-[11px] font-semibold text-vylta-green transition-colors hover:bg-vylta-green/20"
                title={v.label}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {v.token}
              </button>
            ))}
            <button
              type="button"
              onClick={attemptPreview}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-vylta-muted transition-colors hover:bg-vylta-card hover:text-vylta-bone"
            >
              <Eye className="h-2.5 w-2.5" />
              Vista previa
            </button>
          </div>
        </div>
        <p className="text-[11px] text-vylta-subtle">
          Las variables se reemplazan automáticamente al enviar el email.
        </p>
      </section>

      {/* BOTÓN ENVIAR */}
      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={attemptSend} disabled={!canSend} className="min-w-[200px]">
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar ahora
              {recipientCount !== null && recipientCount > 0 && (
                <span className="ml-1 text-xs opacity-75">· {recipientCount}</span>
              )}
            </>
          )}
        </Button>
      </div>

      {/* MODAL VISTA PREVIA */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa del email</DialogTitle>
            <DialogDescription>
              Así se verá el email cuando lo envíes. El nombre “María” es solo un ejemplo.
            </DialogDescription>
          </DialogHeader>
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
              <p className="text-center text-[11px] text-slate-400">Enviado con VYLTA</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ENVÍO */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-vylta-amber-500" />
              Confirmar envío
            </DialogTitle>
            <DialogDescription className="pt-2">
              Esta campaña se enviará a{' '}
              <strong className="text-vylta-bone">
                {recipientCount} cliente{recipientCount !== 1 ? 's' : ''}
              </strong>{' '}
              con email registrado. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-vylta-card/40 p-3">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 text-vylta-green mt-0.5" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-vylta-bone">
                  {subject || '(Sin asunto)'}
                </div>
                <div className="text-xs text-vylta-muted mt-0.5">
                  Segmento: {SEGMENTS.find(s => s.value === segment)?.label}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend}>
              <Send className="h-4 w-4" />
              Sí, enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function SegmentButton({
  option, active, onClick,
}: { option: SegmentOption; active: boolean; onClick: () => void }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
        active
          ? 'border-vylta-green/40 bg-vylta-green/10 ring-1 ring-vylta-green/20'
          : 'border-border bg-vylta-card/40 hover:border-vylta-green/20 hover:bg-vylta-card',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-vylta-green/20 text-vylta-green' : 'bg-vylta-card text-vylta-muted',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-semibold', active ? 'text-vylta-bone' : 'text-vylta-muted')}>
          {option.label}
        </div>
        <div className="text-[11px] text-vylta-subtle mt-0.5">{option.description}</div>
      </div>
      {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-vylta-green" />}
    </button>
  );
}

function RecipientBanner({
  count, loading,
}: { count: number | null; loading: boolean }) {
  const isZero = count === 0;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        isZero
          ? 'border-vylta-amber-500/30 bg-vylta-amber-500/10 text-vylta-amber-500'
          : 'border-vylta-green/30 bg-vylta-green/10 text-vylta-green',
      )}
    >
      <Mail className="h-4 w-4 shrink-0" strokeWidth={2} />
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Contando destinatarios…</span>
        </>
      ) : count === null ? (
        <span>—</span>
      ) : isZero ? (
        <span>
          <strong>0 destinatarios.</strong> Agrega emails a tus clientes desde su perfil.
        </span>
      ) : (
        <span>
          <strong className="font-bold">{count}</strong> cliente{count !== 1 ? 's' : ''} con email registrado
        </span>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">
      {children}
    </Label>
  );
}
