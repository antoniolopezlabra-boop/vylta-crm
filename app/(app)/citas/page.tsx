'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  fetchAppointmentsInRange,
  getWeekDays,
  getApptStatusStyle,
  type AppointmentWithMeta,
} from '@/lib/appointments';
import {
  toLocalDateString,
  DAYS_ES_SHORT,
  MONTHS_ES,
} from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export default function CitasPage() {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);
  const weekStart = toLocalDateString(weekDays[0]);
  const weekEnd = toLocalDateString(weekDays[6]);

  async function reload() {
    setLoading(true);
    const data = await fetchAppointmentsInRange(weekStart, weekEnd);
    setAppointments(data);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [weekStart, weekEnd]);

  useEffect(() => {
    if (scrollContainerRef.current && !loading) {
      scrollContainerRef.current.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT - 20;
    }
  }, [loading]);

  const apptsByDay = useMemo(() => {
    const map: Record<string, AppointmentWithMeta[]> = {};
    weekDays.forEach((d) => {
      map[toLocalDateString(d)] = [];
    });
    appointments.forEach((apt) => {
      if (map[apt.date]) map[apt.date].push(apt);
    });
    return map;
  }, [appointments, weekDays]);

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
    if (m1 === m2) {
      return `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${MONTHS_ES[m1]} ${y}`;
    }
    return `${weekDays[0].getDate()} ${MONTHS_ES[m1].slice(0, 3)} - ${weekDays[6].getDate()} ${MONTHS_ES[m2].slice(0, 3)} ${y}`;
  })();

  const todayStr = toLocalDateString(new Date());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPercent = ((nowMinutes - START_HOUR * 60) / (TOTAL_HOURS * 60)) * 100;
  const showNowLine = nowPercent >= 0 && nowPercent <= 100;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Citas</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              onClick={goToPrevWeek}
              className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToToday}
              className="border-x border-border px-3 text-xs font-semibold transition hover:bg-secondary"
            >
              Hoy
            </button>
            <button
              onClick={goToNextWeek}
              className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
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

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
          <div className="border-r border-border" />
          {weekDays.map((day, idx) => {
            const dateStr = toLocalDateString(day);
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => openNewAppointment(dateStr)}
                className={cn(
                  'flex flex-col items-center gap-0.5 border-r border-border py-2.5 last:border-r-0 transition-colors hover:bg-secondary/50',
                  isToday && 'bg-vylta-green-500/5',
                )}
                title={`Nueva cita para ${dateStr}`}
              >
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider',
                  isToday ? 'text-vylta-green-600 dark:text-vylta-green-400' : 'text-muted-foreground',
                )}>
                  {DAYS_ES_SHORT[idx]}
                </span>
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                  isToday ? 'bg-vylta-green-500 text-white' : 'text-foreground',
                )}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-card/60 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <div
            className="relative grid grid-cols-[60px_repeat(7,1fr)]"
            style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
          >
            <div className="border-r border-border">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = START_HOUR + i;
                return (
                  <div
                    key={hour}
                    className="relative border-b border-border"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    <span className="absolute -top-2 right-2 text-[10px] font-semibold uppercase text-muted-foreground">
                      {formatHour(hour)}
                    </span>
                  </div>
                );
              })}
            </div>

            {weekDays.map((day) => {
              const dateStr = toLocalDateString(day);
              const dayAppts = apptsByDay[dateStr] || [];
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'relative border-r border-border last:border-r-0',
                    isToday && 'bg-vylta-green-500/[0.03]',
                  )}
                >
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="border-b border-border"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {isToday && showNowLine && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: `${nowPercent}%` }}
                    >
                      <span className="-ml-1.5 h-3 w-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/50" />
                      <div className="h-px flex-1 bg-rose-500" />
                    </div>
                  )}

                  {dayAppts.map((apt) => (
                    <AppointmentBlock key={apt.id} appointment={apt} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de nueva cita */}
      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialDate={initialDate}
        onSuccess={() => reload()}
      />
    </div>
  );
}

function AppointmentBlock({ appointment }: { appointment: AppointmentWithMeta }) {
  const style = getApptStatusStyle(appointment.status);
  const startMinFromVisible = appointment.startMinutes - START_HOUR * 60;
  const duration = Math.max(15, appointment.endMinutes - appointment.startMinutes);

  const top = (startMinFromVisible / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;

  if (startMinFromVisible < 0 || startMinFromVisible >= TOTAL_HOURS * 60) return null;

  return (
    <div
      className={cn(
        'group absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-[10px] shadow-sm transition-all hover:z-10 hover:shadow-md',
        style.bg,
        style.text,
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(20, height - 1)}px`,
        borderLeftColor: style.barColor,
      }}
      title={`${appointment.displayClientName} · ${appointment.service_name} · ${appointment.start_time}`}
    >
      <div className="truncate font-semibold leading-tight">{appointment.displayClientName}</div>
      {height >= 30 && (
        <div className="truncate text-[9px] opacity-80">{appointment.service_name}</div>
      )}
      {height >= 50 && (
        <div className="mt-0.5 flex items-center justify-between text-[9px] opacity-70">
          <span className="tabular-nums">{appointment.start_time.slice(0, 5)}</span>
          {appointment.service_cost && <span className="tabular-nums font-bold">{formatCurrency(appointment.service_cost)}</span>}
        </div>
      )}
    </div>
  );
}

function formatHour(hour24: number): string {
  if (hour24 === 0) return '12 AM';
  if (hour24 === 12) return '12 PM';
  if (hour24 < 12) return `${hour24} AM`;
  return `${hour24 - 12} PM`;
}
