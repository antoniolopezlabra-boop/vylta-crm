// Formas de pago de una cita (nov 2026). Valores guardados en
// appointments.payment_method; NULL = sin especificar.
// MIRROR: vylta-app/constants/paymentMethods.ts
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; emoji: string; color: string }[] = [
  { value: 'efectivo', label: 'Efectivo', emoji: '💵', color: '#10B981' },
  { value: 'tarjeta', label: 'Tarjeta', emoji: '💳', color: '#6366F1' },
  { value: 'transferencia', label: 'Transferencia', emoji: '🏦', color: '#0EA5E9' },
];

export const PAYMENT_UNSPECIFIED = { value: null, label: 'Sin especificar', emoji: '❔', color: '#94A3B8' };

export function paymentMethodLabel(v: string | null | undefined): string {
  return PAYMENT_METHODS.find(m => m.value === v)?.label || PAYMENT_UNSPECIFIED.label;
}
