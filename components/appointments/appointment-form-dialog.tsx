'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { formatCurrency, getInitials } from '@/lib/utils';
import { toLocalDateString } from '@/lib/date-utils';
import { getStaffAvailability } from '@/lib/appointments';

// ══════════════════════════════════════════════════════════════════════
// Form de Nueva Cita — ahora con campo de colaborador.
// • Detecta automáticamente staff ocupado en la franja horaria
// • Conflictos respetan el staff seleccionado (dos staff distintos pueden
//   compartir hora sin colisión)
// ══════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS = ['Confirmada', 'Pendiente'] as const;
const UNASSIGNED_KEY = '__unassigned__';

const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Selecciona un cliente'),
  serviceId: z.string().min(1, 'Selecciona un servicio'),
  staffId: z.string(),
  date: z.string().min(1, 'Selecciona una fecha'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  duration_minutes: z.number().min(5).max(720),
  status: z.enum(STATUS_OPTIONS),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface ClientOption { id: string; name: string; phone: string | null; }
interface ServiceOption { id: string; name: string; duration_minutes: number; price: number; is_active: boolean; }
interface StaffOption { id: string; name: string; color: string; role: string | null; }

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  onSuccess?: () => void;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  initialDate,
  onSuccess,
}: AppointmentFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffOption[]>([]);
  const [busyStaff, setBusyStaff] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: '',
      serviceId: '',
      staffId: UNASSIGNED_KEY,
      date: initialDate || toLocalDateString(new Date()),
      start_time: '09:00',
      duration_minutes: 60,
      status: 'Confirmada',
      notes: '',
    },
  });

  const selectedClientId = watch('clientId');
  const selectedServiceId = watch('serviceId');
  const selectedStaffId = watch('staffId');
  const selectedDate = watch('date');
  const selectedTime = watch('start_time');
  const duration = watch('duration_minutes');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [clientsRes, servicesRes, staffRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone').eq('user_id', user.id).order('name'),
        supabase.from('services').select('id, name, duration_minutes, price, is_active').eq('user_id', user.id).eq('is_active', true).order('name'),
        supabase.from('staff_members').select('id, name, color, role').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      ]);
      if (clientsRes.error) console.error('[AppointmentForm] clients error:', clientsRes.error);
      if (servicesRes.error) console.error('[AppointmentForm] services error:', servicesRes.error);
      if (staffRes.error) console.error('[AppointmentForm] staff error:', staffRes.error);
      if (!cancelled) {
        setClients((clientsRes.data || []) as ClientOption[]);
        setServices((servicesRes.data || []) as ServiceOption[]);
        setStaffMembers((staffRes.data || []) as StaffOption[]);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!selectedServiceId) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (service) setValue('duration_minutes', service.duration_minutes);
  }, [selectedServiceId, services, setValue]);

  // Calcula end_time desde start_time + duration
  const endTime = useMemo(() => {
    if (!selectedTime || !duration) return null;
    const [h, m] = selectedTime.split(':').map(Number);
    const endMin = h * 60 + (m || 0) + duration;
    const hh = Math.floor(endMin / 60);
    const mm = endMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }, [selectedTime, duration]);

  // Detecta staff ocupado + conflicto general
  useEffect(() => {
    if (!selectedDate || !selectedTime || !duration || !endTime) {
      setConflict(null);
      setBusyStaff(new Set());
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Staff ocupado
      const busy = await getStaffAvailability(selectedDate, selectedTime, endTime);
      setBusyStaff(busy);

      // 2. Conflicto general (considerando staff)
      const { data } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, service_name, client_name_temp, client:clients(name), staff_id')
        .eq('user_id', user.id)
        .eq('date', selectedDate);
      if (!data) { setConflict(null); return; }

      const EXCLUDED = ['Cancelada', 'No asistió', 'Rechazada'];
      const active = data.filter((a: any) => !EXCLUDED.includes(a.status));
      const timeToMin = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0);
      };
      const newStart = timeToMin(selectedTime);
      const newEnd = newStart + duration;
      const staffIdForCheck = selectedStaffId === UNASSIGNED_KEY ? null : selectedStaffId;

      const conflicting = active.find((apt: any) => {
        // Si ambos tienen staff distinto, no es conflicto
        if (staffIdForCheck && apt.staff_id && apt.staff_id !== staffIdForCheck) return false;
        const aptStart = timeToMin(apt.start_time);
        const aptEnd = apt.end_time ? timeToMin(apt.end_time) : aptStart + 60;
        return newStart < aptEnd && newEnd > aptStart;
      });
      if (conflicting) {
        const name = (conflicting as any).client?.name || (conflicting as any).client_name_temp || 'cita';
        setConflict(`Conflicto: ${name} ya tiene cita a las ${(conflicting as any).start_time}.`);
      } else {
        setConflict(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedDate, selectedTime, duration, selectedStaffId, endTime]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 50);
    const q = clientSearch.trim().toLowerCase();
    return clients
      .filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
      .slice(0, 50);
  }, [clients, clientSearch]);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedStaff = selectedStaffId !== UNASSIGNED_KEY
    ? staffMembers.find(s => s.id === selectedStaffId)
    : null;

  async function onSubmit(data: AppointmentFormData) {
    if (conflict) {
      const ok = confirm(`${conflict}\n\n¿Quieres crearla de todos modos?`);
      if (!ok) return;
    }
    const staffIdToSave = data.staffId === UNASSIGNED_KEY ? null : data.staffId;
    if (staffIdToSave && busyStaff.has(staffIdToSave)) {
      const ok = confirm('Este colaborador ya tiene una cita en este horario. ¿Continuar?');
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

    const [h, m] = data.start_time.split(':').map(Number);
    const startMin = h * 60 + (m || 0);
    const endMin = startMin + data.duration_minutes;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const payload = {
      user_id: user.id,
      client_id: data.clientId,
      service_name: service?.name || '',
      service_cost: service?.price || 0,
      date: data.date,
      start_time: data.start_time,
      end_time,
      status: data.status,
      notes: data.notes?.trim() || null,
      staff_id: staffIdToSave,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>
            Agenda una cita revisando que no haya conflictos con otras.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Cliente" icon={User} error={errors.clientId?.message} required>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-vylta-green-500/50 focus:ring-2 focus:ring-vylta-green-500/20"
                />
              </div>

              {selectedClient ? (
                <div className="flex items-center justify-between rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">{selectedClient.name}</div>
                    {selectedClient.phone && (
                      <div className="text-xs text-muted-foreground">{selectedClient.phone}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('clientId', '');
                      setClientSearch('');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field }) => (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-secondary/30">
                      {filteredClients.length === 0 ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">
                          {clientSearch ? 'Sin resultados' : 'Sin clientes aún'}
                        </p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {filteredClients.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  field.onChange(c.id);
                                  setClientSearch('');
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-secondary"
                              >
                                <span className="truncate text-sm font-medium">{c.name}</span>
                                {c.phone && (
                                  <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                />
              )}
            </div>
          </Field>

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
                      <div className="px-2 py-2 text-sm text-muted-foreground">Sin servicios activos</div>
                    ) : (
                      services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center justify-between gap-3">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
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
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedService.duration_minutes} min ·{' '}
                <span className="font-bold text-vylta-green-600 dark:text-vylta-green-400">
                  {formatCurrency(selectedService.price)}
                </span>
              </p>
            )}
          </Field>

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
                        <span className="text-muted-foreground">Sin asignar</span>
                      </SelectItem>
                      {staffMembers.map((m) => {
                        const isBusy = busyStaff.has(m.id);
                        return (
                          <SelectItem key={m.id} value={m.id} disabled={isBusy}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                                style={{ backgroundColor: `${m.color}33`, color: m.color }}
                              >
                                {getInitials(m.name)}
                              </span>
                              <span>{m.name}</span>
                              {m.role && <span className="text-xs text-muted-foreground">· {m.role}</span>}
                              {isBusy && <span className="ml-2 text-xs font-bold text-destructive">⛔ Ocupado</span>}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedStaff && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedStaff.color }}
                  />
                  Atiende {selectedStaff.name}
                </p>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" icon={CalendarIcon} error={errors.date?.message} required>
              <Input {...register('date')} type="date" />
            </Field>
            <Field label="Hora" icon={Clock} error={errors.start_time?.message} required>
              <Input {...register('start_time')} type="time" step={300} />
            </Field>
          </div>

          <Field label="Duración (min)" icon={Clock} error={errors.duration_minutes?.message}>
            <Input
              {...register('duration_minutes', { valueAsNumber: true })}
              type="number"
              step={5}
              min={5}
              max={720}
            />
          </Field>

          {conflict && (
            <div className="flex items-start gap-2 rounded-lg border border-vylta-amber-500/40 bg-vylta-amber-500/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-vylta-amber-700 dark:text-amber-400" />
              <span className="font-semibold text-vylta-amber-700 dark:text-amber-400">{conflict}</span>
            </div>
          )}

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
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

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
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear cita'
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
