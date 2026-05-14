'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  User,
  Briefcase,
  Calendar as CalendarIcon,
  Clock,
  Search,
  AlertTriangle,
  StickyNote,
  Users,
  UserPlus,
  X,
  CheckCircle2,
  Ban,
  Coffee,
  History,
  Pencil,
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
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, getInitials, cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/date-utils';
import { useClients } from '@/lib/queries/use-clients';
import { useServices } from '@/lib/queries/use-services';
import { useActiveStaff } from '@/lib/queries/use-appointments';
import { useTimeBlocks } from '@/lib/queries/use-time-blocks';
import { getBlocksForDate, findBlockConflict } from '@/lib/time-blocks';
import { updateAppointmentFull, type Appointment } from '@/lib/appointments';

// ══════════════════════════════════════════════════════════════════════
// Form de Cita — ahora soporta CREAR y EDITAR
//
// Modo CREAR (default): se llama sin initialAppointment
// Modo EDITAR: se pasa initialAppointment con la cita a editar.
//   En edición NO se permite cambiar el cliente (campo bloqueado) porque
//   eso implicaría renombrar el WhatsApp ya enviado etc.
//   Lo demás sí: servicio, fecha, horario, colaborador, status, notas.
//
// NOTA IMPORTANTE — whatsapp_notification:
// El trigger SQL notify_n8n_appointment_created() solo dispara el
// webhook de n8n si la cita tiene whatsapp_notification = true. Por
// eso el INSERT del modo CREAR debe enviar este campo explícitamente
// (default true). Sin esto, las citas creadas desde el CRM web NO
// disparan los recordatorios por WhatsApp.
// ══════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS_CREATE = ['Confirmada', 'Pendiente'] as const;
const STATUS_OPTIONS_EDIT = ['Confirmada', 'Pendiente', 'Completada', 'Pagado', 'En espera', 'Reagendada'] as const;
const UNASSIGNED_KEY = '__unassigned__';

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 21;
const SLOT_INTERVAL_MIN = 15;
const PAST_SLOT_BUFFER_MIN = 5;

const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Selecciona un cliente'),
  serviceId: z.string().min(1, 'Selecciona un servicio'),
  staffId: z.string(),
  date: z.string().min(1, 'Selecciona una fecha'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Selecciona un horario'),
  status: z.string(),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  /** Si está presente, el form entra en modo EDICIÓN */
  initialAppointment?: Appointment | null;
  onSuccess?: () => void;
}

interface BookedSlot {
  id: string;
  start: number;
  end: number;
  clientName: string;
  staffId: string | null;
}

type BlockReason =
  | { kind: 'past' }
  | { kind: 'block'; label: string }
  | { kind: 'booking'; clientName: string }
  | { kind: 'no-fit' };

export function AppointmentFormDialog({
  open,
  onOpenChange,
  initialDate,
  initialAppointment,
  onSuccess,
}: AppointmentFormDialogProps) {
  const isEditMode = !!initialAppointment;
  const [submitting, setSubmitting] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [creatingClient, setCreatingClient] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [open]);

  const { data: clients = [] } = useClients();
  const { data: allServices = [] } = useServices();
  const { data: staffMembers = [] } = useActiveStaff();
  const { data: timeBlocks = [] } = useTimeBlocks();
  const services = useMemo(
    () => allServices.filter(s => s.is_active),
    [allServices],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: '',
      serviceId: '',
      staffId: UNASSIGNED_KEY,
      date: initialDate || toLocalDateString(new Date()),
      start_time: '',
      status: 'Confirmada',
      notes: '',
    },
  });

  const selectedClientId  = watch('clientId');
  const selectedServiceId = watch('serviceId');
  const selectedStaffId   = watch('staffId');
  const selectedDate      = watch('date');
  const selectedTime      = watch('start_time');

  // Cuando se abre el dialog, prellenar form (modo edit) o resetear (modo crear)
  useEffect(() => {
    if (!open) return;
    if (isEditMode && initialAppointment) {
      // Buscar el serviceId que matchea el service_name (porque appointments
      // guarda service_name, no service_id)
      const matchingService = allServices.find(
        s => s.name === initialAppointment.service_name,
      );
      reset({
        clientId: initialAppointment.client_id || '',
        serviceId: matchingService?.id || '',
        staffId: initialAppointment.staff_id || UNASSIGNED_KEY,
        date: initialAppointment.date,
        start_time: initialAppointment.start_time?.slice(0, 5) || '',
        status: initialAppointment.status,
        notes: initialAppointment.notes || '',
      });
    } else {
      reset({
        clientId: '',
        serviceId: '',
        staffId: UNASSIGNED_KEY,
        date: initialDate || toLocalDateString(new Date()),
        start_time: '',
        status: 'Confirmada',
        notes: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, initialAppointment?.id, allServices.length]);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const duration = selectedService?.duration_minutes || 0;

  const endTime = useMemo(() => {
    if (!selectedTime || !duration) return null;
    const [h, m] = selectedTime.split(':').map(Number);
    const endMin = h * 60 + (m || 0) + duration;
    const hh = Math.floor(endMin / 60);
    const mm = endMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }, [selectedTime, duration]);

  useEffect(() => {
    if (!open || !selectedDate) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, client_name_temp, staff_id, client:clients(name)')
        .eq('user_id', user.id)
        .eq('date', selectedDate);
      if (!data || cancelled) return;
      const EXCLUDED = ['Cancelada', 'No asistió', 'Rechazada'];
      const active = data
        .filter((a: any) => !EXCLUDED.includes(a.status))
        // En modo edición excluir la cita propia para no auto-conflictarse
        .filter((a: any) => !isEditMode || a.id !== initialAppointment?.id)
        .map((a: any) => {
          const startMin = timeToMinutes(a.start_time);
          const endMin   = a.end_time ? timeToMinutes(a.end_time) : startMin + 60;
          return {
            id: a.id,
            start: startMin,
            end: endMin,
            clientName: a.client?.name || a.client_name_temp || 'Cita',
            staffId: a.staff_id,
          } as BookedSlot;
        });
      setBookedSlots(active);
    })();
    return () => { cancelled = true; };
  }, [open, selectedDate, isEditMode, initialAppointment?.id]);

  const slots = useMemo(() => {
    const result: Array<{
      time: string;
      minutes: number;
      blocked: boolean;
      reason: BlockReason | null;
    }> = [];

    const staffIdForCheck = selectedStaffId === UNASSIGNED_KEY ? null : selectedStaffId;
    const todayStr = toLocalDateString(new Date());
    const isToday = selectedDate === todayStr;
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + PAST_SLOT_BUFFER_MIN;
    const blocksForDate = getBlocksForDate(timeBlocks, selectedDate, staffIdForCheck);

    for (let h = SLOT_START_HOUR; h <= SLOT_END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_INTERVAL_MIN) {
        if (h === SLOT_END_HOUR && m > 0) break;
        const minutes = h * 60 + m;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        if (!duration) {
          result.push({ time, minutes, blocked: false, reason: null });
          continue;
        }

        const slotEnd = minutes + duration;

        // En modo edición, NO marcar como pasado el horario actual de la cita
        // (para que el usuario pueda mantener el mismo horario al editar otra cosa)
        const isCurrentSlot =
          isEditMode &&
          initialAppointment?.date === selectedDate &&
          initialAppointment?.start_time?.slice(0, 5) === time;

        if (isToday && minutes < nowMinutes && !isCurrentSlot) {
          result.push({ time, minutes, blocked: true, reason: { kind: 'past' } });
          continue;
        }

        const blockConflict = findBlockConflict(minutes, duration, blocksForDate);
        if (blockConflict && !isCurrentSlot) {
          result.push({
            time,
            minutes,
            blocked: true,
            reason: { kind: 'block', label: blockConflict.label },
          });
          continue;
        }

        const bookingConflict = bookedSlots.find(b => {
          if (staffIdForCheck && b.staffId && b.staffId !== staffIdForCheck) return false;
          if (!staffIdForCheck && b.staffId) return false;
          return minutes < b.end && slotEnd > b.start;
        });
        if (bookingConflict) {
          result.push({
            time,
            minutes,
            blocked: true,
            reason: { kind: 'booking', clientName: bookingConflict.clientName },
          });
          continue;
        }

        if (slotEnd > SLOT_END_HOUR * 60) {
          result.push({ time, minutes, blocked: true, reason: { kind: 'no-fit' } });
          continue;
        }

        result.push({ time, minutes, blocked: false, reason: null });
      }
    }

    return result;
  }, [bookedSlots, duration, selectedStaffId, selectedDate, timeBlocks, now, isEditMode, initialAppointment]);

  useEffect(() => {
    if (!selectedTime) return;
    const slot = slots.find(s => s.time === selectedTime);
    if (slot?.blocked) {
      setValue('start_time', '');
      toast.info('Ese horario ya no está disponible con esta configuración');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, selectedStaffId, selectedDate]);

  const availableCount = slots.filter(s => !s.blocked).length;

  const staffConflict = useMemo(() => {
    if (selectedStaffId === UNASSIGNED_KEY || !selectedTime || !duration) return null;
    const start = timeToMinutes(selectedTime);
    const end = start + duration;
    return bookedSlots.find(b =>
      b.staffId === selectedStaffId &&
      start < b.end && end > b.start
    );
  }, [bookedSlots, selectedStaffId, selectedTime, duration]);

  async function createClientInline(name: string) {
    if (!name.trim()) return;
    setCreatingClient(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreatingClient(false);
      return;
    }
    const { data, error } = await supabase
      .from('clients')
      .insert({ user_id: user.id, name: name.trim(), is_active: true })
      .select('id, name, phone')
      .single();
    setCreatingClient(false);
    if (error || !data) {
      toast.error('No pudimos crear el cliente');
      return;
    }
    setValue('clientId', data.id);
    toast.success(`Cliente "${data.name}" creado`);
  }

  async function onSubmit(data: AppointmentFormData) {
    if (staffConflict) {
      const ok = confirm(
        `Este colaborador ya tiene una cita con ${staffConflict.clientName} en ese horario. ¿Continuar?`,
      );
      if (!ok) return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sesión expirada');
      setSubmitting(false);
      return;
    }

    const service = services.find(s => s.id === data.serviceId);
    if (!service) {
      toast.error('Servicio no válido');
      setSubmitting(false);
      return;
    }

    const start = timeToMinutes(data.start_time);
    const end = start + service.duration_minutes;
    const endH = Math.floor(end / 60);
    const endM = end % 60;
    const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const staffIdToSave = data.staffId === UNASSIGNED_KEY ? null : data.staffId;

    // ── Modo EDITAR ──
    if (isEditMode && initialAppointment) {
      const result = await updateAppointmentFull(initialAppointment.id, {
        client_id: data.clientId,
        service_name: service.name,
        service_cost: service.price || 0,
        date: data.date,
        start_time: data.start_time,
        end_time,
        status: data.status,
        notes: data.notes?.trim() || null,
        staff_id: staffIdToSave,
      });
      setSubmitting(false);
      if ('error' in result) {
        toast.error('No pudimos guardar los cambios: ' + result.error);
        return;
      }
      toast.success('Cita actualizada');
      onOpenChange(false);
      onSuccess?.();
      return;
    }

    // ── Modo CREAR ──
    // IMPORTANTE: whatsapp_notification=true es OBLIGATORIO para que el
    // trigger notify_n8n_appointment_created() dispare el webhook a n8n
    // y se envíe el mensaje de confirmación por WhatsApp al cliente.
    // Sin este campo (queda en NULL o false), la cita se crea pero el
    // cliente NUNCA recibe la confirmación. La app móvil ya lo envía;
    // el CRM web debe ser consistente.
    const payload = {
      user_id: user.id,
      client_id: data.clientId,
      service_name: service.name,
      service_cost: service.price || 0,
      date: data.date,
      start_time: data.start_time,
      end_time,
      status: data.status,
      notes: data.notes?.trim() || null,
      staff_id: staffIdToSave,
      whatsapp_notification: true,
    };

    const result = await supabase.from('appointments').insert(payload);
    setSubmitting(false);

    if (result.error) {
      console.error('[AppointmentForm] insert error:', result.error);
      toast.error('No pudimos crear la cita: ' + result.error.message);
      return;
    }

    toast.success('Cita creada');
    reset();
    onOpenChange(false);
    onSuccess?.();
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedStaff = selectedStaffId !== UNASSIGNED_KEY
    ? staffMembers.find(s => s.id === selectedStaffId)
    : null;

  const statusOptions = isEditMode ? STATUS_OPTIONS_EDIT : STATUS_OPTIONS_CREATE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-vylta-bone">
            {isEditMode && <Pencil className="h-4 w-4 text-vylta-green" />}
            {isEditMode ? 'Editar cita' : 'Nueva cita'}
          </DialogTitle>
          <DialogDescription className="text-vylta-muted">
            {isEditMode
              ? 'Modifica los datos de la cita. Los cambios afectan a recordatorios futuros.'
              : 'Completa los datos y elige un horario disponible.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* CLIENTE — read-only en modo edición */}
          <Field label="Cliente" icon={User} error={errors.clientId?.message} required>
            {isEditMode && selectedClient ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-vylta-card/40 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vylta-green/15 text-[10px] font-bold text-vylta-green ring-1 ring-vylta-green/30">
                  {getInitials(selectedClient.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-vylta-bone truncate">
                    {selectedClient.name}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-xs text-vylta-muted truncate">{selectedClient.phone}</div>
                  )}
                </div>
                <span className="shrink-0 rounded bg-vylta-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-muted">
                  No editable
                </span>
              </div>
            ) : (
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <ClientCombobox
                    clients={clients}
                    value={field.value}
                    onChange={field.onChange}
                    selectedClient={selectedClient}
                    onCreateInline={createClientInline}
                    creating={creatingClient}
                  />
                )}
              />
            )}
          </Field>

          {/* SERVICIO */}
          <Field label="Servicio" icon={Briefcase} error={errors.serviceId?.message} required>
            <Controller
              control={control}
              name="serviceId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.length === 0 ? (
                      <div className="px-2 py-2 text-sm text-vylta-muted">
                        Sin servicios activos
                      </div>
                    ) : (
                      services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2.5">
                            {s.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                            )}
                            <span className="flex-1 truncate">{s.name}</span>
                            <span className="ml-2 text-xs text-vylta-muted tabular-nums">
                              {s.duration_minutes}min · {formatCurrency(s.price)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {selectedService && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-vylta-green/20 bg-vylta-green/5 px-3 py-2 text-xs">
                <Clock className="h-3.5 w-3.5 shrink-0 text-vylta-green" />
                <span className="text-vylta-bone">
                  Dura{' '}
                  <strong className="tabular-nums">{selectedService.duration_minutes} min</strong>
                  {selectedTime && endTime && (
                    <> · termina a las <strong className="tabular-nums">{endTime}</strong></>
                  )}
                </span>
                <span className="ml-auto font-bold tabular-nums text-vylta-green">
                  {formatCurrency(selectedService.price)}
                </span>
              </div>
            )}
          </Field>

          {/* COLABORADOR */}
          {staffMembers.length > 0 && (
            <Field label="Colaborador" icon={Users}>
              <Controller
                control={control}
                name="staffId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_KEY}>
                        <span className="text-vylta-muted">Sin asignar</span>
                      </SelectItem>
                      {staffMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                              style={{ backgroundColor: `${m.color}33`, color: m.color }}
                            >
                              {getInitials(m.name)}
                            </span>
                            <span>{m.name}</span>
                            {m.role && (
                              <span className="text-xs text-vylta-muted">· {m.role}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedStaff && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-vylta-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedStaff.color }}
                  />
                  Atiende {selectedStaff.name}
                </p>
              )}
            </Field>
          )}

          {/* FECHA */}
          <Field label="Fecha" icon={CalendarIcon} error={errors.date?.message} required>
            <Input
              {...register('date')}
              type="date"
              min={isEditMode ? undefined : toLocalDateString(new Date())}
            />
          </Field>

          {/* HORARIO */}
          <Field label="Horario" icon={Clock} error={errors.start_time?.message} required>
            {!selectedServiceId ? (
              <div className="rounded-lg border border-dashed border-border bg-vylta-card/40 px-4 py-6 text-center">
                <Clock className="mx-auto h-5 w-5 text-vylta-subtle" />
                <p className="mt-2 text-xs text-vylta-muted">
                  Elige primero un <strong>servicio</strong> para ver los horarios disponibles
                </p>
              </div>
            ) : availableCount === 0 ? (
              <div className="rounded-lg border border-dashed border-vylta-amber/40 bg-vylta-amber/5 px-4 py-6 text-center">
                <Clock className="mx-auto h-5 w-5 text-vylta-amber" />
                <p className="mt-2 text-xs font-semibold text-vylta-amber">
                  Sin horarios disponibles
                </p>
                <p className="mt-0.5 text-[11px] text-vylta-muted">
                  Prueba otro día, otro colaborador o un servicio más corto.
                </p>
              </div>
            ) : (
              <SlotGrid
                slots={slots}
                selectedTime={selectedTime}
                onSelect={(time) => setValue('start_time', time, { shouldValidate: true, shouldDirty: true })}
                duration={duration}
              />
            )}
          </Field>

          {staffConflict && selectedTime && (
            <div className="flex items-start gap-2 rounded-lg border border-vylta-amber/40 bg-vylta-amber/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-vylta-amber" />
              <div>
                <p className="font-bold text-vylta-amber">Colaborador ocupado</p>
                <p className="mt-0.5 text-vylta-amber/80">
                  {selectedStaff?.name} ya tiene cita con {staffConflict.clientName} a esa hora.
                </p>
              </div>
            </div>
          )}

          {/* ESTADO */}
          <Field label="Estado" icon={CalendarIcon}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {/* NOTAS */}
          <Field label="Notas" icon={StickyNote}>
            <Textarea
              {...register('notes')}
              placeholder="Notas privadas sobre esta cita..."
              rows={2}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || (isEditMode && !isDirty)}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditMode ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                isEditMode ? 'Guardar cambios' : 'Crear cita'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ClientCombobox (sin cambios)
// ══════════════════════════════════════════════════════════════════════

interface ClientLite { id: string; name: string; phone: string | null; }

function ClientCombobox({
  clients,
  value,
  onChange,
  selectedClient,
  onCreateInline,
  creating,
}: {
  clients: ClientLite[];
  value: string;
  onChange: (id: string) => void;
  selectedClient?: ClientLite;
  onCreateInline: (name: string) => Promise<void>;
  creating: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients.slice(0, 8);
    const q = search.trim().toLowerCase();
    return clients
      .filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
      .slice(0, 8);
  }, [clients, search]);

  const exactMatch = clients.find(c => c.name?.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim().length >= 2 && !exactMatch;

  if (selectedClient && value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-vylta-green/30 bg-vylta-green/5 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vylta-green/15 text-[10px] font-bold text-vylta-green ring-1 ring-vylta-green/30">
            {getInitials(selectedClient.name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-vylta-bone truncate">
              {selectedClient.name}
            </div>
            {selectedClient.phone && (
              <div className="text-xs text-vylta-muted truncate">{selectedClient.phone}</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setSearch('');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="shrink-0 rounded-md p-1.5 text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
          title="Cambiar cliente"
          aria-label="Cambiar cliente"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar cliente por nombre o teléfono..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-10 w-full rounded-lg border border-border bg-vylta-card/60 pl-10 pr-3 text-sm text-vylta-bone outline-none transition-colors placeholder:text-vylta-subtle hover:border-vylta-green/30 focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-lg">
          {filtered.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setSearch('');
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-vylta-card"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-vylta-card text-[9px] font-bold text-vylta-muted ring-1 ring-border">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-vylta-bone">{c.name}</div>
                      {c.phone && (
                        <div className="truncate text-[11px] text-vylta-muted">{c.phone}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-vylta-muted">
              {search.trim() ? 'Sin resultados' : 'Empieza a escribir para buscar...'}
            </div>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={async () => {
                await onCreateInline(search.trim());
                setSearch('');
                setOpen(false);
              }}
              disabled={creating}
              className="flex w-full items-center gap-2 border-t border-border bg-vylta-green/5 px-3 py-2.5 text-left transition hover:bg-vylta-green/10 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin text-vylta-green" />
              ) : (
                <UserPlus className="h-4 w-4 text-vylta-green" />
              )}
              <span className="text-sm font-semibold text-vylta-green">
                Crear cliente "<span className="truncate">{search.trim()}</span>"
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SlotGrid — sin cambios
// ══════════════════════════════════════════════════════════════════════

interface Slot {
  time: string;
  minutes: number;
  blocked: boolean;
  reason: BlockReason | null;
}

function SlotGrid({
  slots,
  selectedTime,
  onSelect,
  duration,
}: {
  slots: Slot[];
  selectedTime: string;
  onSelect: (time: string) => void;
  duration: number;
}) {
  const grouped = useMemo(() => {
    const map: Record<number, Slot[]> = {};
    slots.forEach(s => {
      const h = Math.floor(s.minutes / 60);
      if (!map[h]) map[h] = [];
      map[h].push(s);
    });
    return map;
  }, [slots]);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-vylta-card/30 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-vylta-muted">
        <LegendDot color="bg-vylta-green" label="Disponible" />
        <LegendDot color="bg-vylta-card ring-1 ring-border" label="Ocupado" />
        <LegendDot color="bg-vylta-luxury/40" label="Bloqueo" />
        <LegendDot color="bg-vylta-subtle/30" label="Pasado" />
        {duration > 0 && (
          <span className="ml-auto tabular-nums">
            Duración: <strong className="text-vylta-bone">{duration} min</strong>
          </span>
        )}
      </div>

      <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([hour, hourSlots]) => (
          <div key={hour}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">
              {formatHour(Number(hour))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {hourSlots.map((slot) => (
                <SlotButton
                  key={slot.time}
                  slot={slot}
                  isSelected={selectedTime === slot.time}
                  onSelect={() => onSelect(slot.time)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-block h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  );
}

function SlotButton({
  slot,
  isSelected,
  onSelect,
}: {
  slot: Slot;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { time, blocked, reason } = slot;

  let className: string;
  let title: string | undefined;
  let Icon: any = null;

  if (isSelected) {
    className = 'border-vylta-green bg-vylta-green text-white shadow-[0_0_12px_hsl(160_84%_39%/0.4)]';
    Icon = CheckCircle2;
  } else if (!blocked) {
    className = 'border-vylta-green/20 bg-vylta-green/5 text-vylta-green hover:border-vylta-green/40 hover:bg-vylta-green/10';
  } else if (reason?.kind === 'past') {
    className = 'cursor-not-allowed border-border bg-vylta-card/40 text-vylta-subtle/40 line-through';
    title = 'Horario pasado';
    Icon = History;
  } else if (reason?.kind === 'block') {
    className = 'cursor-not-allowed border-vylta-luxury/20 bg-vylta-luxury/5 text-vylta-luxury/60 line-through';
    title = reason.label;
    Icon = Coffee;
  } else if (reason?.kind === 'booking') {
    className = 'cursor-not-allowed border-border bg-vylta-card/60 text-vylta-subtle/60 line-through';
    title = `Ocupado: ${reason.clientName}`;
    Icon = Ban;
  } else if (reason?.kind === 'no-fit') {
    className = 'cursor-not-allowed border-border bg-vylta-card/40 text-vylta-subtle/40 line-through';
    title = 'No alcanza para el servicio completo';
    Icon = Ban;
  } else {
    className = 'cursor-not-allowed border-border bg-vylta-card/60 text-vylta-subtle/60 line-through';
  }

  return (
    <button
      type="button"
      onClick={() => !blocked && onSelect()}
      disabled={blocked}
      title={title}
      className={cn(
        'group relative rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums transition-all',
        className,
      )}
    >
      {time}
      {Icon && (
        <Icon className="absolute top-0.5 right-0.5 h-2.5 w-2.5 opacity-60" />
      )}
    </button>
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHour(hour24: number): string {
  if (hour24 === 0) return '12 AM';
  if (hour24 === 12) return '12 PM';
  if (hour24 < 12) return `${hour24} AM`;
  return `${hour24 - 12} PM`;
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
      <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
        {Icon && <Icon className="h-3 w-3 text-vylta-subtle" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
