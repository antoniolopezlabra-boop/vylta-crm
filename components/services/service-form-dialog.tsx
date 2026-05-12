'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Briefcase, Clock, DollarSign, FileText, Palette } from 'lucide-react';
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

// ══════════════════════════════════════════════════════════════════════
// Formulario crear/editar servicio
// ══════════════════════════════════════════════════════════════════════

const SERVICE_COLORS = [
  '#10B981', // verde VYLTA
  '#6366F1', // indigo
  '#F59E0B', // amber
  '#F472B6', // pink
  '#3B82F6', // blue
  '#A855F7', // purple
  '#14B8A6', // teal
  '#EF4444', // red
];

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
  color: z.string(),
  active: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialService?: any | null;
  onSuccess?: () => void;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  initialService,
  onSuccess,
}: ServiceFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialService;

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
      price: initialService?.price || 0,
      color: initialService?.color || SERVICE_COLORS[0],
      active: initialService?.active ?? true,
    },
  });

  const selectedColor = watch('color');
  const isActive = watch('active');

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
      color: data.color,
      active: data.active,
      user_id: user.id,
    };

    let result;
    if (isEdit && initialService) {
      result = await supabase
        .from('services')
        .update(payload)
        .eq('id', initialService.id)
        .eq('user_id', user.id);
    } else {
      result = await supabase.from('services').insert(payload);
    }

    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? 'No pudimos actualizar el servicio' : 'No pudimos crear el servicio');
      return;
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

          {/* Selector de color */}
          <Field label="Color" icon={Palette} error={errors.color?.message}>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {SERVICE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => field.onChange(color)}
                      className={cn(
                        'h-8 w-8 rounded-lg transition-all',
                        selectedColor === color
                          ? 'ring-2 ring-offset-2 ring-offset-card scale-110'
                          : 'hover:scale-105 ring-1 ring-border',
                      )}
                      style={{
                        backgroundColor: color,
                        // @ts-ignore — CSS custom prop
                        '--tw-ring-color': color,
                      }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              )}
            />
          </Field>

          {/* Toggle activo */}
          <Controller
            control={control}
            name="active"
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
