// ═══════════════════════════════════════════════════════════════════════
// lib/mexico-states.ts (CRM Web)
//
// Lista oficial de los 32 estados de la República Mexicana.
// Equivalente al constants/mexicoStates.ts de la app móvil; mantener
// SINCRONIZADAS ambas listas (los nombres deben ser EXACTOS para que
// el join entre business_profiles.state y el SVG funcione).
// ═══════════════════════════════════════════════════════════════════════

export interface MexicoState {
  /** Nombre oficial del estado (matches business_profiles.state) */
  name: string;
  /** Abreviatura ISO 3166-2:MX usada como id en el SVG del mapa */
  iso: string;
  /** Capital del estado (para sugerencias) */
  capital: string;
  /** Región geográfica según INEGI — útil para agrupaciones */
  region: 'Norte' | 'Centro' | 'Sur' | 'Sureste' | 'Occidente' | 'Noreste' | 'Noroeste' | 'Centro-occidente' | 'Centro-norte';
}

export const MEXICO_STATES: MexicoState[] = [
  { name: 'Aguascalientes',     iso: 'MX-AGU', capital: 'Aguascalientes',            region: 'Centro-norte' },
  { name: 'Baja California',     iso: 'MX-BCN', capital: 'Mexicali',                   region: 'Noroeste' },
  { name: 'Baja California Sur', iso: 'MX-BCS', capital: 'La Paz',                     region: 'Noroeste' },
  { name: 'Campeche',            iso: 'MX-CAM', capital: 'San Francisco de Campeche',  region: 'Sureste' },
  { name: 'Chiapas',             iso: 'MX-CHP', capital: 'Tuxtla Gutiérrez',           region: 'Sur' },
  { name: 'Chihuahua',           iso: 'MX-CHH', capital: 'Chihuahua',                  region: 'Norte' },
  { name: 'Ciudad de México',    iso: 'MX-CMX', capital: 'Ciudad de México',           region: 'Centro' },
  { name: 'Coahuila',            iso: 'MX-COA', capital: 'Saltillo',                   region: 'Noreste' },
  { name: 'Colima',              iso: 'MX-COL', capital: 'Colima',                     region: 'Occidente' },
  { name: 'Durango',             iso: 'MX-DUR', capital: 'Victoria de Durango',        region: 'Norte' },
  { name: 'Estado de México',    iso: 'MX-MEX', capital: 'Toluca de Lerdo',            region: 'Centro' },
  { name: 'Guanajuato',          iso: 'MX-GUA', capital: 'Guanajuato',                 region: 'Centro' },
  { name: 'Guerrero',            iso: 'MX-GRO', capital: 'Chilpancingo de los Bravo',  region: 'Sur' },
  { name: 'Hidalgo',             iso: 'MX-HID', capital: 'Pachuca de Soto',            region: 'Centro' },
  { name: 'Jalisco',             iso: 'MX-JAL', capital: 'Guadalajara',                region: 'Occidente' },
  { name: 'Michoacán',           iso: 'MX-MIC', capital: 'Morelia',                    region: 'Occidente' },
  { name: 'Morelos',             iso: 'MX-MOR', capital: 'Cuernavaca',                 region: 'Centro' },
  { name: 'Nayarit',             iso: 'MX-NAY', capital: 'Tepic',                      region: 'Occidente' },
  { name: 'Nuevo León',          iso: 'MX-NLE', capital: 'Monterrey',                  region: 'Noreste' },
  { name: 'Oaxaca',              iso: 'MX-OAX', capital: 'Oaxaca de Juárez',           region: 'Sur' },
  { name: 'Puebla',              iso: 'MX-PUE', capital: 'Heroica Puebla de Zaragoza', region: 'Centro' },
  { name: 'Querétaro',           iso: 'MX-QUE', capital: 'Santiago de Querétaro',     region: 'Centro' },
  { name: 'Quintana Roo',        iso: 'MX-ROO', capital: 'Chetumal',                   region: 'Sureste' },
  { name: 'San Luis Potosí',     iso: 'MX-SLP', capital: 'San Luis Potosí',           region: 'Centro-norte' },
  { name: 'Sinaloa',             iso: 'MX-SIN', capital: 'Culiacán Rosales',          region: 'Noroeste' },
  { name: 'Sonora',              iso: 'MX-SON', capital: 'Hermosillo',                 region: 'Noroeste' },
  { name: 'Tabasco',             iso: 'MX-TAB', capital: 'Villahermosa',               region: 'Sureste' },
  { name: 'Tamaulipas',          iso: 'MX-TAM', capital: 'Ciudad Victoria',            region: 'Noreste' },
  { name: 'Tlaxcala',            iso: 'MX-TLA', capital: 'Tlaxcala de Xicohténcatl',  region: 'Centro' },
  { name: 'Veracruz',            iso: 'MX-VER', capital: 'Xalapa-Enríquez',           region: 'Centro' },
  { name: 'Yucatán',             iso: 'MX-YUC', capital: 'Mérida',                     region: 'Sureste' },
  { name: 'Zacatecas',           iso: 'MX-ZAC', capital: 'Zacatecas',                  region: 'Centro-norte' },
];

export const MEXICO_STATE_NAMES: string[] = MEXICO_STATES.map(s => s.name);

export function isValidMexicoState(value: string | null | undefined): boolean {
  if (!value) return false;
  return MEXICO_STATE_NAMES.includes(value.trim());
}

export function getStateByName(name: string): MexicoState | undefined {
  return MEXICO_STATES.find(s => s.name === name);
}

export function getStateByIso(iso: string): MexicoState | undefined {
  return MEXICO_STATES.find(s => s.iso === iso);
}
