'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Scissors,
  StickyNote,
  Phone,
  Mail,
  User,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  DollarSign,
  RotateCcw,
  UserPlus,
  CalendarPlus,
  AlertTriangle,
  Link2,
  CheckCheck,
  UserX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAppointmentById,
  updateAppointmentStatus,
  assignStaffToAppointment,
  deleteAppointment,
  fetchActiveStaff,
  getStaffAvailability,
  type Appointment,
  getApptStatusStyle,
} from '@/lib/appointments';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { MONTHS_ES, DAYS_ES_FULL } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; color: string; role: string | null; busy?: boolean }>>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saveClientOpen, setSaveClientOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  async function reload() {
    if (!id) return;
    setLoading(true);
    const [apt, staff] = await Promise.all([
      fetchAppointmentById(id),
      fetchActiveStaff(),
    ]);
    if (!apt) {
      toast.error('Cita no encontrada');
      router.push('/citas');
      return;
    }
    setAppointment(apt);
    setStaffList(staff.map(s => ({ ...s, busy: false })));
    if (apt.source === 'public_link' && !apt.client) {
      setClientForm({
        name: apt.client_name_temp || '',
        phone: apt.client_phone_temp || '',
        email: '',
        notes: '',
      });
    }
    setRescheduleDate(apt.date);
    setRescheduleTime(apt.start_time?.slice(0, 5) || '09:00');
    setLoading(false);
  }

  useEffect(() => { reload(); }, [id]);

  async function loadStaffAvailability() {
    if (!appointment) return;
    const busySet = await getStaffAvailability(
      appointment.date,
      appointment.start_time,
      appointment.end_time || appointment.start_time,
      appointment.id,
    );
    setStaffList(prev => prev.map(s => ({ ...s, busy: busySet.has(s.id) })));
  }

  async function handleStatusChange(newStatus: string, confirmMsg?: string) {
    if (!appointment) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setActionLoading(true);
    const result = await updateAppointmentStatus(appointment.id, newStatus);
    setActionLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Cita marcada como ${newStatus}`);
    reload();
  }

  async function handleAssignStaff(staffId: string | null) {
    if (!appointment) return;
    const member = staffId ? staffList.find(s => s.id === staffId) : null;
    if (member?.busy) {
      toast.error(`${member.name} ya tiene una cita en este horario`);
      return;
    }
    setActionLoading(true);
    const result = await assignStaffToAppointment(appointment.id, staffId);
    setActionLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(staffId ? 'Colaborador asignado' : 'Asignación removida');
    setAssignOpen(false);
    reload();
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
    setActionLoading(true);
    const ok = await deleteAppointment(appointment.id);
    setActionLoading(false);
    if (!ok) {
      toast.error('No pudimos eliminar la cita');
      return;
    }
    toast.success('Cita eliminada');
    router.push('/citas');
  }

  async function handleSaveAsClient() {
    if (!appointment) return;
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      toast.error('Nombre y teléfono son obligatorios');
      return;
    }
    setSavingClient(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingClient(false); return; }

    const { data: newClient, error: cErr } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim() || null,
        notes: clientForm.notes.trim() || null,
        is_active: true,
      })
      .select('id')
      .single();

    if (cErr || !newClient) {
      setSavingClient(false);
      toast.error('No se pudo crear el cliente: ' + (cErr?.message || ''));
      return;
    }

    const { error: uErr } = await supabase
      .from('appointments')
      .update({
        client_id: newClient.id,
        client_name_temp: null,
        client_phone_temp: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id);

    setSavingClient(false);
    if (uErr) {
      toast.error('Cliente creado, pero no se pudo vincular a la cita');
      return;
    }
    toast.success(`${clientForm.name.trim()} guardado como cliente`);
    setSaveClientOpen(false);
    reload();
  }

  async function handleReschedule() {
    if (!appointment) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Fecha y hora son obligatorias');
      return;
    }
    setRescheduling(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRescheduling(false); return; }

    const timeToMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const minToTime = (m: number) => {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    const origStart = timeToMin(appointment.start_time);
    const origEnd = appointment.end_time ? timeToMin(appointment.end_time) : origStart + 30;
    const duration = origEnd - origStart;
    const newStartMin = timeToMin(rescheduleTime);
    const newEnd = minToTime(newStartMin + duration);

    const { error } = await supabase
      .from('appointments')
      .update({
        date: rescheduleDate,
        start_time: rescheduleTime,
        end_time: newEnd,
        status: 'Reagendada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id);

    setRescheduling(false);
    if (error) {
      toast.error('No se pudo reagendar: ' + error.message);
      return;
    }
    toast.success('Cita reagendada');
    setRescheduleOpen(false);
    reload();
  }

  if (loading || !appointment) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const style = getApptStatusStyle(appointment.status);
  const isPublicLink = appointment.source === 'public_link';
  const hasRealClient = !!appointment.client;
  const clientName = appointment.client?.name || appointment.client_name_temp || 'Cliente desconocido';
  const clientPhone = appointment.client?.phone || appointment.client_phone_temp || null;
  const clientEmail = appointment.client?.email || null;
  const assignedStaff = appointment.staff;
  const dateObj = new Date(appointment.date + 'T12:00:00');
  const dayIdx = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
  const formattedDate = `${DAYS_ES_FULL[dayIdx]} ${dateObj.getDate()} de ${MONTHS_ES[dateObj.getMonth()].toLowerCase()} ${dateObj.getFullYear()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/citas')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a citas
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={actionLoading}
          className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </Button>
      </div>

      <div className={cn('flex flex-col items-center gap-3 rounded-2xl border-2 p-5', style.border)}>
        <div
          className="rounded-full px-5 py-2 text-base font-bold text-white shadow-md"
          style={{ backgroundColor: style.barColor }}
        >
          {appointment.status}
        </div>
        {isPublicLink && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Link2 className="h-3 w-3" />
            Desde link público
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Información de la cita</h3>
        <div className="space-y-3">
          <InfoRow icon={Calendar} label="Fecha" value={formattedDate} />
          <InfoRow icon={Clock} label="Hora" value={`${appointment.start_time?.slice(0, 5)}${appointment.end_time ? ' \u2014 ' + appointment.end_time.slice(0, 5) : ''}`} />
          <InfoRow icon={Scissors} label="Servicio" value={appointment.service_name || 'Servicio'} />
          {appointment.service_cost ? (
            <InfoRow
              icon={DollarSign}
              label="Precio"
              value={<span className="font-bold text-vylta-green-600 dark:text-vylta-green-400">{formatCurrency(appointment.service_cost)}</span>}
            />
          ) : null}
          {appointment.notes && <InfoRow icon={StickyNote} label="Notas" value={appointment.notes} />}
        </div>
      </div>

      {staffList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Colaborador</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setAssignOpen(true); loadStaffAvailability(); }}
            >
              <Users className="h-3.5 w-3.5" />
              {assignedStaff ? 'Cambiar' : 'Asignar'}
            </Button>
          </div>
          {assignedStaff ? (
            <div
              className="flex items-center gap-3 rounded-lg border-2 p-3"
              style={{ borderColor: `${assignedStaff.color}66`, backgroundColor: `${assignedStaff.color}0D` }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-base font-bold"
                style={{ borderColor: assignedStaff.color, backgroundColor: `${assignedStaff.color}20`, color: assignedStaff.color }}
              >
                {getInitials(assignedStaff.name)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{assignedStaff.name}</div>
                {assignedStaff.role && <div className="text-xs text-muted-foreground">{assignedStaff.role}</div>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-muted-foreground">Sin colaborador asignado</div>
                <div className="text-[11px] text-muted-foreground">Toca “Asignar” para escoger uno</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cliente</h3>
          {isPublicLink && !hasRealClient && (
            <Button size="sm" onClick={() => setSaveClientOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Guardar como cliente
            </Button>
          )}
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white',
            isPublicLink && !hasRealClient ? 'bg-blue-500' : 'bg-vylta-green-500',
          )}>
            {getInitials(clientName)}
          </div>
          <div className="flex-1 space-y-1">
            {hasRealClient && appointment.client?.id ? (
              <Link href={`/clientes?highlight=${appointment.client.id}`} className="text-base font-bold hover:underline">
                {clientName}
              </Link>
            ) : (
              <div className="text-base font-bold">{clientName}</div>
            )}
            {clientPhone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <a href={`https://wa.me/${clientPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-vylta-green-600 dark:hover:text-vylta-green-400">
                  {clientPhone}
                </a>
              </div>
            )}
            {clientEmail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                {clientEmail}
              </div>
            )}
            {isPublicLink && !hasRealClient && (
              <div className="mt-1 inline-block rounded bg-vylta-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-vylta-amber-700 dark:text-amber-400">
                No registrado como cliente aún
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Acciones</h3>
        <StatusActions
          status={appointment.status}
          actionLoading={actionLoading}
          clientName={clientName}
          onChange={handleStatusChange}
          onReschedule={() => setRescheduleOpen(true)}
        />
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar colaborador</DialogTitle>
            <DialogDescription>Selecciona quién atenderá esta cita.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleAssignStaff(null)}
              disabled={actionLoading}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition hover:bg-secondary/50',
                !appointment.staff_id ? 'border-vylta-green-500 bg-vylta-green-500/5' : 'border-border bg-card',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <UserX className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">Sin asignar</div>
                <div className="text-[11px] text-muted-foreground">Quitar asignación actual</div>
              </div>
              {!appointment.staff_id && <CheckCircle2 className="h-5 w-5 text-vylta-green-600 dark:text-vylta-green-400" />}
            </button>
            {staffList.map(m => {
              const isSelected = appointment.staff_id === m.id;
              const isBusy = m.busy === true && !isSelected;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAssignStaff(m.id)}
                  disabled={actionLoading || isBusy}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition',
                    isBusy
                      ? 'cursor-not-allowed border-vylta-rose-500/40 bg-vylta-rose-500/5 opacity-70'
                      : isSelected
                        ? 'bg-vylta-green-500/5'
                        : 'border-border bg-card hover:bg-secondary/50',
                  )}
                  style={isSelected && !isBusy ? { borderColor: m.color, backgroundColor: `${m.color}0D` } : undefined}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold"
                    style={{
                      borderColor: isBusy ? '#EF4444' : m.color,
                      backgroundColor: isBusy ? '#FEE2E2' : `${m.color}20`,
                      color: isBusy ? '#EF4444' : m.color,
                    }}
                  >
                    {getInitials(m.name)}
                  </div>
                  <div className="flex-1">
                    <div className={cn('text-sm font-bold', isBusy && 'text-destructive')}>{m.name}</div>
                    {isBusy ? (
                      <div className="text-[11px] font-semibold text-destructive">⛔ Ocupado en este horario</div>
                    ) : m.role ? (
                      <div className="text-[11px] text-muted-foreground">{m.role}</div>
                    ) : null}
                  </div>
                  {isSelected && !isBusy && <CheckCircle2 className="h-5 w-5" style={{ color: m.color }} />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveClientOpen} onOpenChange={setSaveClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar como cliente</DialogTitle>
            <DialogDescription>Esta información se guardará en tu base de clientes y quedará vinculada a esta cita.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre <span className="text-destructive">*</span></Label>
              <Input value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Teléfono / WhatsApp <span className="text-destructive">*</span></Label>
              <Input value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="Ej: 442 123 4567" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email (opcional)</Label>
              <Input value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notas (opcional)</Label>
              <Textarea value={clientForm.notes} onChange={e => setClientForm(p => ({ ...p, notes: e.target.value }))} placeholder="Preferencias, alergias..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveClientOpen(false)} disabled={savingClient}>Cancelar</Button>
            <Button onClick={handleSaveAsClient} disabled={savingClient}>
              {savingClient ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><UserPlus className="h-4 w-4" /> Guardar cliente</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar cita</DialogTitle>
            <DialogDescription>Selecciona la nueva fecha y hora. La duración se mantiene igual.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nueva fecha</Label>
              <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nueva hora</Label>
              <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} step={300} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={rescheduling}>Cancelar</Button>
            <Button onClick={handleReschedule} disabled={rescheduling}>
              {rescheduling ? <><Loader2 className="h-4 w-4 animate-spin" /> Reagendando...</> : <><CalendarPlus className="h-4 w-4" /> Reagendar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {actionLoading && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-vylta-green-500/10 text-vylta-green-600 dark:text-vylta-green-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function StatusActions({
  status,
  actionLoading,
  clientName,
  onChange,
  onReschedule,
}: {
  status: string;
  actionLoading: boolean;
  clientName: string;
  onChange: (newStatus: string, confirmMsg?: string) => void;
  onReschedule: () => void;
}) {
  if (status === 'Solicitud') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-sm font-bold text-blue-700 dark:text-blue-400">Solicitud desde link público</div>
            <div className="text-xs text-muted-foreground">{clientName} pidió esta cita. Acepta o rechaza para responder.</div>
          </div>
        </div>
        <Button className="w-full bg-vylta-green-500 hover:bg-vylta-green-600" disabled={actionLoading} onClick={() => onChange('Confirmada', `¿Confirmas la cita de ${clientName}?`)}>
          <CheckCircle2 className="h-4 w-4" /> Aceptar solicitud
        </Button>
        <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={actionLoading} onClick={() => onChange('Rechazada', '¿Rechazar esta solicitud?')}>
          <XCircle className="h-4 w-4" /> Rechazar solicitud
        </Button>
      </div>
    );
  }

  if (status === 'En espera') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-vylta-amber-500/40 bg-vylta-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-vylta-amber-700 dark:text-amber-400" />
          <div className="text-sm font-bold text-vylta-amber-700 dark:text-amber-400">Cita en espera de confirmación</div>
        </div>
        <Button className="w-full bg-vylta-green-500 hover:bg-vylta-green-600" disabled={actionLoading} onClick={() => onChange('Confirmada', '¿Aprobar esta cita?')}>
          <CheckCircle2 className="h-4 w-4" /> Aprobar cita
        </Button>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={onReschedule}>
          <CalendarPlus className="h-4 w-4" /> Modificar horario
        </Button>
        <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={actionLoading} onClick={() => onChange('Rechazada', '¿Rechazar esta cita?')}>
          <XCircle className="h-4 w-4" /> Rechazar cita
        </Button>
      </div>
    );
  }

  if (status === 'Pendiente' || status === 'Reagendada') {
    return (
      <div className="space-y-3">
        <Button className="w-full bg-vylta-green-500 hover:bg-vylta-green-600" disabled={actionLoading} onClick={() => onChange('Confirmada', '¿Confirmar esta cita?')}>
          <CheckCircle2 className="h-4 w-4" /> Confirmar cita
        </Button>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={onReschedule}>
          <CalendarPlus className="h-4 w-4" /> Reagendar
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="border-vylta-amber-500/40 text-vylta-amber-700 hover:bg-vylta-amber-500/5 hover:text-vylta-amber-700 dark:text-amber-400" disabled={actionLoading} onClick={() => onChange('No asistió', '¿El cliente no se presentó?')}>
            <UserX className="h-3.5 w-3.5" /> No asistió
          </Button>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={actionLoading} onClick={() => onChange('Cancelada', '¿Cancelar esta cita?')}>
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'Confirmada') {
    return (
      <div className="space-y-3">
        <Button className="w-full bg-vylta-green-500 hover:bg-vylta-green-600" disabled={actionLoading} onClick={() => onChange('Completada', '¿Marcar esta cita como completada?')}>
          <CheckCheck className="h-4 w-4" /> Marcar como completada
        </Button>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={onReschedule}>
          <CalendarPlus className="h-4 w-4" /> Reagendar
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="border-vylta-amber-500/40 text-vylta-amber-700 hover:bg-vylta-amber-500/5 hover:text-vylta-amber-700 dark:text-amber-400" disabled={actionLoading} onClick={() => onChange('No asistió', '¿El cliente no se presentó?')}>
            <UserX className="h-3.5 w-3.5" /> No asistió
          </Button>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={actionLoading} onClick={() => onChange('Cancelada', '¿Cancelar esta cita confirmada?')}>
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'Completada') {
    return (
      <Button className="w-full bg-vylta-green-500 hover:bg-vylta-green-600" disabled={actionLoading} onClick={() => onChange('Pagado', '¿Confirmas que ya se cobró este servicio?')}>
        <DollarSign className="h-4 w-4" /> Marcar como pagado
      </Button>
    );
  }

  if (status === 'Pagado') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 p-4 text-center">
        <CheckCheck className="mr-2 h-5 w-5 text-vylta-green-600 dark:text-vylta-green-400" />
        <span className="text-sm font-bold text-vylta-green-700 dark:text-vylta-green-400">Cita pagada y cerrada</span>
      </div>
    );
  }

  if (status === 'Cancelada' || status === 'No asistió' || status === 'Rechazada') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center rounded-lg border border-border bg-secondary/40 p-4 text-center">
          <span className="text-sm font-semibold text-muted-foreground">Esta cita ya está cerrada como “{status}”</span>
        </div>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={() => onChange('Pendiente', '¿Reactivar esta cita como pendiente?')}>
          <RotateCcw className="h-4 w-4" /> Reactivar como pendiente
        </Button>
      </div>
    );
  }

  return null;
}
