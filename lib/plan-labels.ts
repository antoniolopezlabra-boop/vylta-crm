// ══════════════════════════════════════════════════════════════════════
// FUENTE DE VERDAD del mapping de planes (espejo exacto de utils/planLabels.ts
// de la app móvil). Cualquier cambio aquí DEBE hacerse también allá.
//
// Rebranding Abr 2026 + Planes VIP May 2026:
//   plan_type en BD  →  Nombre visible al usuario  →  Precio
//   ---------------     ---------------------------     ----------
//   'Gratuito'       →  "Básico"                   →  $0 MXN/mes
//   'Basico'         →  "Premium"                  →  $399 MXN/mes
//   'Premium'        →  "Luxury"                   →  $799 MXN/mes
//   'VipBasico'      →  "VIP Premium"              →  $4,390 MXN/año
//   'VipPremium'     →  "VIP Luxury"               →  $8,790 MXN/año
//
// IMPORTANTE: nunca hardcodear los nombres de UI. Usar siempre estos helpers.
// La BD puede tener el plan_type en mayúsculas o minúsculas — todos los helpers
// normalizan a lowercase para evitar bugs por casing.
// ══════════════════════════════════════════════════════════════════════

export type InternalPlanType = 'Gratuito' | 'Basico' | 'Básico' | 'Premium' | 'VipBasico' | 'VipPremium';
export type DisplayPlanName = 'Básico' | 'Premium' | 'Luxury' | 'VIP Premium' | 'VIP Luxury';
export type DisplayPlanTier = 'basico' | 'premium' | 'luxury' | 'vip_premium' | 'vip_luxury';

/**
 * Normaliza el valor crudo de plan_type a una de las 5 tiers de UI.
 */
function normalize(internal: string | null | undefined): DisplayPlanTier {
  const n = (internal || '').toLowerCase().trim();
  if (n === 'vippremium' || n === 'vip_premium') return 'vip_luxury';
  if (n === 'vipbasico' || n === 'vip_basico' || n === 'vipbásico') return 'vip_premium';
  if (n === 'premium') return 'luxury';
  if (n === 'basico' || n === 'básico') return 'premium';
  return 'basico'; // 'gratuito' o cualquier otro valor desconocido
}

/**
 * Devuelve el nombre visible al usuario.
 */
export function getPlanDisplayName(internal: string | null | undefined): DisplayPlanName {
  const tier = normalize(internal);
  if (tier === 'vip_luxury') return 'VIP Luxury';
  if (tier === 'vip_premium') return 'VIP Premium';
  if (tier === 'luxury') return 'Luxury';
  if (tier === 'premium') return 'Premium';
  return 'Básico';
}

/**
 * Devuelve la tier de UI normalizada.
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
 * Precio formateado (incluye unidad: /mes para mensuales, /año para VIP).
 */
export function getPlanPrice(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'vip_luxury') return '$8,790 MXN/año';
  if (tier === 'vip_premium') return '$4,390 MXN/año';
  if (tier === 'luxury') return '$799 MXN/mes';
  if (tier === 'premium') return '$399 MXN/mes';
  return '$0 MXN/mes';
}

/**
 * Descripción corta del plan.
 */
export function getPlanDescription(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'vip_luxury')   return 'Todo Luxury + capacitación 1-a-1 + atención CEO';
  if (tier === 'vip_premium')  return 'Todo Premium + capacitación 1-a-1 + atención CEO';
  if (tier === 'luxury')       return 'Todo Premium + Equipo + Marketing';
  if (tier === 'premium')      return 'Citas ilimitadas + WhatsApp automático';
  return 'Hasta 10 citas al mes';
}

/**
 * ¿Es el plan de entrada (gratuito → Básico)?
 */
export function isFreeTier(internal: string | null | undefined): boolean {
  return normalize(internal) === 'basico';
}

/**
 * ¿Es un plan VIP anual?
 */
export function isVipTier(internal: string | null | undefined): boolean {
  const tier = normalize(internal);
  return tier === 'vip_premium' || tier === 'vip_luxury';
}

/**
 * ¿Tiene acceso a features Premium o superior? (WhatsApp, link público, reportes)
 * Incluye VIP Premium y VIP Luxury (que heredan de Premium y Luxury respectivamente).
 */
export function hasPremiumAccess(internal: string | null | undefined): boolean {
  const tier = normalize(internal);
  return tier === 'premium' || tier === 'luxury' || tier === 'vip_premium' || tier === 'vip_luxury';
}

/**
 * ¿Tiene acceso a features Luxury? (equipo, citas simultáneas, cumpleaños automáticos)
 * Incluye VIP Luxury que hereda de Luxury.
 */
export function hasLuxuryAccess(internal: string | null | undefined): boolean {
  const tier = normalize(internal);
  return tier === 'luxury' || tier === 'vip_luxury';
}

/**
 * Devuelve clases Tailwind del badge para mostrar consistentemente la tier en UI.
 */
export function getPlanBadgeClass(internal: string | null | undefined): string {
  const tier = normalize(internal);
  if (tier === 'vip_luxury' || tier === 'vip_premium') {
    return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  }
  if (tier === 'luxury')  return 'bg-vylta-amber-500/15 text-vylta-amber-700 dark:text-amber-400';
  if (tier === 'premium') return 'bg-vylta-green-500/15 text-vylta-green-700 dark:text-vylta-green-400';
  return 'bg-secondary text-muted-foreground';
}
