'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Phone, Mail, Cake, StickyNote } from 'lucide-react';
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
import type { Client } from '@/lib/clients';

// ══════════════════════════════════════════════════════════════════════
// Formulario crear/editar cliente
//
// Modo CREAR: si initialClient es null/undefined
// Modo EDITAR: si initialClient tiene valor (rellena el form)
//
// Validaciones (Zod):
//   • name requerido, min 2 chars
//   • phone opcional pero si existe: formato MX (10 dígitos)
//   • email opcional pero si existe: formato válido
//   • birthday opcional, formato YYYY-MM-DD
// ══════════════════════════════════════════════════════════════════════

const clientSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^\d{10}$/.test(val.replace(/\D/g, '')),
      'Teléfono mexicano de 10 dígitos',
    ),
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Email inválido',
    ),
  birthday: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClient?: Client | null;
  onSuccess?: (client: Client) => void;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  initialClient,
  onSuccess,
}: ClientFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialClient;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialClient?.name || '',
      phone: initialClient?.phone || '',
      email: initialClient?.email || '',
      birthday: initialClient?.birthday || '',
      notes: initialClient?.notes || '',
    },
  });

  async function onSubmit(data: ClientFormData) {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sesión expirada. Vuelve a iniciar sesión.');
      setSubmitting(false);
      return;
    }

    // Normalizar teléfono: quitar separadores, dejar solo dígitos
    const payload = {
      name: data.name.trim(),
      phone: data.phone?.replace(/\D/g, '') || null,
      email: data.email?.trim().toLowerCase() || null,
      birthday: data.birthday || null,
      notes: data.notes?.trim() || null,
      user_id: user.id,
    };

    let result;
    if (isEdit && initialClient) {
      result = await supabase
        .from('clients')
        .update(payload)
        .eq('id', initialClient.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
    } else {
      result = await supabase
        .from('clients')
        .insert(payload)
        .select()
        .maybeSingle();
    }

    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? 'No pudimos actualizar el cliente' : 'No pudimos crear el cliente');
      return;
    }

    toast.success(isEdit ? 'Cliente actualizado' : 'Cliente creado');
    reset();
    onOpenChange(false);
    if (result.data && onSuccess) onSuccess(result.data as Client);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza la información de este cliente.'
              : 'Agrega un nuevo cliente a tu base.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Nombre completo"
            icon={User}
            error={errors.name?.message}
            required
          >
            <Input
              {...register('name')}
              placeholder="María Rodríguez"
              autoComplete="name"
            />
          </FormField>

          <FormField label="Teléfono" icon={Phone} error={errors.phone?.message}>
            <Input
              {...register('phone')}
              placeholder="5512345678"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
            />
          </FormField>

          <FormField label="Email" icon={Mail} error={errors.email?.message}>
            <Input
              {...register('email')}
              placeholder="maria@example.com"
              type="email"
              autoComplete="email"
            />
          </FormField>

          <FormField label="Cumpleaños" icon={Cake} error={errors.birthday?.message}>
            <Input {...register('birthday')} type="date" />
          </FormField>

          <FormField label="Notas" icon={StickyNote} error={errors.notes?.message}>
            <Textarea
              {...register('notes')}
              placeholder="Preferencias, alérgias, observaciones..."
              rows={3}
            />
          </FormField>

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
                'Crear cliente'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── FormField subcomponent (reutilizable) ──

function FormField({
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
      <Label className={cn('flex items-center gap-1.5 text-xs font-semibold')}>
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
