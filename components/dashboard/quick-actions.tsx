'use client';

import { useState } from 'react';
import { Plus, UserPlus, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Acciones rápidas del Inicio. Dropdown para no saturar el header con 2 botones.
export function QuickActions() {
  const [apptOpen, setApptOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setApptOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Nueva cita
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setClientOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo cliente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AppointmentFormDialog
        open={apptOpen}
        onOpenChange={setApptOpen}
        onSuccess={() => window.location.reload()}
      />
      <ClientFormDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
