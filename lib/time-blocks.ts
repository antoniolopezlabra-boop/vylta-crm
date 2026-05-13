import { createClient } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════
// time-blocks.ts — gestión de bloqueos de horario (comida, vacaciones, etc)
//
// Schema de la tabla time_blocks:
//   staff_id      uuid NULL     - si NULL = aplica a todo el negocio
//   label         text          - "Comida", "Vacaciones", etc
//   start_time    time          - 14:00
//   end_time      time          - 15:00
//   is_recurring  boolean
//   day_of_week   smallint NULL - 0=domingo, 1=lunes, ..., 6=sábado
//   specific_date date NULL
//   is_active     boolean
// ══════════════════════════════════════════════════════════════════════

export interface TimeBlock {
  id: string;
  user_id: string;
  staff_id: string | null;
  label: string;
  start_time: string;       // "HH:MM:SS" o "HH:MM"
  end_time: string;
  is_recurring: boolean;
  day_of_week: number | null;
  specific_date: string | null;  // "YYYY-MM-DD"
  is_active: boolean;
}

/** Devuelve TODOS los bloqueos activos del usuario (cacheable). */
export async function fetchTimeBlocks(): Promise<TimeBlock[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) {
    console.error('[fetchTimeBlocks] error:', error);
    return [];
  }
  return (data || []) as TimeBlock[];
}

/**
 * Filtra los bloqueos que aplican a una fecha + staff específicos.
 *
 * Reglas de matching:
 *   1. Bloqueo recurrente: day_of_week debe coincidir con dateString
 *   2. Bloqueo específico: specific_date debe ser exactamente la fecha
 *   3. Staff:
 *      - Si bloqueo.staff_id es NULL → aplica a todos (bloqueo del negocio)
 *      - Si bloqueo.staff_id tiene valor → solo aplica si coincide con staffId
 *      - Si staffId es null ("sin asignar") → solo bloqueos del negocio aplican
 */
export function getBlocksForDate(
  blocks: TimeBlock[],
  dateString: string,    // "YYYY-MM-DD"
  staffId: string | null, // null = sin asignar
): TimeBlock[] {
  // dateString viene como YYYY-MM-DD; lo parseamos a mediodía local para evitar timezone shenanigans
  const date = new Date(dateString + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=domingo, 6=sábado

  return blocks.filter(b => {
    // ── Match de fecha ──
    if (b.is_recurring) {
      if (b.day_of_week !== dayOfWeek) return false;
    } else {
      if (b.specific_date !== dateString) return false;
    }

    // ── Match de staff ──
    // Si el bloqueo es del negocio completo (staff_id=NULL) → siempre aplica
    if (b.staff_id === null) return true;
    // Si el bloqueo es para un staff específico:
    //   • Si el usuario no asignó staff a la cita, este bloqueo no aplica
    //     (la cita podría ir a otro colaborador)
    //   • Si el usuario sí asignó staff, debe coincidir exactamente
    if (!staffId) return false;
    return b.staff_id === staffId;
  });
}

/** Convierte "HH:MM" o "HH:MM:SS" a minutos desde medianoche. */
export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Para un slot dado (start en minutos + duración), devuelve el bloqueo que lo
 * pisa, o null si no hay conflicto.
 */
export function findBlockConflict(
  slotStartMin: number,
  slotDuration: number,
  blocksForDate: TimeBlock[],
): TimeBlock | null {
  const slotEnd = slotStartMin + slotDuration;
  for (const block of blocksForDate) {
    const blockStart = timeStringToMinutes(block.start_time);
    const blockEnd = timeStringToMinutes(block.end_time);
    // Overlap real (no solo punto de contacto)
    if (slotStartMin < blockEnd && slotEnd > blockStart) {
      return block;
    }
  }
  return null;
}
