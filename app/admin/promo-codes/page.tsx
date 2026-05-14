'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ticket,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Infinity as InfinityIcon,
  X,
  Dice5,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// /admin/promo-codes — CRUD de códigos promocionales
//
// Schema de tabla `promo_codes`:
//   - id, code, discount_type ('full' | 'percent'), discount_value
//   - duration_days (interpretado como MESES en negocio)
//   - max_uses, current_uses, is_active, notes, stripe_promo_code_id
//
// El código se crea vía Edge Function `create-promo-code` que también
// crea el cupón en Stripe automáticamente. Sin Stripe el código NO
// funcionará en checkout, pero la BD queda registrada.
// ══════════════════════════════════════════════════════════════════════

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  duration_days: number | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  notes: string | null;
  stripe_promo_code_id: string | null;
  created_at: string;
}

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  async function loadCodes() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[PromoCodes]', error);
      toast.error('Error cargando códigos');
    }
    setCodes((data || []) as PromoCode[]);
    setLoading(false);
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !currentlyActive })
      .eq('id', id);
    if (error) {
      toast.error('Error actualizando estado');
      return;
    }
    toast.success(currentlyActive ? 'Código desactivado' : 'Código activado');
    loadCodes();
  }

  async function copyToClipboard(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  const stats = {
    total: codes.length,
    active: codes.filter((c) => c.is_active).length,
    used: codes.reduce((sum, c) => sum + c.current_uses, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-vylta-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone flex items-center gap-2">
              <Ticket className="h-6 w-6 text-vylta-gold" />
              Códigos promocionales
            </h1>
            <p className="text-sm text-vylta-muted mt-0.5">
              {stats.total} {stats.total === 1 ? 'código' : 'códigos'} · {stats.active} activos · {stats.used} usos totales
            </p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo código
        </Button>
      </div>

      {/* INFO BANNER */}
      <div className="rounded-xl border border-vylta-sky/25 bg-vylta-sky/5 p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-vylta-sky mt-0.5" />
          <div>
            <div className="text-sm font-bold text-vylta-sky">Integración con Stripe</div>
            <p className="text-xs text-vylta-muted mt-0.5">
              Los códigos se crean automáticamente en Stripe vía Edge Function.
              Si Stripe no responde, el código queda en BD pero NO funcionará en checkout (badge amarillo).
            </p>
          </div>
        </div>
      </div>

      {/* LISTA */}
      {codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-vylta-card/30 py-16 text-center">
          <Ticket className="h-10 w-10 text-vylta-subtle mb-3" />
          <h3 className="text-sm font-bold text-vylta-bone">Sin códigos aún</h3>
          <p className="text-xs text-vylta-muted mt-1">Crea el primer código para ofrecer descuentos.</p>
          <Button className="mt-4" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-3 w-3" />
            Crear primer código
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {codes.map((c) => (
            <PromoCodeCard
              key={c.id}
              code={c}
              copied={copiedId === c.id}
              onCopy={() => copyToClipboard(c.code, c.id)}
              onToggleActive={() => toggleActive(c.id, c.is_active)}
            />
          ))}
        </div>
      )}

      {/* DIALOG NUEVO CÓDIGO */}
      <NewPromoCodeDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          setFormOpen(false);
          loadCodes();
        }}
      />
    </div>
  );
}

function PromoCodeCard({
  code, copied, onCopy, onToggleActive,
}: {
  code: PromoCode;
  copied: boolean;
  onCopy: () => void;
  onToggleActive: () => void;
}) {
  const isFree = code.discount_value >= 100;
  const isPermanent = !code.duration_days;
  const isUnlimited = code.max_uses >= 999;
  const usagePercent = isUnlimited ? 0 : (code.current_uses / code.max_uses) * 100;
  const exhausted = !isUnlimited && code.current_uses >= code.max_uses;
  const hasStripe = !!code.stripe_promo_code_id;

  const createdDate = new Date(code.created_at);
  const createdLabel = createdDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-vylta-surface p-4 shadow-card transition-all',
        code.is_active && !exhausted
          ? 'border-vylta-gold/30 hover:border-vylta-gold/50'
          : 'border-border opacity-70',
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-vylta-gold/8 blur-2xl opacity-60" />

      <div className="relative space-y-3">
        {/* Código + copy */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onCopy}
            className="group/code flex items-center gap-1.5 text-left"
            title="Copiar código"
          >
            <span className="font-mono text-lg font-bold tracking-wider text-vylta-gold">{code.code}</span>
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-vylta-green" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-vylta-subtle opacity-0 group-hover/code:opacity-100 transition-opacity" />
            )}
          </button>
          {!code.is_active && (
            <span className="inline-flex items-center gap-0.5 rounded bg-vylta-card px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-muted">
              <X className="h-2.5 w-2.5" />
              Inactivo
            </span>
          )}
          {exhausted && (
            <span className="inline-flex items-center gap-0.5 rounded bg-vylta-rose/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-rose">
              Agotado
            </span>
          )}
        </div>

        {/* Descripción / notas */}
        {code.notes && (
          <p className="text-xs text-vylta-muted line-clamp-2">{code.notes}</p>
        )}

        {/* Badges descuento + duración */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
              isFree
                ? 'bg-vylta-green/10 text-vylta-green border-vylta-green/30'
                : 'bg-vylta-gold/10 text-vylta-gold border-vylta-gold/30',
            )}
          >
            {isFree ? '🆓 Gratis' : `${code.discount_value}% off`}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
              isPermanent
                ? 'bg-vylta-luxury/10 text-vylta-luxury border-vylta-luxury/30'
                : 'bg-vylta-sky/10 text-vylta-sky border-vylta-sky/30',
            )}
          >
            {isPermanent ? (
              <>
                <InfinityIcon className="h-2.5 w-2.5" />
                Permanente
              </>
            ) : (
              <>
                <Calendar className="h-2.5 w-2.5" />
                {code.duration_days === 1 ? '1 mes' : code.duration_days === 12 ? '1 año' : `${code.duration_days} meses`}
              </>
            )}
          </span>
        </div>

        {/* Usos */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-vylta-muted">Usos</span>
            <span className="font-bold tabular-nums text-vylta-bone">
              {code.current_uses}/{isUnlimited ? '∞' : code.max_uses}
            </span>
          </div>
          {!isUnlimited && (
            <div className="h-1 overflow-hidden rounded-full bg-vylta-card">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  exhausted ? 'bg-vylta-rose' : usagePercent > 70 ? 'bg-vylta-amber' : 'bg-vylta-green',
                )}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            {hasStripe ? (
              <span
                className="inline-flex items-center gap-0.5 rounded bg-vylta-green/10 px-1.5 py-0.5 text-[9px] font-bold text-vylta-green"
                title="Sincronizado con Stripe"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                Stripe
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-0.5 rounded bg-vylta-amber/10 px-1.5 py-0.5 text-[9px] font-bold text-vylta-amber"
                title="Solo en BD, no funcionará en checkout"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Solo BD
              </span>
            )}
            <span className="text-[10px] text-vylta-subtle">{createdLabel}</span>
          </div>
          <button
            onClick={onToggleActive}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-bold transition',
              code.is_active
                ? 'bg-vylta-rose/10 text-vylta-rose hover:bg-vylta-rose/20'
                : 'bg-vylta-green/10 text-vylta-green hover:bg-vylta-green/20',
            )}
          >
            {code.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPromoCodeDialog({
  open, onOpenChange, onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [discountValue, setDiscountValue] = useState('50');
  const [isPermanent, setIsPermanent] = useState(false);
  const [durationMonths, setDurationMonths] = useState('1');
  const [maxUses, setMaxUses] = useState('1');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setCode('');
    setNotes('');
    setIsFree(true);
    setDiscountValue('50');
    setIsPermanent(false);
    setDurationMonths('1');
    setMaxUses('1');
  }

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const result = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setCode(`VYLTA-${result}`);
  }

  async function handleSave() {
    if (!code.trim()) {
      toast.error('El código es requerido');
      return;
    }
    const months = parseInt(durationMonths);
    if (!isPermanent && (!months || months < 1 || months > 12)) {
      toast.error('La duración debe ser entre 1 y 12 meses');
      return;
    }
    const max = parseInt(maxUses);
    if (!max || max < 1) {
      toast.error('El número de usos debe ser al menos 1');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    try {
      const { data, error } = await supabase.functions.invoke('create-promo-code', {
        body: {
          code: code.trim().toUpperCase(),
          discountType: isFree ? 'full' : 'percent',
          discountValue: isFree ? 100 : parseInt(discountValue),
          durationMonths: isPermanent ? null : months,
          maxUses: max,
          notes: notes.trim(),
          createdBy: user?.id,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success('Código creado en Stripe ✅');
      resetForm();
      onSuccess();
    } catch (err: any) {
      console.error('[CreatePromoCode]', err);
      toast.error(err?.message || 'Error al crear el código');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-vylta-bone">
            <Ticket className="h-5 w-5 text-vylta-gold" />
            Nuevo código promocional
          </DialogTitle>
          <DialogDescription className="text-vylta-muted">
            Se creará automáticamente en Stripe y estará listo para usar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Código */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-vylta-muted">
              Código <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VYLTA-XXXXXXXX"
                className="font-mono uppercase"
              />
              <Button type="button" variant="outline" onClick={generateCode} size="sm">
                <Dice5 className="h-3.5 w-3.5" />
                Auto
              </Button>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-vylta-muted">Notas internas</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Beta tester, cliente VIP, promo verano..."
            />
            <p className="text-[10px] text-vylta-subtle">Solo visible para admins. Para tu referencia.</p>
          </div>

          {/* Tipo de descuento */}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-vylta-card/30 p-3">
            <div>
              <div className="text-sm font-bold text-vylta-bone">100% gratis</div>
              <div className="text-[11px] text-vylta-muted">El usuario no paga durante la duración</div>
            </div>
            <button
              onClick={() => setIsFree(!isFree)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                isFree ? 'bg-vylta-green' : 'bg-vylta-card',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow',
                  isFree ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {!isFree && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Porcentaje de descuento</Label>
              <Input
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/\D/g, ''))}
                placeholder="50"
                inputMode="numeric"
              />
              <p className="text-[10px] text-vylta-subtle">Ej: 50 = 50% off, 25 = 25% off</p>
            </div>
          )}

          {/* Duración */}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-vylta-card/30 p-3">
            <div>
              <div className="text-sm font-bold text-vylta-bone">Permanente</div>
              <div className="text-[11px] text-vylta-muted">El descuento aplica en todos los meses sin límite</div>
            </div>
            <button
              onClick={() => setIsPermanent(!isPermanent)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                isPermanent ? 'bg-vylta-luxury' : 'bg-vylta-card',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow',
                  isPermanent ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {!isPermanent && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Duración en meses</Label>
              <div className="flex flex-wrap gap-2">
                {['1', '2', '3', '6', '12'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDurationMonths(m)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-bold transition',
                      durationMonths === m
                        ? 'border-vylta-sky/40 bg-vylta-sky/10 text-vylta-sky'
                        : 'border-border bg-vylta-card/30 text-vylta-muted hover:bg-vylta-card',
                    )}
                  >
                    {m === '1' ? '1 mes' : m === '12' ? '1 año' : `${m} meses`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Max usos */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-vylta-muted">Número máximo de usos</Label>
            <Input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))}
              placeholder="1"
              inputMode="numeric"
            />
            <p className="text-[10px] text-vylta-subtle">Cuántos usuarios pueden canjear este código (usa 999 para ilimitado)</p>
          </div>

          {/* Resumen */}
          <div className="rounded-lg border border-vylta-gold/30 bg-vylta-gold/5 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-vylta-gold mb-1">Resumen</div>
            <div className="text-sm font-semibold text-vylta-bone">
              {isFree ? '100% gratis' : `${discountValue || '0'}% de descuento`}
              {' · '}
              {isPermanent ? 'permanente' : durationMonths === '1' ? '1 mes' : durationMonths === '12' ? '1 año' : `${durationMonths} meses`}
              {' · '}
              máx {maxUses || '0'} {parseInt(maxUses) === 1 ? 'uso' : 'usos'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Crear en Stripe
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
