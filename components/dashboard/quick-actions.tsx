'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  UserPlus,
  CalendarPlus,
  CalendarDays,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ══════════════════════════════════════════════════════════════════════
// QuickActions — Acciones rápidas en header del Inicio.
//
// Espejo de la app móvil:
//   • Nueva cita
//   • Nuevo cliente
//   • Ver agenda → /citas
//   • Clientes inactivos → /clientes/inactivos
//   • Refrescar (recarga datos del dashboard sin recargar la página)
// ══════════════════════════════════════════════════════════════════════

export function QuickActions() {
  const router = useRouter();
  const [apptOpen, setApptOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      {/* Botón refrescar — separado para acceso inmediato */}
      <Button
        size="sm"
        variant="outline"
        onClick={refresh}
        disabled={isPending}
        title="Refrescar datos del dashboard"
      >
        <RefreshCw className={isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        <span className="hidden sm:inline">Refrescar</span>
      </Button>

      {/* Dropdown principal con todas las acciones */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setApptOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Nueva cita
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setClientOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo cliente
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/citas')}>
            <CalendarDays className="h-3.5 w-3.5" />
            Ver agenda
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/clientes/inactivos')}>
            <UserX className="h-3.5 w-3.5" />
            Clientes inactivos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AppointmentFormDialog
        open={apptOpen}
        onOpenChange={setApptOpen}
        onSuccess={refresh}
      />
      <ClientFormDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        onSuccess={refresh}
      />
    </>
  );
}
