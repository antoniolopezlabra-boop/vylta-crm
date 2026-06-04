'use client';

import { useEffect, useState } from 'react';
import { Loader2, LayoutGrid, Save, Plus, Trash2, Lock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsCard } from '../configuracion-shell';

// ═══════════════════════════════════════════════════════════════════
// Recepción por bloques (modo alternativo del link público).
//
// Cuando el dueño activa este modo, el link público deja de mostrar la
// rejilla de horarios cada 30 min y en su lugar muestra SOLO las ventanas
// fijas (bloques) que definió aquí, por día de la semana. La cita ocupa
// todo el bloque. La capacidad la dan los colaboradores (Luxury): una
// reserva por colaborador/mesa por bloque. Premium = 1 por bloque.
//
// Tablas:
//   • booking_links.booking_mode ('normal' | 'bloques')
//   • booking_blocks (user_id, day_of_week 0=Lun..6=Dom, start_time,
//     end_time, is_active, sort_order) — patrón delete+insert al guardar.
//
// Gating: Premium + Luxury (isPremiumOrAbove). El modo bloques NO afecta
// cómo el dueño crea citas en el CRM/app; solo gobierna el link público.
// ═══════════════════════════════════════════════════════════════════

const DAYS = [
  { id: 0, label: 'Lunes' },
  { id: 1, label: 'Martes' },
  { id: 2, label: 'Miércoles' },
  { id: 3, label: 'Jueves' },
  { id: 4, label: 'Viernes' },
  { id: 5, label: 'Sábado' },
  { id: 6, label: 'Domingo' },
];

interface Block {
  uid: string;
  day: number;
  start: string;
  end: string;
}

let _uidCounter = 0;
function newUid() { _uidCounter += 1; return `b${Date.now()}_${_uidCounter}`; }

function addMinStr(t: string, mins: number): string {
  const [h, m] = (t || '00:00').split(':').map(Number);
  let tot = h * 60 + m + mins;
  if (tot > 23 * 60 + 59) tot = 23 * 60 + 59;
  return String(Math.floor(tot / 60)).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0');
}

export function BookingBlocksCard({ userId, isPremiumOrAbove }: { userId: string; isPremiumOrAbove: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [linkExists, setLinkExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [linkRes, blocksRes] = await Promise.all([
        supabase.from('booking_links').select('booking_mode').eq('user_id', userId).maybeSingle(),
        supabase.from('booking_blocks').select('day_of_week, start_time, end_time').eq('user_id', userId).order('day_of_week').order('sort_order'),
      ]);
      if (cancelled) return;

      if (linkRes.error || !linkRes.data) {
        setLinkExists(false);
      } else {
        setLinkExists(true);
        setEnabled((((linkRes.data as any).booking_mode) || 'normal') === 'bloques');
      }

      if (!blocksRes.error && blocksRes.data) {
        setBlocks((blocksRes.data as any[]).map((b) => ({
          uid: newUid(),
          day: b.day_of_week,
          start: (b.start_time || '10:00').slice(0, 5),
          end: (b.end_time || '12:00').slice(0, 5),
        })));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  function addBlock(day: number) {
    setBlocks((prev) => {
      const dayBlocks = prev.filter((b) => b.day === day);
      let start = '10:00';
      let end = '12:00';
      if (dayBlocks.length) {
        const last = dayBlocks[dayBlocks.length - 1];
        start = last.end;
        end = addMinStr(start, 120);
      }
      return [...prev, { uid: newUid(), day, start, end }];
    });
  }

  function removeBlock(uid: string) {
    setBlocks((prev) => prev.filter((b) => b.uid !== uid));
  }

  function updateBlock(uid: string, patch: Partial<Pick<Block, 'start' | 'end'>>) {
    setBlocks((prev) => prev.map((b) => (b.uid === uid ? { ...b, ...patch } : b)));
  }

  function validate(): string | null {
    for (const b of blocks) {
      if (b.start >= b.end) {
        const d = DAYS.find((x) => x.id === b.day)?.label;
        return `En ${d}: un bloque tiene la hora de inicio igual o posterior al fin.`;
      }
    }
    for (const d of DAYS) {
      const db = blocks.filter((b) => b.day === d.id).slice().sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < db.length; i++) {
        if (db[i].start < db[i - 1].end) {
          return `En ${d.label}: hay bloques que se enciman. Ajusta los horarios para que no se traslapen.`;
        }
      }
    }
    if (enabled && blocks.length === 0) {
      return 'Agrega al menos un bloque antes de activar la recepción por bloques.';
    }
    return null;
  }

  async function handleSave() {
    if (!linkExists) {
      toast.error('Primero activa tu link público en la pestaña "Link público".');
      return;
    }
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    const supabase = createClient();

    // 1) modo en booking_links
    const modeRes = await supabase
      .from('booking_links')
      .update({ booking_mode: enabled ? 'bloques' : 'normal', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (modeRes.error) {
      setSaving(false);
      toast.error('No pudimos guardar el modo: ' + modeRes.error.message);
      return;
    }

    // 2) delete + insert de bloques (mismo patrón que Horarios)
    const delRes = await supabase.from('booking_blocks').delete().eq('user_id', userId);
    if (delRes.error) {
      setSaving(false);
      toast.error('No pudimos guardar los bloques: ' + delRes.error.message);
      return;
    }

    if (blocks.length > 0) {
      const perDayCount: Record<number, number> = {};
      const rows = blocks
        .slice()
        .sort((a, b) => (a.day - b.day) || a.start.localeCompare(b.start))
        .map((b) => {
          const order = perDayCount[b.day] = (perDayCount[b.day] ?? -1) + 1;
          return {
            user_id: userId,
            day_of_week: b.day,
            start_time: b.start,
            end_time: b.end,
            is_active: true,
            sort_order: order,
          };
        });
      const insRes = await supabase.from('booking_blocks').insert(rows);
      if (insRes.error) {
        setSaving(false);
        toast.error('No pudimos guardar los bloques: ' + insRes.error.message);
        return;
      }
    }

    setSaving(false);
    toast.success(enabled ? 'Recepción por bloques activada' : 'Recepción por bloques desactivada');
  }

  if (loading) {
    return (
      <SettingsCard icon={LayoutGrid} title="Recepción por bloques" description="Cargando configuración...">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  if (!isPremiumOrAbove) {
    return (
      <SettingsCard
        icon={LayoutGrid}
        title="Recepción por bloques"
        description="Recibe citas solo en ventanas de tiempo fijas, sin horarios intermedios."
      >
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Esta función está disponible en los planes <span className="font-bold">Premium</span> y <span className="font-bold">Luxury</span>. Mejora tu plan para activarla.
          </p>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      icon={LayoutGrid}
      title="Recepción por bloques"
      description="Tus clientes verán solo las ventanas de tiempo que definas (ej. 10–12, 12–14), sin horarios intermedios."
    >
      <div className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
          <div className="pr-3">
            <Label className="text-sm font-semibold">
              Recepción por bloques {enabled ? 'activa' : 'inactiva'}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Al activarla, tu link público deja de mostrar la rejilla de horarios normal y solo ofrece estos bloques. No afecta cómo creas citas tú dentro de VYLTA.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={saving || !linkExists} />
        </div>

        {!linkExists && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Primero activa tu link público en la pestaña <span className="font-bold">Link público</span> para poder usar este modo.
            </p>
          </div>
        )}

        {enabled && (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <p className="text-[11px] text-blue-700/90 dark:text-blue-400/90">
                Define los bloques de cada día. La cita ocupará todo el bloque. Si tienes colaboradores (plan Luxury), cada bloque acepta una reserva por colaborador.
              </p>
            </div>

            <div className="space-y-3">
              {DAYS.map((d) => {
                const dayBlocks = blocks.filter((b) => b.day === d.id);
                return (
                  <div key={d.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="text-sm font-semibold text-vylta-bone">{d.label}</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7" disabled={saving} onClick={() => addBlock(d.id)}>
                        <Plus className="h-3.5 w-3.5" /> Añadir bloque
                      </Button>
                    </div>
                    {dayBlocks.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Sin bloques. Este día no recibirá citas en el link.</p>
                    ) : (
                      <div className="space-y-2">
                        {dayBlocks.map((b) => (
                          <div key={b.uid} className="flex items-center gap-2">
                            <Input type="time" value={b.start} disabled={saving} onChange={(e) => updateBlock(b.uid, { start: e.target.value })} className="h-9 max-w-[120px]" />
                            <span className="text-xs text-muted-foreground">a</span>
                            <Input type="time" value={b.end} disabled={saving} onChange={(e) => updateBlock(b.uid, { end: e.target.value })} className="h-9 max-w-[120px]" />
                            <button type="button" disabled={saving} onClick={() => removeBlock(b.uid)} title="Eliminar bloque" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>) : (<><Save className="h-4 w-4" /> Guardar cambios</>)}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
