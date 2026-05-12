// ══════════════════════════════════════════════════════════════════════
// FUENTE DE VERDAD del mapping de planes (espejo exacto de utils/planLabels.ts
// de la app móvil). Cualquier cambio aquí DEBE hacerse también allá.
//
// Rebranding Abr 2026:
//   plan_type en BD  →  Nombre visible al usuario  →  Precio
//   ---------------     ---------------------------     ----------
//   'Gratuito'       →  "Básico"                   →  $0 MXN/mes
//   'Basico'         →  "Premium"                  →  $399 MXN/mes
//   'Premium'        →  "Luxury"                   →  $799 MXN/mes
//
// IMPORTANTE: nunca hardcodear los nombres de UI. Usar siempre estos helpers.
// La BD puede tener el plan_type en mayúsculas o minúsculas — todos los helpers
// normalizan a lowercase para evitar bugs por casing.
// ══════════════════════════════════════════════════════════════════════

export type InternalPlanType = 'Gratuito' | 'Basico' | 'Básico' | 'Premium';
export type DisplayPlanName = 'Básico' | 'Premium' | 'Luxury';
export type DisplayPlanTier = 'basico' | 'premium' | 'luxury';

/**
 * Normaliza el valor crudo de plan_type a una de las 3 tiers de UI.
 */
function normalize(internal: string | null | undefined): DisplayPlanTier {
  const n = (internal || '').toLowerCase().trim();
  if (n === 'premium') return 'luxury';
  if (n === 'basico' || n === 'básico') return 'premium';
  return 'basico'; // 'gratuito' o cualquier otro valor desconocido
}

/**
 * Devuelve el nombre visible al usuario.
 */
export function getPlanDisplayName(internal: string | null | undefined): DisplayPlanName {
  const tier = normalize(internal);
  if (tier === 'luxury') return 'Luxury';
  if (tier === 'premium') return 'Premium';
  return 'Básico';
}

/**
 * Devuelve la tier de UI normalizada ('basico' | 'premium' | 'luxury').
 * Útil para condicionales tipo `if (tier === 'luxury')`.
 */
export function getPlanTier(internal: string | null | undefined): DisplayPlanTier {
  return normalize(internal);
}

/**
 * Devuelve el badge en mayúsculas, p.ej. "LUXURY" o "PREMIUM".
 */
export function getPlanBadgeLabel(internal: string | null | undefined): string {
  return getPlanDisplayName(internal).toUpperCase();
}

/**
 * Precio mensual formateado.
 */
export function getPlanPrice(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'luxury') return '$799 MXN/mes';
  if (tier === 'premium') return '$399 MXN/mes';
  return '$0 MXN/mes';
}

/**
 * Descripción corta del plan.
 */
export function getPlanDescription(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'luxury') return 'Todo Premium + Equipo + Marketing';
  if (tier === 'premium') return 'Citas ilimitadas + WhatsApp automático';
  return 'Hasta 10 citas al mes';
}

/**
 * ¿Es el plan de entrada (gratuito → Básico)?
 */
export function isFreeTier(internal: string | null | undefined): boolean {
  return normalize(internal) === 'basico';
}

/**
 * ¿Tiene acceso a features Premium o superior? (WhatsApp, link público, reportes)
 */
export function hasPremiumAccess(internal: string | null | undefined): boolean {
  const tier = normalize(internal);
  return tier === 'premium' || tier === 'luxury';
}

/**
 * ¿Tiene acceso a features Luxury? (equipo, citas simultáneas, cumpleaños automáticos)
 */
export function hasLuxuryAccess(internal: string | null | undefined): boolean {
  return normalize(internal) === 'luxury';
}

/**
 * Devuelve clases Tailwind del badge para mostrar consistentemente la tier en UI.
 */
export function getPlanBadgeClass(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'luxury')  return 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400';
  if (tier === 'premium') return 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400';
  return 'bg-secondary text-muted-foreground';
}
