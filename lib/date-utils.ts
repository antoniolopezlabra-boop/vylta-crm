// ══════════════════════════════════════════════════════════════════════
// Helpers de fecha en zona LOCAL (sin UTC drift)
//
// Replicamos la lógica de utils/dateUtils.ts de la app móvil para que ambas
// plataformas calculen rangos de mes/semana de manera idéntica. Esto evita
// inconsistencias donde móvil dice "mayo tuvo $45,250" y web dice "$45,800".
// ══════════════════════════════════════════════════════════════════════

/** Fecha de hoy en formato YYYY-MM-DD en zona local. */
export function getTodayString(): string {
  return toLocalDateString(new Date());
}

/** Convierte un Date a YYYY-MM-DD en zona local (NO UTC). */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Primer día del mes en YYYY-MM-DD. Acepta month negativo (-1 = diciembre del año anterior). */
export function getMonthStartString(year: number, month: number): string {
  return toLocalDateString(new Date(year, month, 1));
}

/** Último día del mes en YYYY-MM-DD. Acepta month negativo. */
export function getMonthEndString(year: number, month: number): string {
  return toLocalDateString(new Date(year, month + 1, 0));
}

/** Inicio de la semana actual (lunes) en YYYY-MM-DD. */
export function getWeekStartString(): string {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toLocalDateString(d);
}

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAYS_ES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DAYS_ES_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Calcula porcentaje de cambio entre dos valores. Devuelve null si no es comparable. */
export function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Formato amigable de fecha: "lun 4 may" */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
