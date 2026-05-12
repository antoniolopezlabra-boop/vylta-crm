'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Trash2,
  User,
  Briefcase,
  Palette,
  Calendar as CalIcon,
  Info,
  Smartphone,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { cn, getInitials } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  STAFF_PALETTE,
  STAFF_ROLES,
  DAYS_OF_WEEK,
  fetchStaffHours,
  fetchBusinessHoursAsDefault,
  saveStaffMember,
  deleteStaffMember,
  type StaffHour,
} from '@/lib/staff';

// ══════════════════════════════════════════════════════════════════════
// Modal de crear/editar colaborador.
//
// Layout:
//   ├─ Preview del avatar con color y nombre
//   ├─ Nombre + Rol (dropdown)
//   ├─ Paleta de colores (10 opciones)
//   ├─ Switch "Activo" (solo edit)
//   ├─ Horario por día (7 días, cada uno con switch + hora inicio/fin)
//   └─ Botón eliminar (solo edit)
// ══════════════════════════════════════════════════════════════════════

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  onSaved?: () => void;
}

export function StaffFormDialog({ open, onOpenChange, staffId, onSaved }: StaffFormDialogProps) {
  const isEdit = !!staffId;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [color, setColor] = useState(STAFF_PALETTE[0]);
  const [isActive, setIsActive] = useState(true);
  const [hours, setHours] = useState<StaffHour[]>([]);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      if (isEdit && staffId) {
        const supabase = createClient();
        const [smRes, hoursData, acctRes] = await Promise.all([
          supabase.from('staff_members').select('*').eq('id', staffId).maybeSingle(),
          fetchStaffHours(staffId),
          supabase.from('staff_accounts').select('id').eq('staff_member_id', staffId).maybeSingle(),
        ]);
        if (!cancelled && smRes.data) {
          const sm = smRes.data;
          setName(sm.name || '');
          setRole(sm.role || '');
          setColor(sm.color || STAFF_PALETTE[0]);
          setIsActive(sm.is_active !== false);
          setHours(hoursData);
          setHasAccount(!!acctRes.data);
        }
      } else {
        // Crear: cargar horario del negocio como default
        setName('');
        setRole('');
        setColor(STAFF_PALETTE[0]);
        setIsActive(true);
        setHasAccount(false);
        const businessHours = await fetchBusinessHoursAsDefault();
        if (!cancelled) setHours(businessHours);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, isEdit, staffId]);

  function toggleDay(dow: number) {
    setHours(h => h.map(d => d.day_of_week === dow ? { ...d, is_open: !d.is_open } : d));
  }

  function updateHour(dow: number, field: 'start_time' | 'end_time', val: string) {
    setHours(h => h.map(d => d.day_of_week === dow ? { ...d, [field]: val } : d));
  }

  const initials = useMemo(() => getInitials(name || '?'), [name]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error('El nombre del colaborador es obligatorio');
      return;
    }
    setSaving(true);
    const result = await saveStaffMember({
      id: staffId || undefined,
      name,
      role,
      color,
      is_active: isActive,
      hours: hours.map(h => ({
        day_of_week: h.day_of_week,
        is_open: h.is_open,
        start_time: h.start_time,
        end_time: h.end_time,
      })),
    });
    setSaving(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? 'Colaborador actualizado' : 'Colaborador creado');
    onSaved?.();
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!staffId) return;
    const ok = confirm(
      `¿Eliminar a ${name}?\n\nSus citas pasadas se mantendrán pero quedarán sin colaborador asignado. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    const success = await deleteStaffMember(staffId);
    if (success) {
      toast.success('Colaborador eliminado');
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error('No pudimos eliminar al colaborador');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar colaborador' : 'Nuevo colaborador'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos y el horario de este colaborador.'
              : 'Registra a un colaborador con su propio horario y color identificador.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Preview del avatar */}
            <div className="flex items-center gap-4 rounded-xl bg-secondary/40 p-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-xl font-bold"
                style={{ borderColor: color, backgroundColor: `${color}1A`, color }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{name || 'Nombre del colaborador'}</div>
                <div className="truncate text-xs text-muted-foreground">{role || 'Sin rol definido'}</div>
              </div>
            </div>

            {/* Nombre + Rol */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <User className="h-3 w-3 text-muted-foreground" />
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  Rol
                </Label>
                <Select value={role || undefined} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Palette className="h-3 w-3 text-muted-foreground" />
                Color identificador
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Aparece en el calendario para identificar visualmente sus citas.
              </p>
              <div className="flex flex-wrap gap-2">
                {STAFF_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-9 w-9 rounded-lg transition-all',
                      color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: c, '--tw-ring-color': c } as any}
                  >
                    {color === c && <X className="mx-auto h-4 w-4 rotate-45 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Estado activo (solo edit) */}
            {isEdit && (
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-secondary/40 p-3 transition hover:bg-secondary/60">
                <div>
                  <div className="text-sm font-semibold">Colaborador activo</div>
                  <div className="text-[11px] text-muted-foreground">
                    {isActive
                      ? 'Aparece en calendario y link de citas'
                      : 'Oculto del calendario y link de citas'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-5 w-5 cursor-pointer accent-vylta-green-500"
                />
              </label>
            )}

            {/* Acceso a la app (solo edit, solo mostrar estado) */}
            {isEdit && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    hasAccount ? 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400' : 'bg-secondary text-muted-foreground',
                  )}>
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold">
                      {hasAccount ? 'Tiene acceso a la app' : 'Sin acceso a la app'}
                    </div>
                    <div className="mt-0.5 text-muted-foreground leading-relaxed">
                      Para crear o revocar accesos a la app móvil, abre VYLTA en tu celular → Ajustes → Mi equipo → selecciona al colaborador.
                      <br />
                      <span className="text-[10px] italic">Por seguridad esta acción requiere la app móvil.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Horarios */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <CalIcon className="h-3 w-3 text-muted-foreground" />
                Horario propio
              </Label>
              <div className="flex items-start gap-2 rounded-md bg-vylta-amber-500/5 border border-vylta-amber-500/30 p-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-vylta-amber-700 dark:text-amber-400 mt-0.5" />
                <p className="text-[11px] text-vylta-amber-700 dark:text-amber-400">
                  Cada colaborador puede tener un horario independiente del negocio.
                </p>
              </div>

              <div className="space-y-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const dh = hours.find(h => h.day_of_week === d.value);
                  if (!dh) return null;
                  return (
                    <div key={d.value} className="rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm font-semibold">{d.label}</span>
                        <label className="flex cursor-pointer items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">
                            {dh.is_open ? 'Abierto' : 'Cerrado'}
                          </span>
                          <input
                            type="checkbox"
                            checked={dh.is_open}
                            onChange={() => toggleDay(d.value)}
                            className="h-4 w-4 cursor-pointer accent-vylta-green-500"
                          />
                        </label>
                      </div>
                      {dh.is_open && (
                        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                          <Input
                            type="time"
                            value={dh.start_time?.slice(0, 5)}
                            onChange={(e) => updateHour(d.value, 'start_time', e.target.value)}
                            className="h-8 flex-1 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">a</span>
                          <Input
                            type="time"
                            value={dh.end_time?.slice(0, 5)}
                            onChange={(e) => updateHour(d.value, 'end_time', e.target.value)}
                            className="h-8 flex-1 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Eliminar (solo edit) */}
            {isEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar colaborador
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Crear colaborador'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
