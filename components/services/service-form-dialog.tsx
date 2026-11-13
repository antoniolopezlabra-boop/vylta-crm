'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Briefcase, Clock, DollarSign, FileText, FolderOpen, Users } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ServiceGroup } from '@/lib/queries/use-service-groups';
import { fetchServiceStaff, saveServiceStaff, type StaffSkill } from '@/lib/staff-services';

// ══════════════════════════════════════════════════════════════════════
// Form servicio — schema alineado con BD real:
//   • is_active (no 'active')
//   • La BD NO tiene columna 'color' — lo guardamos solo si existe
//
// ⚡ FIX (Jun 2026): el form de edición mostraba precio 0 / campos vacíos.
//   useForm captura defaultValues una sola vez al montar (con initialService
//   = null porque el dialog vive siempre montado en la página). Al elegir un
//   servicio el prop cambiaba pero el form no se re-inicializaba. Ahora un
//   useEffect hace reset() con los valores del servicio cada vez que se abre.
// ══════════════════════════════════════════════════════════════════════

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Nombre mínimo 2 caracteres'),
  description: z.string().optional(),
  duration_minutes: z
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(5, 'Mínimo 5 minutos')
    .max(720, 'Máximo 12 horas'),
  price: z
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo')
    .max(999999, 'Precio demasiado alto'),
  is_active: z.boolean(),
  group_id: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialService?: any | null;
  groups?: ServiceGroup[];
  onSuccess?: () => void;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  initialService,
  groups = [],
  onSuccess,
}: ServiceFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialService;
  // ¿Quién realiza este servicio? (solo si el negocio tiene colaboradores)
  const [staff, setStaff] = useState<StaffSkill[]>([]);
  const [doersBefore, setDoersBefore] = useState<Set<string>>(new Set());
  const [doers, setDoers] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: initialService?.name || '',
      description: initialService?.description || '',
      duration_minutes: initialService?.duration_minutes || 60,
      price: initialService?.price ?? 0,
      is_active: initialService?.is_active ?? true,
      group_id: initialService?.group_id || '',
    },
  });

  // Re-sincroniza el formulario cada vez que se abre (o cambia el servicio
  // seleccionado). Sin esto, el form de edición mostraba precio 0 / vacíos
  // porque defaultValues solo se captura una vez al montar.
  useEffect(() => {
    if (open) {
      reset({
        name: initialService?.name || '',
        description: initialService?.description || '',
        duration_minutes: initialService?.duration_minutes || 60,
        price: initialService?.price ?? 0,
        is_active: initialService?.is_active ?? true,
        group_id: initialService?.group_id || '',
      });
    }
  }, [open, initialService?.id, reset]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchServiceStaff(initialService?.id || null)
      .then(({ staff: list, doers: d }) => {
        if (cancelled) return;
        setStaff(list.filter(m => m.is_active !== false));
        setDoersBefore(new Set(d));
        setDoers(new Set(d));
      })
      .catch(() => { if (!cancelled) setStaff([]); });
    return () => { cancelled = true; };
  }, [open, initialService?.id]);

  function toggleDoer(id: string) {
    setDoers(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const isActive = watch('is_active');

  async function onSubmit(data: ServiceFormData) {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sesión expirada');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      duration_minutes: data.duration_minutes,
      price: data.price,
      is_active: data.is_active,
      group_id: data.group_id || null,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (isEdit && initialService) {
      result = await supabase
        .from('services')
        .update(payload)
        .eq('id', initialService.id)
        .eq('user_id', user.id);
    } else {
      result = await supabase.from('services').insert(payload).select('id').single();
    }

    setSubmitting(false);

    if (result.error) {
      console.error('[ServiceForm] error:', result.error);
      toast.error(isEdit ? 'No pudimos actualizar el servicio' : 'No pudimos crear el servicio');
      return;
    }

    // Guardar quién lo realiza (si cambió algo)
    const serviceId: string | undefined = isEdit ? initialService?.id : (result as any).data?.id;
    if (serviceId && staff.length > 0) {
      try {
        await saveServiceStaff(serviceId, staff, doersBefore, doers);
      } catch (err) {
        console.error('[saveServiceStaff] error:', err);
        toast.error('Se guardó el servicio, pero no quién lo realiza. Intenta de nuevo.');
      }
    }

    toast.success(isEdit ? 'Servicio actualizado' : 'Servicio creado');
    reset();
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los detalles de este servicio.'
              : 'Agrega un servicio a tu catálogo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre" icon={Briefcase} error={errors.name?.message} required>
            <Input {...register('name')} placeholder="Corte de cabello" />
          </Field>

          <Field label="Descripción" icon={FileText} error={errors.description?.message}>
            <Textarea
              {...register('description')}
              placeholder="Detalles que verán tus clientes..."
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Duración (min)"
              icon={Clock}
              error={errors.duration_minutes?.message}
              required
            >
              <Input
                {...register('duration_minutes', { valueAsNumber: true })}
                type="number"
                step={5}
                min={5}
                max={720}
                placeholder="60"
              />
            </Field>

            <Field
              label="Precio (MXN)"
              icon={DollarSign}
              error={errors.price?.message}
              required
            >
              <Input
                {...register('price', { valueAsNumber: true })}
                type="number"
                step={1}
                min={0}
                placeholder="350"
              />
            </Field>
          </div>

          {groups.length > 0 && (
            <Field label="Grupo" icon={FolderOpen}>
              <select
                {...register('group_id')}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin grupo</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>
          )}

          {staff.length > 0 && (
            <Field label="¿Quién realiza este servicio?" icon={Users}>
              <div className="flex flex-wrap gap-2">
                {staff.map(m => {
                  const on = doers.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleDoer(m.id)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        on ? 'border-vylta-green-500 bg-vylta-green-500/10 text-foreground' : 'border-border text-muted-foreground line-through opacity-70 hover:opacity-100',
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color || '#10B981' }} />
                      {m.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {doers.size === 0
                  ? 'Nadie marcado: tus clientes no podrán elegir colaborador para este servicio.'
                  : 'En tu link de reservas solo aparecerán los marcados para este servicio.'}
              </p>
            </Field>
          )}

          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5 transition hover:bg-secondary/60">
                <div>
                  <div className="text-sm font-semibold">Servicio activo</div>
                  <div className="text-xs text-muted-foreground">
                    {isActive
                      ? 'Visible para reservas y en tu link público'
                      : 'Oculto, no aparece en reservas nuevas'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded border-border accent-vylta-green-500"
                />
              </label>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : isEdit ? (
                'Guardar cambios'
              ) : (
                'Crear servicio'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon?: any;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-semibold">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
