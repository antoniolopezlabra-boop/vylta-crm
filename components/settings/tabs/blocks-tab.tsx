'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Coffee,
  Plane,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Tag,
  Repeat,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsCard } from '../configuracion-shell';
import { useTimeBlocks, useInvalidateTimeBlocks } from '@/lib/queries/use-time-blocks';
import { useActiveStaff } from '@/lib/queries/use-appointments';
import { cn, getInitials } from '@/lib/utils';
import type { TimeBlock } from '@/lib/time-blocks';

// ══════════════════════════════════════════════════════════════════════
// BlocksTab — gestión CRUD de bloqueos de horario (time_blocks)
//
// Casos de uso:
//   • Hora de comida diaria (recurrente lunes a viernes 14:00-15:00)
//   • Vacaciones (específico 20-25 de junio)
//   • Eventos personales (especific 14 julio 10:00-12:00)
//   • Por staff individual o todo el negocio
// ══════════════════════════════════════════════════════════════════════

const BUSINESS_KEY = '__business__';
const DAYS_OF_WEEK = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const PRESET_LABELS = ['Comida', 'Descanso', 'Junta', 'Vacaciones', 'Personal'];

const blockSchema = z
  .object({
    label: z.string().min(2, 'Etiqueta requerida'),
    staffId: z.string(),
    is_recurring: z.boolean(),
    day_of_week: z.number().nullable(),
    specific_date: z.string().nullable(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  })
  .refine(
    (data) => {
      // Si es recurrente, day_of_week debe estar definido
      if (data.is_recurring) return data.day_of_week !== null;
      // Si es específico, specific_date debe estar definido
      return !!data.specific_date;
    },
    {
      message: 'Selecciona un día',
      path: ['day_of_week'],
    },
  )
  .refine(
    (data) => {
      const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
      };
      return toMin(data.end_time) > toMin(data.start_time);
    },
    {
      message: 'La hora final debe ser después de la inicial',
      path: ['end_time'],
    },
  );

type BlockFormData = z.infer<typeof blockSchema>;

interface Props {
  userId: string;
}

export function BlocksTab({ userId }: Props) {
  const { data: blocks = [], isLoading } = useTimeBlocks();
  const { data: staffMembers = [] } = useActiveStaff();
  const invalidate = useInvalidateTimeBlocks();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimeBlock | null>(null);

  const recurringBlocks = useMemo(
    () => blocks.filter(b => b.is_recurring),
    [blocks],
  );
  const specificBlocks = useMemo(
    () =>
      blocks
        .filter(b => !b.is_recurring)
        .sort((a, b) => (a.specific_date || '').localeCompare(b.specific_date || '')),
    [blocks],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(block: TimeBlock) {
    setEditing(block);
    setFormOpen(true);
  }

  async function handleDelete(block: TimeBlock) {
    if (!confirm(`¿Eliminar el bloqueo "${block.label}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('time_blocks').delete().eq('id', block.id);
    if (error) {
      toast.error('No se pudo eliminar: ' + error.message);
      return;
    }
    toast.success('Bloqueo eliminado');
    invalidate();
  }

  async function handleToggleActive(block: TimeBlock) {
    const supabase = createClient();
    const { error } = await supabase
      .from('time_blocks')
      .update({ is_active: !block.is_active, updated_at: new Date().toISOString() })
      .eq('id', block.id);
    if (error) {
      toast.error('No se pudo actualizar: ' + error.message);
      return;
    }
    toast.success(block.is_active ? 'Bloqueo desactivado' : 'Bloqueo activado');
    invalidate();
  }

  function staffById(id: string | null) {
    if (!id) return null;
    return staffMembers.find(s => s.id === id) || null;
  }

  return (
    <div className="space-y-4">
      {/* INFO HEADER */}
      <SettingsCard
        icon={Coffee}
        title="Bloqueos de horario"
        description="Bloquea franjas horarias para comidas, vacaciones o tiempos personales. Estas franjas aparecerán inhabilitadas al crear citas."
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-vylta-green/20 bg-vylta-green/5 p-3">
          <div className="flex items-center gap-2 text-xs text-vylta-bone">
            <Sparkles className="h-3.5 w-3.5 text-vylta-green" />
            {blocks.length === 0 ? (
              <span>Crea tu primer bloqueo para empezar a proteger tus horarios.</span>
            ) : (
              <span>
                Tienes <strong className="text-vylta-green">{blocks.length}</strong> bloqueo{blocks.length !== 1 ? 's' : ''} configurado{blocks.length !== 1 ? 's' : ''}.
              </span>
            )}
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo bloqueo
          </Button>
        </div>
      </SettingsCard>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-vylta-green" />
        </div>
      ) : (
        <>
          {/* BLOQUEOS RECURRENTES */}
          <SettingsCard
            icon={Repeat}
            title="Recurrentes (semanales)"
            description="Se aplican automáticamente todas las semanas en el día indicado."
          >
            {recurringBlocks.length === 0 ? (
              <EmptyState text="No hay bloqueos recurrentes. Crea uno para tu hora de comida diaria." />
            ) : (
              <ul className="divide-y divide-border">
                {recurringBlocks.map(block => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    staff={staffById(block.staff_id)}
                    onEdit={() => openEdit(block)}
                    onDelete={() => handleDelete(block)}
                    onToggle={() => handleToggleActive(block)}
                  />
                ))}
              </ul>
            )}
          </SettingsCard>

          {/* BLOQUEOS ESPECÍFICOS */}
          <SettingsCard
            icon={Plane}
            title="Específicos (única vez)"
            description="Bloqueos para una fecha exacta: vacaciones, juntas, eventos personales."
          >
            {specificBlocks.length === 0 ? (
              <EmptyState text="No hay bloqueos específicos. Crea uno para tus próximas vacaciones." />
            ) : (
              <ul className="divide-y divide-border">
                {specificBlocks.map(block => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    staff={staffById(block.staff_id)}
                    onEdit={() => openEdit(block)}
                    onDelete={() => handleDelete(block)}
                    onToggle={() => handleToggleActive(block)}
                  />
                ))}
              </ul>
            )}
          </SettingsCard>
        </>
      )}

      {/* FORM DIALOG */}
      <BlockFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        userId={userId}
        editing={editing}
        staffMembers={staffMembers}
        onSuccess={invalidate}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BlockRow — una fila de bloqueo en la lista
// ══════════════════════════════════════════════════════════════════════

function BlockRow({
  block,
  staff,
  onEdit,
  onDelete,
  onToggle,
}: {
  block: TimeBlock;
  staff: { id: string; name: string; color: string } | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const dayLabel = block.is_recurring && block.day_of_week !== null
    ? DAYS_OF_WEEK.find(d => d.value === block.day_of_week)?.label || ''
    : '';
  const dateLabel = !block.is_recurring && block.specific_date
    ? formatDate(block.specific_date)
    : '';
  const Icon = block.is_recurring ? Coffee : Plane;

  return (
    <li className={cn('group flex items-center gap-3 py-2.5 transition', !block.is_active && 'opacity-50')}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vylta-luxury/10 ring-1 ring-vylta-luxury/20 text-vylta-luxury">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-vylta-bone">{block.label}</span>
          {!block.is_active && (
            <span className="rounded bg-vylta-card px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-vylta-muted">
              Inactivo
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2.5 text-xs text-vylta-muted">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3" />
            {block.start_time.slice(0, 5)} — {block.end_time.slice(0, 5)}
          </span>
          ·
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {block.is_recurring ? `Cada ${dayLabel}` : dateLabel}
          </span>
          ·
          {staff ? (
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold"
                style={{ backgroundColor: `${staff.color}33`, color: staff.color }}
              >
                {getInitials(staff.name)}
              </span>
              {staff.name.split(' ')[0]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-vylta-bone/80">
              <Users className="h-3 w-3" />
              Todo el negocio
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <Switch
          checked={block.is_active}
          onCheckedChange={onToggle}
          className="scale-75"
        />
        <button
          type="button"
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-md text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-destructive/70 transition hover:bg-destructive/10 hover:text-destructive"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BlockFormDialog — form para crear/editar bloqueos
// ══════════════════════════════════════════════════════════════════════

function BlockFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
  staffMembers,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  editing: TimeBlock | null;
  staffMembers: Array<{ id: string; name: string; color: string }>;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BlockFormData>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      label: 'Comida',
      staffId: BUSINESS_KEY,
      is_recurring: true,
      day_of_week: 1,
      specific_date: null,
      start_time: '14:00',
      end_time: '15:00',
    },
  });

  const isRecurring = watch('is_recurring');
  const labelValue = watch('label');

  // Reset al abrir
  useState(() => {
    if (open) {
      if (isEdit && editing) {
        reset({
          label: editing.label,
          staffId: editing.staff_id || BUSINESS_KEY,
          is_recurring: editing.is_recurring,
          day_of_week: editing.day_of_week,
          specific_date: editing.specific_date,
          start_time: editing.start_time.slice(0, 5),
          end_time: editing.end_time.slice(0, 5),
        });
      } else {
        reset({
          label: 'Comida',
          staffId: BUSINESS_KEY,
          is_recurring: true,
          day_of_week: 1,
          specific_date: null,
          start_time: '14:00',
          end_time: '15:00',
        });
      }
    }
  });

  // Workaround: useState con callback no funciona como useEffect, hacemos sync correcto
  // con useEffect:
  if (typeof window !== 'undefined') {
    // este patrón declarativo del reset al abrir lo manejamos abajo con useEffect indirecto
  }

  async function onSubmit(data: BlockFormData) {
    setSubmitting(true);
    const supabase = createClient();
    const staffIdToSave = data.staffId === BUSINESS_KEY ? null : data.staffId;

    const payload = {
      user_id: userId,
      label: data.label.trim(),
      staff_id: staffIdToSave,
      is_recurring: data.is_recurring,
      day_of_week: data.is_recurring ? data.day_of_week : null,
      specific_date: data.is_recurring ? null : data.specific_date,
      start_time: data.start_time + ':00',
      end_time: data.end_time + ':00',
      is_active: editing?.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (isEdit && editing) {
      const res = await supabase.from('time_blocks').update(payload).eq('id', editing.id);
      error = res.error;
    } else {
      const res = await supabase.from('time_blocks').insert(payload);
      error = res.error;
    }

    setSubmitting(false);
    if (error) {
      toast.error('No se pudo guardar: ' + error.message);
      return;
    }
    toast.success(isEdit ? 'Bloqueo actualizado' : 'Bloqueo creado');
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          // Cuando se abre, sincronizar defaults según editing
          if (isEdit && editing) {
            reset({
              label: editing.label,
              staffId: editing.staff_id || BUSINESS_KEY,
              is_recurring: editing.is_recurring,
              day_of_week: editing.day_of_week,
              specific_date: editing.specific_date,
              start_time: editing.start_time.slice(0, 5),
              end_time: editing.end_time.slice(0, 5),
            });
          } else {
            reset({
              label: 'Comida',
              staffId: BUSINESS_KEY,
              is_recurring: true,
              day_of_week: 1,
              specific_date: null,
              start_time: '14:00',
              end_time: '15:00',
            });
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-vylta-bone">
            {isEdit ? 'Editar bloqueo' : 'Nuevo bloqueo'}
          </DialogTitle>
          <DialogDescription className="text-vylta-muted">
            Bloquea horarios para que no aparezcan disponibles al crear citas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ETIQUETA con presets */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
              <Tag className="h-3 w-3 text-vylta-subtle" />
              Etiqueta <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('label')}
              placeholder="Ej: Comida, Vacaciones, Junta..."
            />
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESET_LABELS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue('label', preset)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition',
                    labelValue === preset
                      ? 'border-vylta-green/40 bg-vylta-green/10 text-vylta-green'
                      : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
          </div>

          {/* COLABORADOR */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
              <Users className="h-3 w-3 text-vylta-subtle" />
              Aplica a
            </Label>
            <Controller
              control={control}
              name="staffId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BUSINESS_KEY}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-vylta-green" />
                        <span>Todo el negocio</span>
                      </div>
                    </SelectItem>
                    {staffMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                            style={{ backgroundColor: `${m.color}33`, color: m.color }}
                          >
                            {getInitials(m.name)}
                          </span>
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* TIPO: RECURRENTE vs ESPECÍFICO */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
              <CalendarDays className="h-3 w-3 text-vylta-subtle" />
              Tipo de bloqueo
            </Label>
            <Controller
              control={control}
              name="is_recurring"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      field.onChange(true);
                      setValue('specific_date', null);
                      if (watch('day_of_week') === null) setValue('day_of_week', 1);
                    }}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition',
                      field.value
                        ? 'border-vylta-green/40 bg-vylta-green/5'
                        : 'border-border bg-vylta-card/40 hover:border-vylta-green/30',
                    )}
                  >
                    <Repeat className={cn('h-4 w-4', field.value ? 'text-vylta-green' : 'text-vylta-subtle')} />
                    <div className="text-xs font-bold text-vylta-bone">Recurrente</div>
                    <div className="text-[10px] text-vylta-muted">Cada semana</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      field.onChange(false);
                      setValue('day_of_week', null);
                      if (!watch('specific_date')) {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        setValue('specific_date', `${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition',
                      !field.value
                        ? 'border-vylta-green/40 bg-vylta-green/5'
                        : 'border-border bg-vylta-card/40 hover:border-vylta-green/30',
                    )}
                  >
                    <Plane className={cn('h-4 w-4', !field.value ? 'text-vylta-green' : 'text-vylta-subtle')} />
                    <div className="text-xs font-bold text-vylta-bone">Específico</div>
                    <div className="text-[10px] text-vylta-muted">Una sola fecha</div>
                  </button>
                </div>
              )}
            />
          </div>

          {/* DÍA */}
          {isRecurring ? (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
                <CalendarIcon className="h-3 w-3 text-vylta-subtle" />
                Día de la semana <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="day_of_week"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => field.onChange(d.value)}
                        className={cn(
                          'h-9 w-12 rounded-md border text-xs font-bold transition',
                          field.value === d.value
                            ? 'border-vylta-green bg-vylta-green text-white shadow-[0_0_12px_hsl(160_84%_39%/0.3)]'
                            : 'border-border bg-vylta-card/40 text-vylta-muted hover:border-vylta-green/40 hover:text-vylta-bone',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.day_of_week && <p className="text-xs text-destructive">{errors.day_of_week.message}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
                <CalendarIcon className="h-3 w-3 text-vylta-subtle" />
                Fecha exacta <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('specific_date')}
                type="date"
              />
              {errors.specific_date && <p className="text-xs text-destructive">{errors.specific_date.message}</p>}
            </div>
          )}

          {/* HORARIO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
                <Clock className="h-3 w-3 text-vylta-subtle" />
                Desde
              </Label>
              <Input {...register('start_time')} type="time" step={900} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
                <Clock className="h-3 w-3 text-vylta-subtle" />
                Hasta
              </Label>
              <Input {...register('end_time')} type="time" step={900} />
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
            </div>
          </div>

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
              ) : (
                isEdit ? 'Guardar cambios' : 'Crear bloqueo'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-xs text-vylta-muted">
      {text}
    </div>
  );
}

function formatDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
