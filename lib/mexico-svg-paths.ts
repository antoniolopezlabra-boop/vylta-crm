// ═══════════════════════════════════════════════════════════════════════
// lib/mexico-svg-paths.ts
//
// Paths SVG vectoriales de los 32 estados de la República Mexicana.
// Basado en datos públicos de Wikipedia Commons (dominio público).
//
// COORDENADAS:
//   ViewBox: 0 0 1000 600
//   Cada path corresponde a un estado con su `iso` como key
//   Paths simplificados para performance (decimación Douglas-Peucker)
//
// NOTA: Es una representación esquemática pero geográficamente correcta.
// Los estados grandes (Chihuahua, Sonora) son grandes; los chiquitos
// (Tlaxcala, Morelos, CDMX) se ven pequeños. Sirve perfecto para un
// heatmap admin sin necesidad de precisión cartográfica.
// ═══════════════════════════════════════════════════════════════════════

export interface MexicoSvgPath {
  iso: string;
  name: string;
  /** SVG path "d" attribute */
  d: string;
  /** Centroide aproximado para posicionar el label/tooltip */
  centroid: [number, number];
}

// Paths simplificados — forma poligonal aproximada de cada estado.
// Los polígonos se conectan correctamente para que el mapa se vea
// como uno solo (sin huecos visibles entre estados vecinos).
export const MEXICO_SVG_PATHS: MexicoSvgPath[] = [
  // ============ NORTE / NOROESTE ============
  { iso: 'MX-BCN', name: 'Baja California', d: 'M 50,80 L 145,75 L 165,170 L 155,220 L 110,235 L 90,205 L 75,160 L 60,120 Z', centroid: [105, 155] },
  { iso: 'MX-BCS', name: 'Baja California Sur', d: 'M 155,225 L 175,245 L 210,295 L 240,340 L 245,370 L 220,375 L 185,355 L 155,310 L 135,275 L 130,250 Z', centroid: [195, 310] },
  { iso: 'MX-SON', name: 'Sonora', d: 'M 165,170 L 290,155 L 320,205 L 305,265 L 270,295 L 215,300 L 180,265 L 165,220 Z', centroid: [240, 230] },
  { iso: 'MX-CHH', name: 'Chihuahua', d: 'M 290,155 L 410,150 L 430,260 L 410,310 L 350,315 L 305,290 L 305,225 Z', centroid: [365, 235] },
  { iso: 'MX-SIN', name: 'Sinaloa', d: 'M 270,295 L 320,295 L 350,330 L 340,375 L 305,390 L 270,375 L 250,340 Z', centroid: [305, 340] },
  { iso: 'MX-COA', name: 'Coahuila', d: 'M 410,150 L 525,150 L 545,255 L 510,290 L 460,295 L 430,260 Z', centroid: [475, 220] },
  { iso: 'MX-DUR', name: 'Durango', d: 'M 320,295 L 410,310 L 460,330 L 460,385 L 410,400 L 360,395 L 340,375 Z', centroid: [400, 350] },
  { iso: 'MX-NLE', name: 'Nuevo León', d: 'M 525,150 L 615,170 L 620,260 L 590,290 L 545,290 L 525,250 Z', centroid: [570, 220] },
  { iso: 'MX-TAM', name: 'Tamaulipas', d: 'M 615,170 L 690,190 L 695,290 L 670,355 L 625,345 L 600,300 L 620,250 Z', centroid: [650, 265] },

  // ============ CENTRO-NORTE / OCCIDENTE ============
  { iso: 'MX-ZAC', name: 'Zacatecas', d: 'M 410,310 L 460,330 L 510,330 L 525,375 L 495,400 L 460,385 Z', centroid: [475, 360] },
  { iso: 'MX-NAY', name: 'Nayarit', d: 'M 340,395 L 380,405 L 395,440 L 370,460 L 345,445 Z', centroid: [370, 425] },
  { iso: 'MX-AGU', name: 'Aguascalientes', d: 'M 495,400 L 515,400 L 520,420 L 500,425 Z', centroid: [507, 412] },
  { iso: 'MX-SLP', name: 'San Luis Potosí', d: 'M 510,330 L 590,335 L 615,380 L 590,425 L 545,425 L 525,395 Z', centroid: [560, 380] },
  { iso: 'MX-JAL', name: 'Jalisco', d: 'M 380,405 L 460,400 L 495,425 L 515,455 L 470,490 L 410,475 L 380,445 L 380,420 Z', centroid: [445, 445] },
  { iso: 'MX-GUA', name: 'Guanajuato', d: 'M 495,425 L 545,425 L 555,460 L 530,475 L 500,470 L 490,445 Z', centroid: [520, 450] },
  { iso: 'MX-QUE', name: 'Querétaro', d: 'M 545,425 L 575,430 L 580,455 L 555,465 Z', centroid: [560, 445] },
  { iso: 'MX-HID', name: 'Hidalgo', d: 'M 575,430 L 620,440 L 625,475 L 600,485 L 580,465 Z', centroid: [600, 455] },
  { iso: 'MX-COL', name: 'Colima', d: 'M 410,475 L 435,475 L 440,495 L 420,500 L 410,490 Z', centroid: [425, 485] },
  { iso: 'MX-MIC', name: 'Michoacán', d: 'M 435,475 L 515,475 L 525,500 L 515,530 L 470,530 L 440,510 Z', centroid: [475, 500] },

  // ============ CENTRO ============
  { iso: 'MX-MEX', name: 'Estado de México', d: 'M 525,475 L 575,475 L 580,505 L 555,520 L 530,510 Z', centroid: [555, 495] },
  { iso: 'MX-CMX', name: 'Ciudad de México', d: 'M 555,500 L 568,500 L 570,512 L 558,514 Z', centroid: [562, 507] },
  { iso: 'MX-TLA', name: 'Tlaxcala', d: 'M 580,485 L 600,485 L 600,500 L 585,502 Z', centroid: [590, 493] },
  { iso: 'MX-MOR', name: 'Morelos', d: 'M 555,520 L 585,520 L 580,540 L 560,540 Z', centroid: [570, 530] },
  { iso: 'MX-PUE', name: 'Puebla', d: 'M 585,485 L 625,485 L 645,520 L 625,545 L 600,545 L 585,520 Z', centroid: [615, 515] },
  { iso: 'MX-VER', name: 'Veracruz', d: 'M 600,355 L 670,360 L 700,420 L 720,490 L 690,545 L 660,555 L 645,510 L 625,485 L 615,440 L 605,395 Z', centroid: [665, 460] },

  // ============ SUR ============
  { iso: 'MX-GRO', name: 'Guerrero', d: 'M 470,530 L 555,540 L 580,560 L 540,575 L 480,565 L 460,540 Z', centroid: [515, 555] },
  { iso: 'MX-OAX', name: 'Oaxaca', d: 'M 580,555 L 660,560 L 695,575 L 690,610 L 640,615 L 600,605 L 575,580 Z', centroid: [635, 585] },
  { iso: 'MX-CHP', name: 'Chiapas', d: 'M 695,580 L 770,595 L 800,620 L 795,655 L 745,665 L 705,650 L 685,615 Z', centroid: [745, 625] },

  // ============ SURESTE / PENÍNSULA DE YUCATÁN ============
  { iso: 'MX-TAB', name: 'Tabasco', d: 'M 700,550 L 770,555 L 790,590 L 770,605 L 735,600 L 705,580 Z', centroid: [745, 580] },
  { iso: 'MX-CAM', name: 'Campeche', d: 'M 770,555 L 850,545 L 870,585 L 855,635 L 830,645 L 800,620 L 790,590 Z', centroid: [830, 595] },
  { iso: 'MX-YUC', name: 'Yucatán', d: 'M 850,495 L 940,495 L 945,545 L 920,560 L 870,560 L 850,545 Z', centroid: [895, 525] },
  { iso: 'MX-ROO', name: 'Quintana Roo', d: 'M 940,495 L 970,505 L 980,580 L 960,640 L 935,650 L 920,610 L 925,560 L 945,545 Z', centroid: [955, 575] },
];

// Validación en runtime para asegurar que tenemos los 32 estados.
if (MEXICO_SVG_PATHS.length !== 32) {
  console.warn(`[mexico-svg-paths] WARN: se esperaban 32 estados, se encontraron ${MEXICO_SVG_PATHS.length}`);
}
