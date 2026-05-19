/**
 * VYLTA — Tipos de Negocio (CRM Web)
 *
 * Fuente única de verdad para el dropdown de tipo de negocio en
 * el setup wizard del CRM web.
 *
 * MIRROR de constants/businessTypes.ts de la app móvil (build-a-mobile-app):
 *   - Misma lista de 31 tipos + 'Otro'
 *   - Mismas funciones helper (isCustomBusinessType, validateCustomBusinessType)
 *
 * Si la lista cambia en la app móvil, copiar los cambios aquí también para
 * mantener paridad. En el futuro podríamos extraer este archivo a un
 * paquete compartido (@vylta/shared) cuando crezca el monorepo.
 */

export const BUSINESS_TYPE_OTHER = 'Otro';

// Lista principal — ordenada alfabéticamente (excepto 'Otro' al final)
export const BUSINESS_TYPES: string[] = [
  'Barbería',
  'Cardiología',
  'Cejas y pestañas',
  'Centro de bronceado',
  'Centro de depilación láser',
  'Centro de masajes',
  'Coaching personal',
  'Consultorio médico general',
  'Dermatología',
  'Endocrinología',
  'Estética facial',
  'Estilismo / Peluquería',
  'Fisioterapia',
  'Fotografía',
  'Ginecología',
  'Maquillaje profesional',
  'Nutriología',
  'Odontología',
  'Oftalmología',
  'Ortopedia',
  'Pediatría',
  'Psicología',
  'Psiquiatría',
  'Quiropráctico',
  'Salón de belleza',
  'Spa',
  'Tatuajes y piercing',
  'Terapia ocupacional',
  'Tutorías',
  'Uñas',
  'Veterinaria',
  BUSINESS_TYPE_OTHER, // siempre al final
];

/**
 * Determina si el valor guardado en business_type corresponde a un tipo
 * personalizado (no en la lista oficial).
 */
export function isCustomBusinessType(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  return !BUSINESS_TYPES.includes(value);
}

/**
 * Validación del texto libre cuando el usuario selecciona 'Otro'.
 */
export function validateCustomBusinessType(value: string): { valid: boolean; error?: string } {
  const trimmed = (value || '').trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Escribe tu tipo de negocio para continuar' };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: 'Mínimo 3 caracteres' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Máximo 50 caracteres' };
  }
  return { valid: true };
}
