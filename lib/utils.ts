import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind de forma inteligente, resolviendo conflictos.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto en pesos mexicanos en estilo ejecutivo.
 *   1500       → '$1,500'
 *   45250      → '$45,250'
 *   1500000    → '$1.5M'
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000)    return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString('es-MX')}`;
}

/**
 * Formatea un porcentaje con signo para indicadores de variación.
 */
export function formatPercentChange(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0%';
  return value > 0 ? `+${Math.round(value)}%` : `${Math.round(value)}%`;
}

/**
 * Obtiene las iniciales (máx 2) de un nombre completo.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
