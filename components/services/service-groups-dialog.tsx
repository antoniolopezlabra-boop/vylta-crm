'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Service } from '@/lib/queries/use-services';
import { useServiceGroupActions, type ServiceGroup } from '@/lib/queries/use-service-groups';

// ══════════════════════════════════════════════════════════════════════
// Administrar grupos: crear, renombrar, ordenar (flechas) y eliminar.
// El orden aquí es el orden en que el cliente final ve los grupos en el
// link de reservas. Eliminar un grupo NO borra sus servicios.
// ══════════════════════════════════════════════════════════════════════

export function ServiceGroupsDialog({
  open,
  onOpenChange,
  groups,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ServiceGroup[];
  services: Service[];
}) {
  const { createGroup, renameGroup, deleteGroup, reorderGroups } = useServiceGroupActions();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setNames(Object.fromEntries(groups.map(g => [g.id, g.name])));
  }, [open, groups]);

  const countFor = (id: string) => services.filter(s => s.group_id === id).length;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      console.error('[groups] error:', err);
      toast.error('No pudimos guardar el cambio');
    } finally {
      setBusy(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const ids = groups.map(g => g.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(() => reorderGroups(ids));
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    await run(() => createGroup(name), 'Grupo creado');
    setNewName('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grupos de servicios</DialogTitle>
          <DialogDescription>
            Así los verán tus clientes al reservar, en este orden. Eliminar un grupo no borra sus
            servicios: pasan a &ldquo;Sin grupo&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="flex gap-2"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo grupo, ej. Pestañas"
            maxLength={60}
          />
          <Button type="submit" disabled={busy || !newName.trim()} className="shrink-0">
            <Plus className="h-4 w-4" />
            Crear
          </Button>
        </form>

        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-vylta-muted">Aún no tienes grupos.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {groups.map((g, idx) => {
              const edited = (names[g.id] ?? g.name).trim();
              const dirty = edited !== g.name && edited.length > 0;
              const n = countFor(g.id);
              return (
                <li key={g.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-vylta-card/40 p-1.5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={busy || idx === 0}
                      onClick={() => move(idx, -1)}
                      className="rounded p-0.5 text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bajar"
                      disabled={busy || idx === groups.length - 1}
                      onClick={() => move(idx, 1)}
                      className="rounded p-0.5 text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    value={names[g.id] ?? g.name}
                    onChange={(e) => setNames(prev => ({ ...prev, [g.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && dirty) run(() => renameGroup(g.id, edited), 'Nombre actualizado');
                    }}
                    maxLength={60}
                    className="h-9"
                  />
                  <span className="shrink-0 px-1 text-xs tabular-nums text-vylta-muted" title="Servicios en el grupo">
                    {n}
                  </span>
                  {dirty && (
                    <button
                      type="button"
                      aria-label="Guardar nombre"
                      disabled={busy}
                      onClick={() => run(() => renameGroup(g.id, edited), 'Nombre actualizado')}
                      className="rounded-md p-2 text-vylta-green hover:bg-vylta-green/10"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Eliminar grupo"
                    disabled={busy}
                    onClick={() => {
                      const msg = n > 0
                        ? `¿Eliminar el grupo "${g.name}"? Sus ${n} servicios pasarán a "Sin grupo".`
                        : `¿Eliminar el grupo "${g.name}"?`;
                      if (window.confirm(msg)) run(() => deleteGroup(g.id), 'Grupo eliminado');
                    }}
                    className="rounded-md p-2 text-vylta-muted hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {busy && (
          <div className="flex items-center justify-center gap-2 text-xs text-vylta-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
