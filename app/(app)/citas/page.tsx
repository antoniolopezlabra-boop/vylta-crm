'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Users,
  CalendarDays,
} from 'lucide-react';
import {
  fetchAppointmentsInRange,
  getWeekDays,
  getApptStatusStyle,
  fetchActiveStaff,
  type AppointmentWithMeta,
} from '@/lib/appointments';
import {
  toLocalDateString,
  DAYS_ES_SHORT,
  MONTHS_ES,
} from '@/lib/date-utils';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog';
import { useSupabaseRealtime } from '@/lib/hooks/use-supabase-realtime';

// ══════════════════════════════════════════════════════════════════════
// Citas — Calendario semanal premium dark VYLTA
//
// Cambios respecto al anterior:
//   • Header con icono + jerarquia tipográfica clara
//   • Nav de semana en botón grupo segmentado premium
//   • Hora actual con línea verde (no rose agresivo) + dot pulsante
//   • Filtros staff como pills más elegantes
//   • Grid sobre vylta-surface, líneas sutiles en border
//   • Mantiene 100% la lógica: realtime, navegación, drag-create
// ══════════════════════════════════════════════════════════════════════

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export default function CitasPage() {
  const router = useRouter();
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentWithMeta[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; color: string; role: string | null }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);
  const weekStart = toLocalDateString(weekDays[0]);
  const weekEnd = toLocalDateString(weekDays[6]);

  async function reload() {
    setLoading(true);
    const [data, staff] = await Promise.all([
      fetchAppointmentsInRange(weekStart, weekEnd),
      fetchActiveStaff(),
    ]);
    setAppointments(data);
    setStaffList(staff);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [weekStart, weekEnd]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtime('appointments', () => reloadRef.current());

  useEffect(() => {
    if (scrollContainerRef.current && !loading) {
      scrollContainerRef.current.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT - 20;
    }
  }, [loading]);

  const filteredAppts = useMemo(() => {
    if (!selectedStaffId) return appointments;
    if (selectedStaffId === '__unassigned__') return appointments.filter(a => !a.staff_id);
    return appointments.filter(a => a.staff_id === selectedStaffId);
  }, [appointments, selectedStaffId]);

  const apptsByDay = useMemo(() => {
    const map: Record<string, AppointmentWithMeta[]> = {};
    weekDays.forEach((d) => {
      map[toLocalDateString(d)] = [];
    });
    filteredAppts.forEach((apt) => {
      if (map[apt.date]) map[apt.date].push(apt);
    });
    return map;
  }, [filteredAppts, weekDays]);

  const countByStaff = useMemo(() => {
    const map: Record<string, number> = { __unassigned__: 0 };
    appointments.forEach(a => {
      if (a.staff_id) map[a.staff_id] = (map[a.staff_id] || 0) + 1;
      else map.__unassigned__++;
    });
    return map;
  }, [appointments]);

  const hasStaff = staffList.length > 0;

  function goToPrevWeek() {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 7);
    setReferenceDate(d);
  }
  function goToNextWeek() {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 7);
    setReferenceDate(d);
  }
  function goToToday() {
    setReferenceDate(new Date());
  }

  function openNewAppointment(dateStr?: string) {
    setInitialDate(dateStr);
    setFormOpen(true);
  }

  const rangeLabel = (() => {
    const m1 = weekDays[0].getMonth();
    const m2 = weekDays[6].getMonth();
    const y = weekDays[0].getFullYear();
    if (m1 === m2) return `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS_ES[m1]} ${y}`;
    return `${weekDays[0].getDate()} ${MONTHS_ES[m1].slice(0, 3)} – ${weekDays[6].getDate()} ${MONTHS_ES[m2].slice(0, 3)} ${y}`;
  })();

  const todayStr = toLocalDateString(new Date());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPercent = ((nowMinutes - START_HOUR * 60) / (TOTAL_HOURS * 60)) * 100;
  const showNowLine = nowPercent >= 0 && nowPercent <= 100;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 animate-fade-in">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vylta-green/10 ring-1 ring-vylta-green/20">
            <CalendarDays className="h-5 w-5 text-vylta-green" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-vylta-bone">Citas</h1>
            <p className="text-sm text-vylta-muted">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-vylta-surface overflow-hidden">
            <button
              onClick={goToPrevWeek}
              className="flex h-9 w-9 items-center justify-center text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToToday}
              className="border-x border-border px-3.5 text-xs font-semibold text-vylta-bone transition hover:bg-vylta-card"
            >
              Hoy
            </button>
            <button
              onClick={goToNextWeek}
              className="flex h-9 w-9 items-center justify-center text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => openNewAppointment()}>
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* ═══ FILTROS DE STAFF ═══ */}
      {hasStaff && (
        <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-vylta-surface px-2 py-2 shadow-card-sm">
          <button
            onClick={() => setSelectedStaffId(null)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
              !selectedStaffId
                ? 'border-vylta-green/40 bg-vylta-green/10 text-vylta-green'
                : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
            )}
          >
            <Users className="h-3 w-3" />
            Todos
            <span className={cn('ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', !selectedStaffId ? 'bg-vylta-green/20 text-vylta-green' : 'bg-vylta-card text-vylta-muted')}>
              {appointments.length}
            </span>
          </button>
          {staffList.map(m => {
            const isActive = selectedStaffId === m.id;
            const count = countByStaff[m.id] || 0;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedStaffId(isActive ? null : m.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
                  isActive ? '' : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
                )}
                style={isActive ? { borderColor: `${m.color}66`, backgroundColor: `${m.color}1a`, color: m.color } : undefined}
              >
                <div
                  className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                  style={{ backgroundColor: `${m.color}33`, color: m.color }}
                >
                  {getInitials(m.name)}
                </div>
                {m.name.split(' ')[0]}
                {count > 0 && (
                  <span
                    className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{ backgroundColor: isActive ? `${m.color}33` : 'rgba(255,255,255,0.05)', color: isActive ? m.color : '#94A3B8' }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {countByStaff.__unassigned__ > 0 && (
            <button
              onClick={() => setSelectedStaffId(selectedStaffId === '__unassigned__' ? null : '__unassigned__')}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
                selectedStaffId === '__unassigned__'
                  ? 'border-vylta-subtle/40 bg-vylta-subtle/10 text-vylta-bone'
                  : 'border-border bg-transparent text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
              )}
            >
              Sin asignar
              <span className="ml-0.5 rounded-full bg-vylta-card px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{countByStaff.__unassigned__}</span>
            </button>
          )}
        </div>
      )}

      {/* ═══ CALENDARIO ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-vylta-surface shadow-card">
        {/* Header de días */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-vylta-card/30">
          <div className="border-r border-border" />
          {weekDays.map((day, idx) => {
            const dateStr = toLocalDateString(day);
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => openNewAppointment(dateStr)}
                className={cn(
                  'flex flex-col items-center gap-1 border-r border-border py-3 last:border-r-0 transition-colors hover:bg-vylta-card/40',
                  isToday && 'bg-vylta-green/[0.04]',
                )}
                title={`Nueva cita para ${dateStr}`}
              >
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.15em]',
                  isToday ? 'text-vylta-green' : 'text-vylta-subtle',
                )}>
                  {DAYS_ES_SHORT[idx]}
                </span>
                <span className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums transition',
                  isToday
                    ? 'bg-vylta-green text-white shadow-[0_0_12px_hsl(160_84%_39%/0.5)]'
                    : 'text-vylta-bone',
                )}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid de horas */}
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-vylta-surface/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-vylta-green" />
            </div>
          )}

          <div className="relative grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
            {/* Columna de horas */}
            <div className="border-r border-border">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = START_HOUR + i;
                return (
                  <div key={hour} className="relative border-b border-border" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="absolute -top-2 right-2 text-[10px] font-semibold uppercase tabular-nums text-vylta-subtle">
                      {formatHour(hour)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Columnas de días */}
            {weekDays.map((day) => {
              const dateStr = toLocalDateString(day);
              const dayAppts = apptsByDay[dateStr] || [];
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={dateStr}
                  className={cn(
                    'relative border-r border-border last:border-r-0',
                    isToday && 'bg-vylta-green/[0.025]',
                  )}
                >
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div key={i} className="border-b border-border/50" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Línea de hora actual — verde VYLTA con dot pulsante */}
                  {isToday && showNowLine && (
                    <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: `${nowPercent}%` }}>
                      <span className="relative -ml-2 flex h-3 w-3">
                        <span className="absolute inset-0 animate-ping rounded-full bg-vylta-green/60" />
                        <span className="relative h-3 w-3 rounded-full bg-vylta-green shadow-[0_0_8px_hsl(160_84%_39%/0.7)]" />
                      </span>
                      <div className="h-px flex-1 bg-vylta-green/70" />
                    </div>
                  )}

                  {dayAppts.map((apt) => (
                    <AppointmentBlock
                      key={apt.id}
                      appointment={apt}
                      onClick={() => router.push(`/citas/${apt.id}`)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialDate={initialDate}
        onSuccess={() => reload()}
      />
    </div>
  );
}

function AppointmentBlock({
  appointment,
  onClick,
}: {
  appointment: AppointmentWithMeta;
  onClick: () => void;
}) {
  const style = getApptStatusStyle(appointment.status);
  const startMinFromVisible = appointment.startMinutes - START_HOUR * 60;
  const duration = Math.max(15, appointment.endMinutes - appointment.startMinutes);

  const top = (startMinFromVisible / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;

  if (startMinFromVisible < 0 || startMinFromVisible >= TOTAL_HOURS * 60) return null;

  const borderColor = appointment.staff?.color || style.barColor;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'group absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[10px] shadow-sm transition-all hover:z-10 hover:shadow-md hover:scale-[1.02] hover:brightness-110',
        style.bg,
        style.text,
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(20, height - 1)}px`,
        borderLeftColor: borderColor,
      }}
      title={`${appointment.displayClientName} · ${appointment.service_name} · ${appointment.start_time}`}
    >
      <div className="flex items-center gap-1">
        {appointment.staff && (
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: appointment.staff.color }}
          />
        )}
        <div className="truncate font-semibold leading-tight">{appointment.displayClientName}</div>
      </div>
      {height >= 30 && (
        <div className="truncate text-[9px] opacity-80">{appointment.service_name}</div>
      )}
      {height >= 50 && (
        <div className="mt-0.5 flex items-center justify-between text-[9px] opacity-70">
          <span className="tabular-nums">{appointment.start_time.slice(0, 5)}</span>
          {appointment.service_cost && (
            <span className="tabular-nums font-bold">{formatCurrency(appointment.service_cost)}</span>
          )}
        </div>
      )}
    </button>
  );
}

function formatHour(hour24: number): string {
  if (hour24 === 0) return '12 AM';
  if (hour24 === 12) return '12 PM';
  if (hour24 < 12) return `${hour24} AM`;
  return `${hour24 - 12} PM`;
}
