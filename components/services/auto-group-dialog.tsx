'use client';

import { useMemo, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Service } from '@/lib/queries/use-services';
import { proposeAutoGroups, useServiceGroupActions } from '@/lib/queries/use-service-groups';

// ══════════════════════════════════════════════════════════════════════
// Agrupar automáticamente — un clic.
// Lee los nombres "Grupo-Servicio", muestra la propuesta (grupos y cuántos
// servicios entran en cada uno) y al confirmar crea todo de una vez.
// El cliente puede desmarcar grupos que no quiera antes de aplicar.
// Los nombres de los servicios NO se modifican.
// ══════════════════════════════════════════════════════════════════════

export function AutoGroupDialog({
  open,
  onOpenChange,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
}) {
  const { applyAutoGroups } = useServiceGroupActions();
  const proposals = useMemo(() => proposeAutoGroups(services), [services]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const chosen = proposals.filter(p => !skipped.has(p.name));
  const totalServices = chosen.reduce((n, p) => n + p.serviceIds.length, 0);
  const leftover = services.filter(s => !s.group_id).length - totalServices;

  function toggle(name: string) {
    setSkipped(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function apply() {
    if (!chosen.length) return;
    setSaving(true);
    try {
      await applyAutoGroups(chosen);
      toast.success(`Listo: ${chosen.length} grupos con ${totalServices} servicios`);
      setSkipped(new Set());
      onOpenChange(false);
    } catch (err) {
      console.error('[autoGroup] error:', err);
      toast.error('No pudimos agrupar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-vylta-green" />
            Agrupar automáticamente
          </DialogTitle>
          <DialogDescription>
            Detectamos grupos por el nombre de tus servicios (lo que va antes del guion, por ejemplo
            &ldquo;Pestañas-Clásicas&rdquo; → <b>Pestañas</b>). Desmarca los que no quieras.
          </DialogDescription>
        </DialogHeader>

        {proposals.length === 0 ? (
          <div className="rounded-lg border border-border bg-vylta-card/40 p-4 text-sm text-vylta-muted">
            No encontramos nombres con el formato &ldquo;Grupo-Servicio&rdquo; en tus servicios sin grupo.
            Puedes crear grupos y mover servicios seleccionándolos en la lista.
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {proposals.map(p => {
              const on = !skipped.has(p.name);
              return (
                <label
                  key={p.name}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-vylta-card/40 px-3 py-2.5 transition hover:bg-vylta-card"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(p.name)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-vylta-green"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-vylta-bone">{p.name}</span>
                      <span className="shrink-0 rounded-md bg-vylta-green/15 px-2 py-0.5 text-xs font-bold text-vylta-green">
                        {p.serviceIds.length}
                      </span>
                    </div>
                    <div className="truncate text-xs text-vylta-muted">{p.sample.join(' · ')}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {proposals.length > 0 && leftover > 0 && (
          <p className="text-xs text-vylta-muted">
            {leftover} {leftover === 1 ? 'servicio queda' : 'servicios quedan'} en &ldquo;Sin grupo&rdquo;;
            después puedes moverlos a donde quieras.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={apply} disabled={saving || chosen.length === 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Agrupando...
              </>
            ) : (
              `Crear ${chosen.length} ${chosen.length === 1 ? 'grupo' : 'grupos'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
