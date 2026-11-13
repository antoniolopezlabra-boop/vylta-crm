/**
 * VYLTA — Catálogo de puestos por tipo de negocio (nov 2026)
 *
 * Al crear/editar un colaborador, el selector de "Puesto" muestra solo los
 * puestos que tienen sentido para el giro con que se dio de alta el negocio
 * (business_profiles.business_type). Ej.: un Spa ve Masajista, Manicurista,
 * Estilista, Cosmetóloga…; un consultorio dental ve Odontólogo, Asistente
 * dental…
 *
 * - El giro se detecta por palabras clave (sin acentos ni mayúsculas), así
 *   también funciona con tipos escritos a mano ("Otro": "Uñas y spa").
 * - Si el texto menciona varios giros, se juntan sus puestos.
 * - Si no se reconoce el giro, se muestra una lista general.
 * - Siempre se puede escribir un puesto propio ("Otro…").
 *
 * MIRROR: vylta-app/constants/staffRoles.ts — mantener ambos iguales.
 */

interface RoleCategory {
  id: string;
  /** Palabras clave (sin acentos, minúsculas) que activan la categoría. */
  keywords: string[];
  roles: string[];
}

const CATEGORIES: RoleCategory[] = [
  {
    id: 'barberia',
    keywords: ['barber'],
    roles: ['Barbero', 'Barbero master', 'Estilista', 'Colorista', 'Diseñador de barba', 'Auxiliar de barbería'],
  },
  {
    id: 'unas',
    keywords: ['una', 'unas', 'nail', 'manicur', 'pedicur'],
    roles: ['Manicurista', 'Pedicurista', 'Técnica en uñas', 'Nail artist', 'Técnica en uñas acrílicas', 'Técnica en gelish', 'Podóloga'],
  },
  {
    id: 'cejas-pestanas',
    keywords: ['ceja', 'pestana', 'lash', 'brow', 'microblading', 'micropigment'],
    roles: ['Lashista', 'Diseñadora de cejas', 'Micropigmentadora', 'Especialista en microblading', 'Esteticista', 'Maquillista'],
  },
  {
    id: 'salon',
    keywords: ['salon', 'belleza', 'estilismo', 'peluquer', 'estilista', 'beauty', 'cabello', 'hair'],
    roles: [
      'Estilista', 'Peluquero(a)', 'Colorista', 'Barbero', 'Manicurista', 'Pedicurista',
      'Técnica en uñas', 'Lashista', 'Diseñadora de cejas', 'Maquillista', 'Peinadora',
      'Esteticista', 'Cosmetóloga', 'Masajista', 'Depiladora', 'Auxiliar de salón',
    ],
  },
  {
    id: 'spa',
    keywords: ['spa', 'masaje', 'relajacion', 'wellness', 'bienestar'],
    roles: [
      'Masajista', 'Terapeuta spa', 'Terapeuta corporal', 'Esteticista', 'Cosmetóloga', 'Cosmiatra',
      'Manicurista', 'Pedicurista', 'Técnica en uñas', 'Estilista', 'Maquillista',
      'Reflexóloga', 'Aromaterapeuta', 'Depiladora', 'Lashista',
    ],
  },
  {
    id: 'estetica',
    keywords: ['estetica', 'facial', 'cosmetolog', 'cosmiatr', 'depilacion', 'laser', 'bronceado', 'corporal'],
    roles: [
      'Cosmetóloga', 'Cosmiatra', 'Esteticista', 'Técnica en depilación láser', 'Depiladora',
      'Técnica en bronceado', 'Terapeuta corporal', 'Aparatología', 'Enfermera', 'Médico estético',
    ],
  },
  {
    id: 'maquillaje',
    keywords: ['maquillaje', 'makeup', 'make up', 'maquillista'],
    roles: ['Maquillista', 'Peinadora', 'Estilista', 'Asistente de maquillaje'],
  },
  {
    id: 'medico',
    keywords: [
      'medic', 'consultorio', 'clinica', 'doctor', 'salud', 'cardiolog', 'dermatolog', 'endocrinolog',
      'ginecolog', 'pediatr', 'ortoped', 'internista', 'urolog', 'gastro', 'neurolog',
    ],
    roles: [
      'Médico general', 'Médico especialista', 'Cardiólogo(a)', 'Dermatólogo(a)', 'Endocrinólogo(a)',
      'Ginecólogo(a)', 'Pediatra', 'Ortopedista', 'Enfermera(o)', 'Asistente médico',
    ],
  },
  {
    id: 'dental',
    keywords: ['odontolog', 'dental', 'dentista', 'ortodonc'],
    roles: ['Odontólogo(a)', 'Ortodoncista', 'Endodoncista', 'Periodoncista', 'Odontopediatra', 'Higienista dental', 'Asistente dental'],
  },
  {
    id: 'vision',
    keywords: ['optica', 'oftalmolog', 'optometr', 'vision'],
    roles: ['Optometrista', 'Oftalmólogo(a)', 'Técnico óptico', 'Asesor visual'],
  },
  {
    id: 'mente',
    keywords: ['psicolog', 'psiquiatr', 'psicoterap', 'terapia ocupacional', 'terapia de', 'coach', 'tanatolog', 'mental'],
    roles: [
      'Psicólogo(a)', 'Psicoterapeuta', 'Terapeuta de pareja', 'Terapeuta familiar', 'Psicólogo(a) infantil',
      'Psiquiatra', 'Tanatólogo(a)', 'Coach', 'Terapeuta ocupacional',
    ],
  },
  {
    id: 'rehabilitacion',
    keywords: ['fisioterap', 'quiropract', 'rehabilit', 'ortoped', 'osteopat', 'deport'],
    roles: ['Fisioterapeuta', 'Quiropráctico(a)', 'Osteópata', 'Terapeuta físico', 'Rehabilitador(a)', 'Masajista terapéutico', 'Entrenador(a)'],
  },
  {
    id: 'nutricion',
    keywords: ['nutri', 'dieta'],
    roles: ['Nutriólogo(a)', 'Nutricionista deportivo', 'Educador(a) en diabetes', 'Entrenador(a)'],
  },
  {
    id: 'veterinaria',
    keywords: ['veterinar', 'mascota', 'canino', 'pet', 'grooming'],
    roles: ['Médico veterinario', 'Asistente veterinario', 'Estilista canino', 'Groomer', 'Bañador(a)', 'Entrenador canino'],
  },
  {
    id: 'tatuajes',
    keywords: ['tatuaje', 'tattoo', 'piercing', 'perfora'],
    roles: ['Tatuador(a)', 'Perforador(a) / Piercer', 'Artista', 'Aprendiz'],
  },
  {
    id: 'fotografia',
    keywords: ['fotograf', 'foto', 'video'],
    roles: ['Fotógrafo(a)', 'Videógrafo(a)', 'Asistente de fotografía', 'Editor(a)', 'Maquillista'],
  },
  {
    id: 'educacion',
    keywords: ['tutoria', 'clase', 'ingles', 'idioma', 'escuela', 'curso', 'academia', 'profesor', 'regulariz'],
    roles: ['Profesor(a)', 'Tutor(a)', 'Instructor(a)', 'Maestro(a) de idiomas', 'Coordinador(a) académico'],
  },
  {
    id: 'fitness',
    keywords: ['gym', 'gimnasio', 'fitness', 'yoga', 'pilates', 'crossfit', 'entrenamiento'],
    roles: ['Entrenador(a) personal', 'Instructor(a) de yoga', 'Instructor(a) de pilates', 'Coach fitness', 'Nutriólogo(a)'],
  },
];

/** Puestos de apoyo que aplican a cualquier negocio (van al final). */
const SUPPORT_ROLES = ['Recepcionista', 'Asistente', 'Encargado(a)', 'Gerente'];

/** Lista general cuando no se reconoce el giro. */
const GENERIC_ROLES = [
  'Especialista', 'Técnico(a)', 'Consultor(a)', 'Asesor(a)', 'Instructor(a)',
  'Terapeuta', 'Ayudante', 'Ventas', 'Atención a clientes',
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function matches(text: string, keyword: string): boolean {
  // 'una' / 'unas' / 'pet' / 'spa' / 'foto' son cortas: exigimos palabra completa
  // para no confundir ("comunal", "competencia", "espacio"...).
  if (keyword.length <= 4) {
    return new RegExp(`(^|[^a-z])${keyword}([^a-z]|$)`).test(text);
  }
  return text.includes(keyword);
}

/** Categorías detectadas para un tipo de negocio (puede ser más de una). */
export function detectRoleCategories(businessType: string | null | undefined): string[] {
  const text = normalize(businessType || '');
  if (!text.trim()) return [];
  return CATEGORIES.filter(c => c.keywords.some(k => matches(text, k))).map(c => c.id);
}

/**
 * Puestos sugeridos para el giro del negocio, sin duplicados.
 * `current` (el puesto ya guardado) se incluye aunque no esté en la lista.
 */
export function getRolesForBusiness(businessType: string | null | undefined, current?: string | null): string[] {
  const ids = detectRoleCategories(businessType);
  const base = ids.length
    ? CATEGORIES.filter(c => ids.includes(c.id)).flatMap(c => c.roles)
    : GENERIC_ROLES;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of [...base, ...SUPPORT_ROLES]) {
    const k = normalize(r);
    if (!seen.has(k)) { seen.add(k); out.push(r); }
  }
  const cur = (current || '').trim();
  if (cur && !seen.has(normalize(cur))) out.unshift(cur);
  return out;
}
