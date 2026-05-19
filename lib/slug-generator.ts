import type { SupabaseClient } from '@supabase/supabase-js';

// ═════════════════════════════════════════════════════════════════════════
// VYLTA — Generador de slugs para booking_links (CRM Web)
//
// MIRROR de utils/slugGenerator.ts de la app móvil.
//
// Convierte un business_name en un slug URL-safe único:
//   "Karen Nails Star & Heart" → "karen-nails-star-heart"
//   "Salón Belleza Único"      → "salon-belleza-unico"
//
// Usado por el setup wizard al crear el negocio para auto-generar
// el booking_link sin requerir acción explícita del usuario.
// ═════════════════════════════════════════════════════════════════════════

export function generateSlug(businessName: string): string {
  if (!businessName || typeof businessName !== 'string') {
    return 'mi-negocio';
  }

  const normalized = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .substring(0, 50);

  return normalized || 'mi-negocio';
}

export async function ensureUniqueSlug(
  baseSlug: string,
  supabase: SupabaseClient
): Promise<string> {
  if (await isSlugAvailable(baseSlug, supabase)) {
    return baseSlug;
  }

  for (let i = 2; i <= 99; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (await isSlugAvailable(candidate, supabase)) {
      return candidate;
    }
  }

  const random = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${random}`;
}

async function isSlugAvailable(slug: string, supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from('booking_links')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  return !data;
}
