'use client';

import { useEffect, useState } from 'react';
import { Loader2, Clock, Save, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsCard } from '../configuracion-shell';

// ══════════════════════════════════════════════════════════════════════
// Pestaña Horarios — editar día por día.
//
// Tabla: business_hours
//   • Un row por día de semana (0=Lunes ... 6=Domingo, alineado con
//     la app móvil y el wizard de setup)
//   • Columnas: user_id, day_of_week, is_open, start_time, end_time
//   • Operación: delete + insert (matching app móvil; evita problemas
//     con constraints únicos en BD)
//
// ⚡ FIX RESPONSIVE (Jun 2026): las filas usaban un grid rígido
//   grid-cols-[110px_70px_1fr] que en anchos angostos desbordaba (el
//   segundo campo de hora se cortaba y todo se recargaba a la derecha).
//   Ahora cada fila es flex-wrap: "día + toggle" a la izquierda y los dos
//   campos de hora a la derecha; en pantallas chicas las horas bajan a
//   una segunda línea. Nunca se desborda.
//
// Validaciones:
//   • Para días abiertos: start_time < end_time
//   • Si todos cerrados → permite guardar con advertencia (vacaciones)
// ══════════════════════════════════════════════════════════════════════

interface DaySchedule {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
}

// 0=Lunes ... 6=Domingo (matching app móvil y wizard)
const DAYS = [
  { id: 0, label: 'Lunes',     short: 'Lun' },
  { id: 1, label: 'Martes',    short: 'Mar' },
  { id: 2, label: 'Miércoles', short: 'Mié' },
  { id: 3, label: 'Jueves',    short: 'Jue' },
  { id: 4, label: 'Viernes',   short: 'Vie' },
  { id: 5, label: 'Sábado',    short: 'Sáb' },
  { id: 6, label: 'Domingo',   short: 'Dom' },
];

function buildDefaultSchedule(): DaySchedule[] {
  // Default: lun-sáb abiertos 09:00-19:00, domingo cerrado
  return DAYS.map(d => ({
    day_of_week: d.id,
    is_open: d.id !== 6,
    start_time: '09:00',
    end_time: '19:00',
  }));
}

export function HoursTab({ userId }: { userId: string }) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(buildDefaultSchedule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cargar horarios actuales
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('business_hours')
        .select('day_of_week, is_open, start_time, end_time')
        .eq('user_id', userId)
        .order('day_of_week');

      if (error) {
        console.warn('[HoursTab] load error:', error.message);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Construir schedule completo (7 días) merging defaults con BD
        const merged: DaySchedule[] = DAYS.map(d => {
          const existing = data.find((r: any) => r.day_of_week === d.id);
          if (existing) {
            return {
              day_of_week: d.id,
              is_open: !!existing.is_open,
              start_time: (existing.start_time || '09:00').slice(0, 5),
              end_time: (existing.end_time || '19:00').slice(0, 5),
            };
          }
          return {
            day_of_week: d.id,
            is_open: d.id !== 6,
            start_time: '09:00',
            end_time: '19:00',
          };
        });
        setSchedule(merged);
      }
      setLoading(false);
    })();
  }, [userId]);

  function updateDay(dayId: number, patch: Partial<DaySchedule>) {
    setSchedule(prev => prev.map(d => (d.day_of_week === dayId ? { ...d, ...patch } : d)));
  }

  function copyMondayToAll() {
    const monday = schedule.find(d => d.day_of_week === 0);
    if (!monday) return;
    if (!monday.is_open) {
      toast.error('Activa el Lunes para poder copiar su horario.');
      return;
    }
    setSchedule(prev =>
      prev.map(d => ({
        ...d,
        is_open: true,
        start_time: monday.start_time,
        end_time: monday.end_time,
      })),
    );
    toast.success('Horario del Lunes copiado a todos los días.');
  }

  function validate(): string | null {
    for (const d of schedule) {
      if (!d.is_open) continue;
      if (d.start_time >= d.end_time) {
        const dayName = DAYS.find(x => x.id === d.day_of_week)?.label;
        return `En ${dayName}: la hora de apertura debe ser antes del cierre.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // delete + insert (matching app móvil)
    const delRes = await supabase.from('business_hours').delete().eq('user_id', userId);
    if (delRes.error) {
      setSaving(false);
      toast.error('No pudimos guardar: ' + delRes.error.message);
      return;
    }

    const rows = schedule.map(d => ({
      user_id: userId,
      day_of_week: d.day_of_week,
      is_open: d.is_open,
      start_time: d.start_time,
      end_time: d.end_time,
    }));

    const insRes = await supabase.from('business_hours').insert(rows);
    setSaving(false);

    if (insRes.error) {
      toast.error('No pudimos guardar: ' + insRes.error.message);
      return;
    }

    toast.success('Horarios actualizados');
  }

  if (loading) {
    return (
      <SettingsCard
        icon={Clock}
        title="Horarios de atención"
        description="Cargando tus horarios actuales..."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  const allClosed = schedule.every(d => !d.is_open);

  return (
    <SettingsCard
      icon={Clock}
      title="Horarios de atención"
      description="Configura cuándo recibes citas. Tus clientes solo verán slots disponibles en estos rangos."
    >
      <div className="space-y-4">
        {/* Botón de utilidad: copiar Lunes a todos */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            ¿Mismo horario todos los días? Configura el Lunes y copia a los demás.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyMondayToAll}
            disabled={saving}
            className="h-8 shrink-0"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar Lunes
          </Button>
        </div>

        {/* Filas de días */}
        <div className="space-y-2">
          {schedule.map(d => {
            const meta = DAYS.find(x => x.id === d.day_of_week)!;
            return (
              <div
                key={d.day_of_week}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition-opacity ${
                  d.is_open ? '' : 'opacity-60'
                }`}
              >
                {/* Día + toggle */}
                <div className="flex items-center gap-2.5">
                  <Label className="w-20 shrink-0 text-sm font-semibold text-vylta-bone">{meta.label}</Label>
                  <Switch
                    checked={d.is_open}
                    onCheckedChange={(v) => updateDay(d.day_of_week, { is_open: v })}
                    disabled={saving}
                  />
                  <span className="w-14 text-[11px] text-muted-foreground">
                    {d.is_open ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>

                {/* Horas */}
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={d.start_time}
                    onChange={(e) =>
                      updateDay(d.day_of_week, { start_time: e.target.value })
                    }
                    disabled={!d.is_open || saving}
                    className="h-9 w-[116px]"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input
                    type="time"
                    value={d.end_time}
                    onChange={(e) =>
                      updateDay(d.day_of_week, { end_time: e.target.value })
                    }
                    disabled={!d.is_open || saving}
                    className="h-9 w-[116px]"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Advertencia si todos están cerrados */}
        {allClosed && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Todos los días están cerrados. Tus clientes no podrán agendar citas hasta que actives al menos uno.
            </p>
          </div>
        )}

        {/* Botón guardar */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Guardar cambios
              </>
            )}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
