'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  Crown,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import {
  fetchStaff,
  hasTeamAccess,
  toggleStaffActive,
  MAX_STAFF,
  type StaffMemberWithStats,
} from '@/lib/staff';
import { StaffFormDialog } from '@/components/team/staff-form-dialog';
import { TeamPaywall } from '@/components/team/team-paywall';

// ══════════════════════════════════════════════════════════════════════
// /equipo — Gestión de colaboradores
//
// Solo Plan Luxury (interno: 'premium'). Hasta 5 colaboradores.
// Cada uno con su propio color, rol y horario por día.
//
// El control de acceso a la app móvil (staff_accounts) se gestiona
// desde la app móvil porque requiere Edge Function con service_role key,
// que NO debe correr desde el browser por seguridad.
// ══════════════════════════════════════════════════════════════════════

export default function EquipoPage() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<StaffMemberWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const access = await hasTeamAccess();
    setHasAccess(access);
    if (access) {
      const data = await fetchStaff();
      setStaff(data);
    }
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  const activeStaff = useMemo(() => staff.filter(s => s.is_active), [staff]);
  const inactiveStaff = useMemo(() => staff.filter(s => !s.is_active), [staff]);
  const atLimit = staff.length >= MAX_STAFF;

  async function handleToggleActive(member: StaffMemberWithStats) {
    const newState = !member.is_active;
    const ok = confirm(
      `${newState ? 'Activar' : 'Desactivar'} a ${member.name}?${
        !newState ? '\n\nSus citas existentes no se verán afectadas, pero ya no aparecerá en el calendario ni en el link público.' : ''
      }`,
    );
    if (!ok) return;
    const success = await toggleStaffActive(member.id, newState);
    if (success) {
      toast.success(newState ? 'Colaborador activado' : 'Colaborador desactivado');
      reload();
    } else {
      toast.error('No pudimos cambiar el estado');
    }
  }

  function openCreate() {
    if (atLimit) {
      toast.error(`Límite de ${MAX_STAFF} colaboradores alcanzado. Desactiva o elimina uno para agregar otro.`);
      return;
    }
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  // Loading inicial
  if (loading && hasAccess === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sin acceso → paywall
  if (!hasAccess) {
    return <TeamPaywall />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Mi equipo
            <span className="inline-flex items-center gap-1 rounded-md bg-vylta-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-vylta-amber-700 dark:text-amber-400">
              <Crown className="h-2.5 w-2.5" />
              Luxury
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Cargando...'
              : `${activeStaff.length} ${activeStaff.length === 1 ? 'colaborador activo' : 'colaboradores activos'} de ${MAX_STAFF} máximo`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={atLimit}>
          <UserPlus className="h-4 w-4" />
          Agregar colaborador
        </Button>
      </div>

      {/* Banner informativo / límite */}
      {!loading && staff.length > 0 && (
        atLimit ? (
          <div className="flex items-start gap-3 rounded-lg border border-vylta-amber-500/40 bg-vylta-amber-500/5 p-3">
            <Sparkles className="h-4 w-4 shrink-0 text-vylta-amber-700 dark:text-amber-400" />
            <p className="text-xs text-vylta-amber-700 dark:text-amber-400">
              <span className="font-bold">Límite alcanzado:</span> Has registrado los {MAX_STAFF} colaboradores del plan Luxury. Desactiva o elimina uno para agregar otro.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-vylta-indigo-500/30 bg-vylta-indigo-500/5 p-3">
            <Users className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs text-foreground/80">
              <span className="font-bold">{staff.length}/{MAX_STAFF} colaboradores</span>. Cada uno tiene su propio horario, color identificador y citas asignables.
            </p>
          </div>
        )
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="space-y-4">
          {activeStaff.length > 0 && (
            <Section title="ACTIVOS" count={activeStaff.length}>
              {activeStaff.map((m) => (
                <StaffCard
                  key={m.id}
                  member={m}
                  onClick={() => openEdit(m.id)}
                  onToggle={() => handleToggleActive(m)}
                />
              ))}
            </Section>
          )}
          {inactiveStaff.length > 0 && (
            <Section title="INACTIVOS" count={inactiveStaff.length} muted>
              {inactiveStaff.map((m) => (
                <StaffCard
                  key={m.id}
                  member={m}
                  onClick={() => openEdit(m.id)}
                  onToggle={() => handleToggleActive(m)}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <StaffFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        staffId={editingId}
        onSaved={() => reload()}
      />
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className={cn('text-[11px] font-bold uppercase tracking-wider', muted ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
          {title}
        </h3>
        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', muted ? 'bg-secondary/60 text-muted-foreground' : 'bg-vylta-green-500/10 text-vylta-green-700 dark:text-vylta-green-400')}>
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function StaffCard({
  member,
  onClick,
  onToggle,
}: {
  member: StaffMemberWithStats;
  onClick: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-vylta-green-500/40 hover:shadow-md',
        !member.is_active && 'opacity-60',
      )}
    >
      {/* Avatar */}
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-base font-bold"
        style={{ borderColor: member.color, backgroundColor: `${member.color}1A`, color: member.color }}
      >
        {getInitials(member.name)}
      </div>

      {/* Nombre + Rol */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-bold">{member.name}</h4>
          {member.hasAccount && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-vylta-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400"
              title="Tiene acceso a la app móvil"
            >
              <Smartphone className="h-2.5 w-2.5" />
              App
            </span>
          )}
        </div>
        {member.role && (
          <p className="truncate text-xs text-muted-foreground">{member.role}</p>
        )}
      </div>

      {/* Toggle activo */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition hover:opacity-80',
          member.is_active
            ? 'bg-vylta-green-500/10 text-vylta-green-700 hover:bg-vylta-green-500/20 dark:text-vylta-green-400'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
        )}
        title={member.is_active ? 'Click para desactivar' : 'Click para activar'}
      >
        {member.is_active ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Activo
          </>
        ) : (
          <>
            <Circle className="h-3 w-3" />
            Inactivo
          </>
        )}
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-vylta-indigo-500/10">
        <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-base font-bold">Agrega tu primer colaborador</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Registra hasta {MAX_STAFF} colaboradores para asignarles citas y gestionar sus horarios por separado.
      </p>
      <Button size="sm" className="mt-4" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Agregar primer colaborador
      </Button>
    </div>
  );
}
