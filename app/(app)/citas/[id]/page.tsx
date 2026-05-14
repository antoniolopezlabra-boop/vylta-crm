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
  CalendarDays,
  Pencil,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  updateAppointmentStatus,
  assignStaffToAppointment,
  softDeleteAppointment,
  restoreAppointment,
  hardDeleteAppointment,
  HARD_DELETABLE_STATUSES,
  fetchActiveStaff,
  getStaffAvailability,
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
import { useTimeBlocks } from '@/lib/queries/use-time-blocks';
import { useAppointment, useInvalidateAppointment } from '@/lib/queries/use-appointment';
import { useInvalidateAppointments } from '@/lib/queries/use-appointments';
import { RescheduleDialog } from '@/components/appointments/reschedule-dialog';
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog';

// ═════════════════════════════════════════════════════════════════════
// Detail de cita — Sprint 3:
//   • Edit en modo dialog
//   • Cancelar (soft delete) con undo 8s
//   • NUEVO: Eliminar permanentemente (hard delete) con doble confirmación
//     Solo aparece si status está en HARD_DELETABLE_STATUSES (Cancelada
//     o Rechazada). NO se permite borrar permanentemente citas activas
//     o pagadas (protege historial fiscal).
// ═════════════════════════════════════════════════════════════════════

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data: appointment, isLoading } = useAppointment(id);
  const invalidateAppointment = useInvalidateAppointment(id);
  const invalidateAppointments = useInvalidateAppointments();
  const { data: timeBlocks = [] } = useTimeBlocks();

  const [actionLoading, setActionLoading] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; color: string; role: string | null; busy?: boolean }>>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saveClientOpen, setSaveClientOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteStep, setHardDeleteStep] = useState<1 | 2>(1);

  // Refresca lista de citas en /citas (Realtime ya invalida pero forzamos por seguridad)
  function refreshAll() {
    invalidateAppointment();
    invalidateAppointments();
  }

  // Cargar staff al montar (una sola vez)
  useEffect(() => {
    fetchActiveStaff().then(staff => {
      setStaffList(staff.map(s => ({ ...s, busy: false })));
    });
  }, []);

  // Cuando la cita carga y es de link público sin cliente, prellenar form
  useEffect(() => {
    if (appointment?.source === 'public_link' && !appointment.client) {
      setClientForm({
        name: appointment.client_name_temp || '',
        phone: appointment.client_phone_temp || '',
        email: '',
        notes: '',
      });
    }
  }, [appointment?.id, appointment?.source, appointment?.client, appointment?.client_name_temp, appointment?.client_phone_temp]);

  // Reset del paso de hard delete cuando el dialog cierra
  useEffect(() => {
    if (!hardDeleteOpen) {
      // Pequeño delay para que el usuario no vea el cambio antes de que cierre
      const t = setTimeout(() => setHardDeleteStep(1), 200);
      return () => clearTimeout(t);
    }
  }, [hardDeleteOpen]);

  async function loadStaffAvailability() {
    if (!appointment) return;
    const busySet = await getStaffAvailability(
      appointment.date,
      appointment.start_time,
      appointment.end_time || appointment.start_time,
      appointment.id,
      timeBlocks,
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
    refreshAll();
  }

  async function handleAssignStaff(staffId: string | null) {
    if (!appointment) return;
    const member = staffId ? staffList.find(s => s.id === staffId) : null;
    if (member?.busy) {
      toast.error(`${member.name} ya tiene una cita o bloqueo en este horario`);
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
    refreshAll();
  }

  // ── SOFT DELETE con UNDO ──
  // En lugar de DELETE permanente, pone status='Cancelada'.
  // Muestra toast con botón "Deshacer" durante 8s que restaura el status original.
  async function handleSoftDelete() {
    if (!appointment) return;
    if (!confirm('¿Cancelar esta cita? Podrás restaurarla durante 8 segundos.')) return;
    const previousStatus = appointment.status;
    setActionLoading(true);
    const result = await softDeleteAppointment(appointment.id, previousStatus);
    setActionLoading(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    refreshAll();

    // Toast con undo
    toast.success('Cita cancelada', {
      duration: 8000,
      action: {
        label: 'Deshacer',
        onClick: async () => {
          const restore = await restoreAppointment(appointment.id, previousStatus);
          if ('error' in restore) {
            toast.error('No se pudo restaurar la cita');
            return;
          }
          toast.success('Cita restaurada');
          refreshAll();
        },
      },
    });
  }

  // ── HARD DELETE con DOBLE CONFIRMACIÓN ──
  // Elimina permanentemente la cita de la BD. NO se puede recuperar.
  // Solo permitido para citas con status en HARD_DELETABLE_STATUSES.
  // El botón requiere 2 clicks intencionales (step 1 → step 2 → ejecución).
  async function handleHardDelete() {
    if (!appointment) return;
    setActionLoading(true);
    const result = await hardDeleteAppointment(appointment.id);
    setActionLoading(false);

    if ('error' in result) {
      toast.error(result.error);
      setHardDeleteOpen(false);
      return;
    }

    toast.success('Cita eliminada permanentemente');
    setHardDeleteOpen(false);
    invalidateAppointments();
    // Regresar a la lista, esta cita ya no existe
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
    refreshAll();
  }

  if (isLoading || !appointment) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-vylta-green" />
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

  // Estados cerrados (no editables)
  const isClosedStatus = ['Cancelada', 'Rechazada'].includes(appointment.status);
  // En estados "terminales" como Pagado, edición es riesgosa pero permitida (warning)
  const isFinalStatus = appointment.status === 'Pagado';
  // ¿Puede borrarse permanentemente? Solo si está en uno de los status seguros.
  const canHardDelete = HARD_DELETABLE_STATUSES.includes(appointment.status);

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => router.push('/citas')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-vylta-muted transition hover:text-vylta-bone"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a citas
        </button>
        <div className="flex items-center gap-2">
          {!isClosedStatus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              disabled={actionLoading}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {/* Botón CANCELAR (soft delete) — solo si la cita NO está cerrada */}
          {!isClosedStatus && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSoftDelete}
              disabled={actionLoading}
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
              title="Cancelar cita (recuperable durante 8 segundos)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          )}
          {/* Botón ELIMINAR PERMANENTE — solo si la cita ya está Cancelada/Rechazada */}
          {canHardDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHardDeleteOpen(true)}
              disabled={actionLoading}
              className="border-vylta-rose/40 bg-vylta-rose/5 text-vylta-rose hover:bg-vylta-rose/10 hover:text-vylta-rose"
              title="Eliminar permanentemente de la base de datos (no se puede deshacer)"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Eliminar permanente
            </Button>
          )}
        </div>
      </div>

      {/* STATUS BADGE */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-vylta-surface p-6 shadow-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ background: `radial-gradient(ellipse at top right, ${style.barColor}, transparent 60%)` }}
        />
        <div className="relative flex flex-col items-center gap-3">
          <div
            className="rounded-full px-5 py-2 text-base font-bold text-white shadow-cta"
            style={{ backgroundColor: style.barColor }}
          >
            {appointment.status}
          </div>
          {isPublicLink && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vylta-luxury/15 px-3 py-1 text-xs font-bold text-vylta-luxury border border-vylta-luxury/25">
              <Link2 className="h-3 w-3" />
              Desde link público
            </span>
          )}
          {isFinalStatus && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vylta-amber/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-vylta-amber border border-vylta-amber/25">
              <AlertTriangle className="h-2.5 w-2.5" />
              Cita cobrada — editar con cuidado
            </span>
          )}
        </div>
      </div>

      {/* INFORMACIÓN DE LA CITA */}
      <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-vylta-green" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">Información de la cita</h3>
        </div>
        <div className="space-y-3">
          <InfoRow icon={Calendar} label="Fecha" value={formattedDate} />
          <InfoRow icon={Clock} label="Hora" value={`${appointment.start_time?.slice(0, 5)}${appointment.end_time ? ' \u2014 ' + appointment.end_time.slice(0, 5) : ''}`} />
          <InfoRow icon={Scissors} label="Servicio" value={appointment.service_name || 'Servicio'} />
          {appointment.service_cost ? (
            <InfoRow
              icon={DollarSign}
              label="Precio"
              value={<span className="font-bold text-vylta-green">{formatCurrency(appointment.service_cost)}</span>}
            />
          ) : null}
          {appointment.notes && <InfoRow icon={StickyNote} label="Notas" value={appointment.notes} />}
        </div>
      </div>

      {/* COLABORADOR */}
      {staffList.length > 0 && (
        <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-vylta-green" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">Colaborador</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setAssignOpen(true); loadStaffAvailability(); }}
              disabled={isClosedStatus}
            >
              <Users className="h-3.5 w-3.5" />
              {assignedStaff ? 'Cambiar' : 'Asignar'}
            </Button>
          </div>
          {assignedStaff ? (
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: `${assignedStaff.color}66`, backgroundColor: `${assignedStaff.color}0D` }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-base font-bold"
                style={{ borderColor: assignedStaff.color, backgroundColor: `${assignedStaff.color}20`, color: assignedStaff.color }}
              >
                {getInitials(assignedStaff.name)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-vylta-bone">{assignedStaff.name}</div>
                {assignedStaff.role && <div className="text-xs text-vylta-muted">{assignedStaff.role}</div>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-vylta-card/40 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-vylta-card text-vylta-subtle">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-vylta-muted">Sin colaborador asignado</div>
                <div className="text-[11px] text-vylta-subtle">Toca "Asignar" para escoger uno</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLIENTE */}
      <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-vylta-green" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">Cliente</h3>
          </div>
          {isPublicLink && !hasRealClient && (
            <Button size="sm" onClick={() => setSaveClientOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Guardar como cliente
            </Button>
          )}
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-vylta-card/40 p-3">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white ring-1',
            isPublicLink && !hasRealClient
              ? 'bg-vylta-luxury ring-vylta-luxury/30'
              : 'bg-vylta-green ring-vylta-green/30',
          )}>
            {getInitials(clientName)}
          </div>
          <div className="flex-1 space-y-1">
            {hasRealClient && appointment.client?.id ? (
              <Link href={`/clientes?highlight=${appointment.client.id}`} className="text-base font-bold text-vylta-bone hover:underline">
                {clientName}
              </Link>
            ) : (
              <div className="text-base font-bold text-vylta-bone">{clientName}</div>
            )}
            {clientPhone && (
              <div className="flex items-center gap-1.5 text-xs text-vylta-muted">
                <Phone className="h-3 w-3" />
                <a href={`https://wa.me/${clientPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-vylta-whatsapp">
                  {clientPhone}
                </a>
              </div>
            )}
            {clientEmail && (
              <div className="flex items-center gap-1.5 text-xs text-vylta-muted">
                <Mail className="h-3 w-3" />
                {clientEmail}
              </div>
            )}
            {isPublicLink && !hasRealClient && (
              <div className="mt-1 inline-block rounded bg-vylta-amber/15 px-2 py-0.5 text-[10px] font-semibold text-vylta-amber border border-vylta-amber/25">
                No registrado como cliente aún
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="rounded-xl border border-border bg-vylta-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-vylta-green" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-vylta-muted">Acciones</h3>
        </div>
        <StatusActions
          status={appointment.status}
          actionLoading={actionLoading}
          clientName={clientName}
          onChange={handleStatusChange}
          onReschedule={() => setRescheduleOpen(true)}
        />
      </div>

      {/* DIALOG ASIGNAR STAFF */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-vylta-bone">Asignar colaborador</DialogTitle>
            <DialogDescription className="text-vylta-muted">
              Selecciona quién atenderá esta cita. Los ocupados tienen otra cita o bloqueo en este horario.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleAssignStaff(null)}
              disabled={actionLoading}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-vylta-card/50',
                !appointment.staff_id ? 'border-vylta-green/40 bg-vylta-green/5' : 'border-border bg-vylta-surface',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vylta-card text-vylta-subtle">
                <UserX className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-vylta-bone">Sin asignar</div>
                <div className="text-[11px] text-vylta-muted">Quitar asignación actual</div>
              </div>
              {!appointment.staff_id && <CheckCircle2 className="h-5 w-5 text-vylta-green" />}
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
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
                    isBusy
                      ? 'cursor-not-allowed border-vylta-rose/40 bg-vylta-rose/5 opacity-70'
                      : isSelected
                        ? ''
                        : 'border-border bg-vylta-surface hover:bg-vylta-card/50',
                  )}
                  style={isSelected && !isBusy ? { borderColor: m.color, backgroundColor: `${m.color}0D` } : undefined}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold"
                    style={{
                      borderColor: isBusy ? '#F43F5E' : m.color,
                      backgroundColor: isBusy ? 'rgba(244,63,94,0.15)' : `${m.color}20`,
                      color: isBusy ? '#F43F5E' : m.color,
                    }}
                  >
                    {getInitials(m.name)}
                  </div>
                  <div className="flex-1">
                    <div className={cn('text-sm font-bold', isBusy ? 'text-vylta-rose' : 'text-vylta-bone')}>{m.name}</div>
                    {isBusy ? (
                      <div className="text-[11px] font-semibold text-vylta-rose">⛔ Ocupado en este horario</div>
                    ) : m.role ? (
                      <div className="text-[11px] text-vylta-muted">{m.role}</div>
                    ) : null}
                  </div>
                  {isSelected && !isBusy && <CheckCircle2 className="h-5 w-5" style={{ color: m.color }} />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG GUARDAR COMO CLIENTE */}
      <Dialog open={saveClientOpen} onOpenChange={setSaveClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-vylta-bone">Guardar como cliente</DialogTitle>
            <DialogDescription className="text-vylta-muted">
              Esta información se guardará en tu base de clientes y quedará vinculada a esta cita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Nombre <span className="text-destructive">*</span></Label>
              <Input value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Teléfono / WhatsApp <span className="text-destructive">*</span></Label>
              <Input value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="Ej: 442 123 4567" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Email (opcional)</Label>
              <Input value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-vylta-muted">Notas (opcional)</Label>
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

      {/* DIALOG HARD DELETE — doble confirmación */}
      <Dialog open={hardDeleteOpen} onOpenChange={setHardDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-vylta-rose">
              <ShieldAlert className="h-5 w-5" />
              {hardDeleteStep === 1 ? '¿Eliminar permanentemente?' : 'Confirmación final'}
            </DialogTitle>
            <DialogDescription className="text-vylta-muted">
              {hardDeleteStep === 1
                ? 'Esta acción no se puede deshacer.'
                : 'Última oportunidad para cancelar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Card con datos de la cita */}
            <div className="rounded-lg border border-vylta-rose/30 bg-vylta-rose/5 p-3">
              <div className="text-xs font-semibold text-vylta-rose mb-1">Vas a eliminar:</div>
              <div className="text-sm font-bold text-vylta-bone">{clientName}</div>
              <div className="text-xs text-vylta-muted mt-0.5">
                {appointment.service_name} · {formattedDate} · {appointment.start_time?.slice(0, 5)}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-vylta-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-muted">
                Status: {appointment.status}
              </div>
            </div>

            {hardDeleteStep === 1 ? (
              <div className="rounded-lg border border-vylta-amber/30 bg-vylta-amber/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-vylta-amber mt-0.5" />
                  <div className="text-xs text-vylta-bone">
                    Esta cita se borrará <strong>permanentemente</strong> de la base de datos.
                    No aparecerá en reportes, historial ni en ningún lugar. <strong>No hay forma de recuperarla.</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-vylta-rose/40 bg-vylta-rose/10 p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-vylta-rose mt-0.5" />
                  <div className="text-xs text-vylta-bone">
                    ¿Estás 100% seguro? Si haces click en <strong>"Sí, eliminar"</strong> la cita se borrará ahora mismo.
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            {hardDeleteStep === 1 ? (
              <Button
                onClick={() => setHardDeleteStep(2)}
                disabled={actionLoading}
                className="bg-vylta-rose hover:bg-vylta-rose/90 text-white"
              >
                <ShieldAlert className="h-4 w-4" />
                Continuar
              </Button>
            ) : (
              <Button
                onClick={handleHardDelete}
                disabled={actionLoading}
                className="bg-vylta-rose hover:bg-vylta-rose/90 text-white"
              >
                {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</> : <><Trash2 className="h-4 w-4" /> Sí, eliminar</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESCHEDULE DIALOG */}
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        appointment={appointment}
        onSuccess={refreshAll}
      />

      {/* EDIT DIALOG — usa el AppointmentFormDialog en modo edición */}
      <AppointmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialAppointment={appointment}
        onSuccess={refreshAll}
      />

      {actionLoading && !hardDeleteOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-vylta-green" />
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-vylta-green/10 text-vylta-green ring-1 ring-vylta-green/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-subtle">{label}</div>
        <div className="text-sm font-semibold text-vylta-bone">{value}</div>
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
        <div className="flex items-start gap-3 rounded-lg border border-vylta-luxury/30 bg-vylta-luxury/5 p-3">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-vylta-luxury" />
          <div>
            <div className="text-sm font-bold text-vylta-luxury">Solicitud desde link público</div>
            <div className="text-xs text-vylta-muted">{clientName} pidió esta cita. Acepta o rechaza para responder.</div>
          </div>
        </div>
        <Button className="w-full" disabled={actionLoading} onClick={() => onChange('Confirmada', `¿Confirmas la cita de ${clientName}?`)}>
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
        <div className="flex items-start gap-3 rounded-lg border border-vylta-amber/40 bg-vylta-amber/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-vylta-amber" />
          <div className="text-sm font-bold text-vylta-amber">Cita en espera de confirmación</div>
        </div>
        <Button className="w-full" disabled={actionLoading} onClick={() => onChange('Confirmada', '¿Aprobar esta cita?')}>
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
        <Button className="w-full" disabled={actionLoading} onClick={() => onChange('Confirmada', '¿Confirmar esta cita?')}>
          <CheckCircle2 className="h-4 w-4" /> Confirmar cita
        </Button>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={onReschedule}>
          <CalendarPlus className="h-4 w-4" /> Reagendar
        </Button>
        <Button variant="outline" className="w-full border-vylta-amber/40 text-vylta-amber hover:bg-vylta-amber/5 hover:text-vylta-amber" disabled={actionLoading} onClick={() => onChange('No asistió', '¿El cliente no se presentó?')}>
          <UserX className="h-3.5 w-3.5" /> No asistió
        </Button>
      </div>
    );
  }

  if (status === 'Confirmada') {
    return (
      <div className="space-y-3">
        <Button className="w-full" disabled={actionLoading} onClick={() => onChange('Completada', '¿Marcar esta cita como completada?')}>
          <CheckCheck className="h-4 w-4" /> Marcar como completada
        </Button>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={onReschedule}>
          <CalendarPlus className="h-4 w-4" /> Reagendar
        </Button>
        <Button variant="outline" className="w-full border-vylta-amber/40 text-vylta-amber hover:bg-vylta-amber/5 hover:text-vylta-amber" disabled={actionLoading} onClick={() => onChange('No asistió', '¿El cliente no se presentó?')}>
          <UserX className="h-3.5 w-3.5" /> No asistió
        </Button>
      </div>
    );
  }

  if (status === 'Completada') {
    return (
      <Button className="w-full" disabled={actionLoading} onClick={() => onChange('Pagado', '¿Confirmas que ya se cobró este servicio?')}>
        <DollarSign className="h-4 w-4" /> Marcar como pagado
      </Button>
    );
  }

  if (status === 'Pagado') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-vylta-green/30 bg-vylta-green/5 p-4 text-center">
        <CheckCheck className="mr-2 h-5 w-5 text-vylta-green" />
        <span className="text-sm font-bold text-vylta-green">Cita pagada y cerrada</span>
      </div>
    );
  }

  if (status === 'Cancelada' || status === 'No asistió' || status === 'Rechazada') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center rounded-lg border border-border bg-vylta-card/40 p-4 text-center">
          <span className="text-sm font-semibold text-vylta-muted">Esta cita ya está cerrada como "{status}"</span>
        </div>
        <Button variant="outline" className="w-full" disabled={actionLoading} onClick={() => onChange('Pendiente', '¿Reactivar esta cita como pendiente?')}>
          <RotateCcw className="h-4 w-4" /> Reactivar como pendiente
        </Button>
      </div>
    );
  }

  return null;
}
