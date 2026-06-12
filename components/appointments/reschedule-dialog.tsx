'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CalendarPlus,
  CheckCircle2,
  Ban,
  Coffee,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/date-utils';
import { useTimeBlocks } from '@/lib/queries/use-time-blocks';
import { getBlocksForDate, findBlockConflict } from '@/lib/time-blocks';
import { updateAppointmentSchedule, type Appointment } from '@/lib/appointments';

// ══════════════════════════════════════════════════════════════════════
// RescheduleDialog — reagendar con las MISMAS 4 capas de validación
// del form de crear cita. La duración se calcula del end_time − start_time
// existentes para mantenerla constante.
// ══════════════════════════════════════════════════════════════════════

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 21;
const SLOT_INTERVAL_MIN = 15;
const PAST_SLOT_BUFFER_MIN = 5;

type BlockReason =
  | { kind: 'past' }
  | { kind: 'block'; label: string }
  | { kind: 'booking'; clientName: string }
  | { kind: 'no-fit' };

interface BookedSlot {
  start: number;
  end: number;
  clientName: string;
  staffId: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
  onSuccess: () => void;
}

export function RescheduleDialog({ open, onOpenChange, appointment, onSuccess }: Props) {
  const { data: timeBlocks = [] } = useTimeBlocks();

  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Horario real del negocio por día (0=Dom..6=Sáb). Sin fila = fallback 8-21.
  const [businessHours, setBusinessHours] = useState<Record<number, { open: boolean; start: number; end: number }>>({});

  // Calcular duración de la cita original
  const duration = useMemo(() => {
    if (!appointment.end_time) return 60;
    const start = timeToMinutes(appointment.start_time);
    const end = timeToMinutes(appointment.end_time);
    return Math.max(15, end - start);
  }, [appointment]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setDate(appointment.date);
      setTime('');
    }
  }, [open, appointment]);

  // Reloj para slots pasados
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [open]);

  // Cargar el horario real del negocio (una vez al abrir).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: bh } = await supabase
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_open')
        .eq('user_id', user.id);
      if (cancelled) return;
      const hoursMap: Record<number, { open: boolean; start: number; end: number }> = {};
      (bh || []).forEach((r: any) => {
        hoursMap[r.day_of_week] = {
          open: !!r.is_open,
          start: timeToMinutes(r.start_time || '08:00'),
          end: timeToMinutes(r.end_time || '21:00'),
        };
      });
      setBusinessHours(hoursMap);
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Fetch citas del día seleccionado (excluyendo la cita actual)
  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, client_name_temp, staff_id, client:clients(name)')
        .eq('user_id', user.id)
        .eq('date', date);
      if (!data || cancelled) return;
      const EXCLUDED = ['Cancelada', 'No asistió', 'Rechazada'];
      const active = data
        .filter((a: any) => !EXCLUDED.includes(a.status) && a.id !== appointment.id)
        .map((a: any) => {
          const startMin = timeToMinutes(a.start_time);
          const endMin = a.end_time ? timeToMinutes(a.end_time) : startMin + 60;
          return {
            start: startMin,
            end: endMin,
            clientName: a.client?.name || a.client_name_temp || 'Cita',
            staffId: a.staff_id,
          } as BookedSlot;
        });
      setBookedSlots(active);
    })();
    return () => { cancelled = true; };
  }, [open, date, appointment.id]);

  const slots = useMemo(() => {
    const result: Array<{
      time: string;
      minutes: number;
      blocked: boolean;
      reason: BlockReason | null;
    }> = [];

    const staffId = appointment.staff_id;
    const todayStr = toLocalDateString(new Date());
    const isToday = date === todayStr;
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + PAST_SLOT_BUFFER_MIN;

    const blocksForDate = getBlocksForDate(timeBlocks, date, staffId);

    // ⚡ Horario real del negocio para el día (no más 8-21 fijos). Parse local.
    const [yy, moo, dd] = (date || '').split('-').map(Number);
    const weekday = yy ? new Date(yy, (moo || 1) - 1, dd || 1).getDay() : 0;
    const dayHours = businessHours[weekday];
    if (dayHours && !dayHours.open) return result; // cerrado ese día
    const openMin = dayHours ? dayHours.start : SLOT_START_HOUR * 60;
    const closeMin = dayHours ? dayHours.end : SLOT_END_HOUR * 60;

    for (let minutes = openMin; minutes <= closeMin; minutes += SLOT_INTERVAL_MIN) {
      {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const slotEnd = minutes + duration;

        if (isToday && minutes < nowMinutes) {
          result.push({ time: timeStr, minutes, blocked: true, reason: { kind: 'past' } });
          continue;
        }

        const blockConflict = findBlockConflict(minutes, duration, blocksForDate);
        if (blockConflict) {
          result.push({
            time: timeStr,
            minutes,
            blocked: true,
            reason: { kind: 'block', label: blockConflict.label },
          });
          continue;
        }

        const bookingConflict = bookedSlots.find(b => {
          if (staffId && b.staffId && b.staffId !== staffId) return false;
          if (!staffId && b.staffId) return false;
          return minutes < b.end && slotEnd > b.start;
        });
        if (bookingConflict) {
          result.push({
            time: timeStr,
            minutes,
            blocked: true,
            reason: { kind: 'booking', clientName: bookingConflict.clientName },
          });
          continue;
        }

        if (slotEnd > closeMin) {
          result.push({ time: timeStr, minutes, blocked: true, reason: { kind: 'no-fit' } });
          continue;
        }

        result.push({ time: timeStr, minutes, blocked: false, reason: null });
      }
    }

    return result;
  }, [bookedSlots, duration, appointment.staff_id, date, timeBlocks, now, businessHours]);

  const availableCount = slots.filter(s => !s.blocked).length;
  const grouped = useMemo(() => {
    const map: Record<number, typeof slots> = {};
    slots.forEach(s => {
      const h = Math.floor(s.minutes / 60);
      if (!map[h]) map[h] = [];
      map[h].push(s);
    });
    return map;
  }, [slots]);

  async function handleReschedule() {
    if (!time) {
      toast.error('Selecciona un horario disponible');
      return;
    }
    setSaving(true);
    const newStart = timeToMinutes(time);
    const newEnd = newStart + duration;
    const endTimeStr = minutesToTimeStr(newEnd);

    // Si la cita estaba pagada/completada, no forzar 'Reagendada' (raro reagendar algo cobrado, pero por si acaso)
    const newStatus = appointment.status === 'Pagado' || appointment.status === 'Completada'
      ? 'Reagendada'
      : 'Reagendada';

    const result = await updateAppointmentSchedule(appointment.id, date, time, endTimeStr, newStatus);
    setSaving(false);

    if ('error' in result) {
      toast.error('No se pudo reagendar: ' + result.error);
      return;
    }
    toast.success('Cita reagendada');
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-vylta-bone">Reagendar cita</DialogTitle>
          <DialogDescription className="text-vylta-muted">
            La duración se mantiene en {duration} min. Elige nueva fecha y horario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
              <CalendarIcon className="h-3 w-3 text-vylta-subtle" />
              Nueva fecha
            </Label>
            <Input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setTime(''); }}
              min={toLocalDateString(new Date())}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-vylta-muted">
              <Clock className="h-3 w-3 text-vylta-subtle" />
              Nuevo horario
            </Label>

            {availableCount === 0 ? (
              <div className="rounded-lg border border-dashed border-vylta-amber/40 bg-vylta-amber/5 px-4 py-6 text-center">
                <Clock className="mx-auto h-5 w-5 text-vylta-amber" />
                <p className="mt-2 text-xs font-semibold text-vylta-amber">Sin horarios disponibles</p>
                <p className="mt-0.5 text-[11px] text-vylta-muted">
                  Prueba otro día.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-border bg-vylta-card/30 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-vylta-muted">
                  <LegendDot color="bg-vylta-green" label="Disponible" />
                  <LegendDot color="bg-vylta-card ring-1 ring-border" label="Ocupado" />
                  <LegendDot color="bg-vylta-luxury/40" label="Bloqueo" />
                  <LegendDot color="bg-vylta-subtle/30" label="Pasado" />
                  <span className="ml-auto tabular-nums">
                    Duración: <strong className="text-vylta-bone">{duration} min</strong>
                  </span>
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
                            isSelected={time === slot.time}
                            onSelect={() => setTime(slot.time)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleReschedule} disabled={saving || !time}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Reagendando...</>
            ) : (
              <><CalendarPlus className="h-4 w-4" /> Reagendar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function SlotButton({ slot, isSelected, onSelect }: { slot: any; isSelected: boolean; onSelect: () => void }) {
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
      {Icon && <Icon className="absolute top-0.5 right-0.5 h-2.5 w-2.5 opacity-60" />}
    </button>
  );
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeStr(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatHour(hour24: number): string {
  if (hour24 === 0) return '12 AM';
  if (hour24 === 12) return '12 PM';
  if (hour24 < 12) return `${hour24} AM`;
  return `${hour24 - 12} PM`;
}
