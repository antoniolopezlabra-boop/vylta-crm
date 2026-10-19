'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { walkBus } from './walk-bus';
import type { MkActivity, MkAgent, MkKpis, MkMeeting, MkPost, MkProjection } from '@/hooks/use-marketing';
import { RoomScreen } from './projection-viewer';

// ═══════════════════════════════════════════════════════════════════════
// OfficeFloor — cuartel de marketing de VYLTA (vista isométrica)
//
// Proyector isométrico propio (sin librerías): mundo (x, y, z) en
// baldosas → pantalla. Muebles = cajas con techo + 2 caras visibles,
// pintadas de atrás hacia adelante junto con los personajes.
//
// Pantallas "reales": el muro del Director muestra los KPIs en vivo
// (negocios pagando, MRR, registros); Estrategia muestra el embudo y la
// semana de publicaciones; el Estudio creativo y el muro de Social media
// muestran las imágenes reales que generó el equipo.
//
// Vida: monitores encendidos con el color de quien trabaja, servidores,
// núcleo de IA, holograma en la mesa de juntas; cuando alguien le encarga
// algo a otro, se levanta y camina hasta su escritorio; al pasar el
// cursor por una sala, la cámara se acerca.
// ═══════════════════════════════════════════════════════════════════════

const T = 26;
const COS = 0.866, SIN = 0.5;
const W = 30, D = 20;
const WALL_H = 4.9;
const HALL_Y = 8.0;

function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * T * COS, (x + y) * T * SIN - z * T];
}
function unIso(sx: number, sy: number): [number, number] {
  const a = sx / (T * COS), b = sy / (T * SIN);
  return [(a + b) / 2, (b - a) / 2];
}
const pts = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
const floorPoly = (x: number, y: number, w: number, d: number, z = 0) => pts([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c * (1 - amt) : c + (255 - c) * -amt)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Planos de muro: dibujar "UI" en coordenadas locales (px) sobre un muro.
// Muro del fondo / paneles paralelos al eje x: avanzar u = avanzar en x.
const alongX = (x: number, y: number, ztop: number) => { const [ex, ey] = iso(x, y, ztop); return `matrix(${COS},${SIN},0,1,${ex},${ey})`; };
// Muro izquierdo (x=0): u avanza hacia y menores para que el contenido no salga al revés.
const alongLeftWall = (yEnd: number, ztop: number) => { const [ex, ey] = iso(0, yEnd, ztop); return `matrix(${COS},${-SIN},0,1,${ex},${ey})`; };

type Drawable = { key: string; depth: number; node: React.ReactNode };

function box(key: string, x: number, y: number, z: number, w: number, d: number, h: number, color: string,
  opts: { opacity?: number; stroke?: string; top?: string; extra?: React.ReactNode; depthBias?: number; edge?: string } = {}): Drawable {
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  return {
    key, depth: x + w + y + d + z * 0.01 + (opts.depthBias ?? 0),
    node: (
      <g key={key} opacity={opts.opacity ?? 1}>
        <polygon points={pts(left)} fill={shade(color, 0.12)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(right)} fill={shade(color, 0.3)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(top)} fill={opts.top ?? color} stroke={opts.stroke} strokeWidth={0.6} />
        {opts.edge && <polyline points={pts([top[3], top[2], top[1]])} fill="none" stroke={opts.edge} strokeWidth={1.4} opacity={0.9} filter="url(#softGlow)" />}
        {opts.extra}
      </g>
    ),
  };
}

// ── Distribución ─────────────────────────────────────────────────────

type Zone = { id: string; label: string; x: number; y: number; w: number; d: number; floor: string; pattern: string; accent: string; icon: string };
const ZONES: Zone[] = [
  { id: 'direccion', label: 'Dirección', x: 0, y: 0, w: 9, d: 7, floor: '#2E2118', pattern: 'wood', accent: '#F59E0B', icon: '★' },
  { id: 'estrategia', label: 'Estrategia', x: 10, y: 0, w: 9, d: 7, floor: '#1B1F35', pattern: 'tileV', accent: '#8B5CF6', icon: '◆' },
  { id: 'datos', label: 'Datos e IA', x: 20, y: 0, w: 10, d: 7, floor: '#0F1828', pattern: 'tech', accent: '#22D3EE', icon: '⬡' },
  { id: 'creativo', label: 'Estudio creativo', x: 0, y: 9, w: 10, d: 11, floor: '#26202B', pattern: 'concrete', accent: '#F43F5E', icon: '✦' },
  { id: 'social', label: 'Social media', x: 11, y: 9, w: 8, d: 11, floor: '#1E1B33', pattern: 'carpet', accent: '#EC4899', icon: '♥' },
  { id: 'juntas', label: 'Sala de juntas', x: 20, y: 9, w: 10, d: 5.6, floor: '#151A2B', pattern: 'juntasP', accent: '#38BDF8', icon: '▣' },
  { id: 'rh', label: 'Recursos Humanos', x: 20, y: 15.2, w: 10, d: 4.8, floor: '#14231F', pattern: 'tileG', accent: '#10B981', icon: '●' },
];
const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z]));

const DESKS: Record<string, [number, number][]> = {
  direccion: [[3, 2.4]],
  estrategia: [[10.7, 1.6], [13.6, 1.6], [16.5, 1.6], [10.7, 5.4], [16.5, 5.4]],
  datos: [[24.0, 4.7], [26.9, 4.7], [20.5, 4.7]],
  creativo: [[1.4, 10.8], [4.5, 10.8], [7.4, 10.8], [1.4, 13.6], [4.5, 13.6]],
  social: [[12.0, 10.8], [15.6, 10.8], [12.0, 13.6], [15.6, 13.6]],
  rh: [[21.0, 16.3], [23.9, 16.3], [21.0, 18.6], [23.9, 18.6]],
};
const deskW = (zone: string) => (zone === 'direccion' ? 3 : 2.2);
function deskOf(a: MkAgent): [number, number] { const l = DESKS[a.zone] ?? DESKS.estrategia; return l[a.desk % l.length]; }
function seatOf(a: MkAgent): [number, number] { const [dx, dy] = deskOf(a); return [dx + deskW(a.zone) / 2, dy - 0.38]; }
function visitSpot(a: MkAgent): [number, number] { const [dx, dy] = deskOf(a); return [dx - 0.45, dy + 0.35]; }
function doorOf(zone: string): [number, number] {
  // RH sale por el pasillo lateral (entre Social media y RH); la sala de
  // juntas tiene su puerta en la esquina, junto a la pantalla.
  if (zone === 'rh') return [19.5, 17.4];
  if (zone === 'juntas') return [20.6, 8.5];
  const z = zoneById[zone] ?? ZONES[1];
  const cx = z.x + z.w / 2;
  return z.y < HALL_Y ? [cx, z.y + z.d + 0.5] : [cx, z.y - 0.5];
}
type P = [number, number];
// Tramo desde un punto de pasillo de una sala hasta un punto de otra sala:
// recto dentro de la misma sala; si cambia de sala, sale por la puerta,
// recorre el pasillo central y entra por la puerta destino.
function legPath(a: P, za: string, b: P, zb: string): P[] {
  if (za === zb) return [[a[0], b[1]], b];
  const d1 = doorOf(za), d2 = doorOf(zb);
  return [[a[0], d1[1] + (d1[1] > a[1] ? -0.6 : 0.6)], d1, [d1[0], HALL_Y], [d2[0], HALL_Y], d2, [b[0], d2[1]], b];
}
// Se levanta, visita a cada destino en orden (con una pausa para hablar) y regresa a su silla.
function planTrip(from: MkAgent, targets: MkAgent[]) {
  const seat = seatOf(from);
  const up: P = [deskOf(from)[0] - 0.45, seat[1]];
  const path: P[] = [seat, up];
  const stops: { at: number; ms: number; target: string }[] = [];
  let cur = up, zone = from.zone;
  for (const t of targets) {
    const goal = visitSpot(t);
    path.push(...legPath(cur, zone, goal, t.zone));
    stops.push({ at: pathLen(path), ms: DWELL_MS, target: t.id });
    cur = goal; zone = t.zone;
  }
  path.push(...legPath(cur, zone, up, from.zone), seat);
  return { path, stops, total: pathLen(path) };
}

// ── Sala de juntas ──
// Orden de llegada alternado (izquierda/derecha, salteando filas) para que las etiquetas no se encimen.
const ROOM_SEATS: P[] = [[23.35, 11.0], [26.65, 12.1], [23.35, 13.2], [26.65, 11.0], [26.65, 13.2], [23.35, 12.1], [25.0, 14.15]];
const TABLE_DEPTH = 23.9 + 2.2 + 10.5 + 3.3;
// Desde la puerta de la sala hasta el asiento, rodeando la mesa.
function roomRoute(i: number): P[] {
  const s = ROOM_SEATS[i];
  if (s[0] < 25) return [[20.6, s[1]], s];
  return [[20.6, 14.3], [s[0] === 25 ? 25 : 27.3, 14.3], ...(s[0] === 25 ? [] : [[27.3, s[1]] as P]), s];
}
function roomTrip(from: MkAgent, i: number) {
  const seat = seatOf(from);
  const up: P = [deskOf(from)[0] - 0.45, seat[1]];
  const d1 = doorOf(from.zone);
  const path: P[] = [seat, up, [up[0], d1[1] + (d1[1] > up[1] ? -0.6 : 0.6)], d1, [d1[0], HALL_Y], [20.6, HALL_Y], [20.6, 8.5], ...roomRoute(i)];
  return { path, stops: [], total: pathLen(path) };
}

// ── Personaje ────────────────────────────────────────────────────────

type Pose = { x: number; y: number; walking: boolean; away: boolean; facing: 1 | -1; visiting?: string };

const Person = memo(PersonView, (p, n) => p.a === n.a && p.selected === n.selected && p.t === n.t && p.onSelect === n.onSelect &&
  p.pose.x === n.pose.x && p.pose.y === n.pose.y && p.pose.walking === n.pose.walking && p.pose.away === n.pose.away &&
  p.pose.facing === n.pose.facing && p.pose.visiting === n.pose.visiting);

function PersonView({ a, pose, selected, onSelect, t }: {
  a: MkAgent; pose: Pose; selected: boolean; onSelect: (id: string) => void; t: number;
}) {
  const [sx, sy] = iso(pose.x, pose.y);
  const L = a.look ?? {};
  const skin = L.skin ?? '#E0AC69', hair = L.hair ?? '#2B1B12', outfit = L.outfit ?? a.color;
  const working = a.enabled && (a.status === 'working' || a.status === 'talking');
  const paused = !a.enabled;
  const standing = pose.away;
  const step = pose.walking ? Math.sin(t / 90) : 0;
  return (
    <g transform={`translate(${sx},${sy})`} className="mk-person" style={{ cursor: 'pointer' }}
       onClick={(e) => { e.stopPropagation(); onSelect(a.id); }} opacity={paused ? 0.55 : 1}>
      <ellipse cx={0} cy={2} rx={standing ? 12 : 20} ry={standing ? 5.5 : 9} fill={standing ? '#000' : a.color}
               opacity={standing ? 0.35 : selected ? 0.6 : working ? 0.38 : 0.18} className={working && !standing ? 'mk-pulse' : undefined} />
      {selected && <ellipse cx={0} cy={2} rx={standing ? 15 : 23} ry={standing ? 7 : 10.5} fill="none" stroke={a.color} strokeWidth={2} filter="url(#softGlow)" />}
      {!standing && <>
        <rect x={-12.5} y={-45} width={25} height={31} rx={8} fill="#1C2433" stroke="#3B4A61" strokeWidth={0.8} />
        <rect x={-9.5} y={-41.5} width={19} height={24} rx={6} fill="#2A3548" />
      </>}
      <g transform={standing ? `scale(${pose.facing},1)` : undefined}>
        {standing && <>
          <rect x={-5.5} y={-12 + step * 1.2} width={4.5} height={13 - step * 1.2} rx={2} fill="#1E293B" />
          <rect x={1} y={-12 - step * 1.2} width={4.5} height={13 + step * 1.2} rx={2} fill="#273449" />
          <ellipse cx={-3.2} cy={1.5 + step * 0.6} rx={3.4} ry={1.6} fill="#0B0F19" />
          <ellipse cx={3.2} cy={1.5 - step * 0.6} rx={3.4} ry={1.6} fill="#0B0F19" />
        </>}
        <g transform={standing ? 'translate(0,-12)' : undefined} className={!standing ? (working ? 'mk-type-body' : 'mk-breathe') : undefined}>
          <path d="M-11,-6 Q-12.5,-27 0,-29.5 Q12.5,-27 11,-6 Z" fill={outfit} />
          <path d="M3,-28.5 Q12.5,-26 11,-6 L5,-6 Q7,-18 3,-28.5 Z" fill="#000" opacity={0.15} />
          {L.tie && <path d="M0,-27 L-2.6,-20 L0,-8 L2.6,-20 Z" fill={L.tie} />}
          {!L.tie && <path d="M-4,-28 L0,-23 L4,-28" stroke="#ffffff80" strokeWidth={1.4} fill="none" />}
          {standing ? (
            <>
              <ellipse cx={-11} cy={-15 - step * 2} rx={3.2} ry={7} fill={outfit} transform={`rotate(${8 + step * 14} -11 -15)`} />
              <ellipse cx={11} cy={-15 + step * 2} rx={3.2} ry={7} fill={shade(outfit, 0.15)} transform={`rotate(${-8 - step * 14} 11 -15)`} />
            </>
          ) : (
            <>
              <g className={working ? 'mk-arm-l' : undefined}><ellipse cx={-10} cy={-8} rx={3.4} ry={6} fill={outfit} transform="rotate(-25 -10 -8)" /><circle cx={-8} cy={-2} r={2.6} fill={skin} /></g>
              <g className={working ? 'mk-arm-r' : undefined}><ellipse cx={10} cy={-8} rx={3.4} ry={6} fill={shade(outfit, 0.1)} transform="rotate(25 10 -8)" /><circle cx={8} cy={-2} r={2.6} fill={skin} /></g>
            </>
          )}
          <rect x={-2.6} y={-31.5} width={5.2} height={4} rx={2} fill={shade(skin, 0.12)} />
          <circle cx={0} cy={-37.5} r={8.4} fill={skin} />
          <path d="M3.5,-44.5 A8.4,8.4 0 0 1 3.5,-30.5 A9,9 0 0 0 3.5,-44.5 Z" fill="#000" opacity={0.08} />
          <Hair style={L.hairStyle} color={hair} />
          {L.glasses
            ? <g stroke="#0F172A" strokeWidth={1} fill="#ffffff50"><circle cx={-3.2} cy={-36.5} r={2.4} /><circle cx={3.2} cy={-36.5} r={2.4} /><path d="M-0.8,-36.5 L0.8,-36.5" /></g>
            : <g fill="#1E293B"><circle cx={-2.8} cy={-36.5} r={1} /><circle cx={2.8} cy={-36.5} r={1} /></g>}
          <path d="M-2.4,-33 Q0,-31.3 2.4,-33" stroke="#7C2D12" strokeWidth={0.9} fill="none" />
          <circle cx={-4.6} cy={-34.2} r={1.4} fill="#F87171" opacity={0.25} />
          <circle cx={4.6} cy={-34.2} r={1.4} fill="#F87171" opacity={0.25} />
        </g>
      </g>
      {paused && <text x={12} y={-48} fontSize={12} fill="#94A3B8" className="mk-zz">z z</text>}
      {pose.visiting && !pose.walking && (
        <g transform="translate(14,-50)"><rect x={-1} y={-9} width={22} height={13} rx={6.5} fill="#fff" stroke={a.color} /><g fill={a.color}><circle cx={5} cy={-2.5} r={1.4} className="mk-dot" /><circle cx={10} cy={-2.5} r={1.4} className="mk-dot" style={{ animationDelay: '.2s' }} /><circle cx={15} cy={-2.5} r={1.4} className="mk-dot" style={{ animationDelay: '.4s' }} /></g></g>
      )}
      <g transform={`translate(0,${standing ? -66 : -58})`}>
        <rect x={-34} y={-9} width={68} height={15} rx={7.5} fill="#0B1220ee" stroke={`${a.color}88`} strokeWidth={0.8} />
        <circle cx={-25} cy={-1.5} r={3} fill={paused ? '#64748B' : working || pose.walking ? '#22C55E' : a.color} className={working ? 'mk-blink-fast' : undefined} />
        <text x={-19} y={2} fontSize={8.5} fontWeight={700} fill="#fff">{a.name.split(' ')[0]}</text>
      </g>
    </g>
  );
}

function Hair({ style, color }: { style?: string; color: string }) {
  const hi = shade(color, -0.25);
  switch (style) {
    case 'long': return <g><path d="M-9,-37 Q-10,-49 0,-48 Q10,-49 9,-37 L9.5,-26 Q6,-30 6,-38.5 Q0,-44 -6,-38.5 Q-6,-30 -9.5,-26 Z" fill={color} /><path d="M-5,-46 Q0,-48 5,-46" stroke={hi} strokeWidth={1.2} fill="none" /></g>;
    case 'bun': return <g fill={color}><path d="M-8.5,-37.5 Q-9,-47.5 0,-47 Q9,-47.5 8.5,-37.5 Q5,-42.5 0,-42.5 Q-5,-42.5 -8.5,-37.5 Z" /><circle cx={0} cy={-48.5} r={4.3} /><circle cx={-1.3} cy={-49.5} r={1.3} fill={hi} /></g>;
    case 'ponytail': return <g fill={color}><path d="M-8.5,-37.5 Q-9,-47.5 0,-47 Q9,-47.5 8.5,-37.5 Q5,-42.5 0,-42.5 Q-5,-42.5 -8.5,-37.5 Z" /><path d="M7,-42.5 Q14,-38.5 10,-28.5 Q9,-35.5 6,-38.5 Z" /></g>;
    case 'curly': return <g fill={color}>{[-7, -3.5, 0, 3.5, 7].map((x) => <circle key={x} cx={x} cy={-44.5 + Math.abs(x) * 0.5} r={3.7} />)}</g>;
    case 'buzz': return <path d="M-8,-38.5 Q-8.5,-46.5 0,-46.5 Q8.5,-46.5 8,-38.5 Q4,-42 0,-42 Q-4,-42 -8,-38.5 Z" fill={color} opacity={0.85} />;
    case 'cap': return <g><path d="M-8.6,-38.5 Q-9,-48 0,-48 Q9,-48 8.6,-38.5 Z" fill={color} /><path d="M-9,-39.5 L-14.5,-39 Q-11,-41.5 -8,-41.5 Z" fill={color} /></g>;
    default: return <g><path d="M-8.5,-37.5 Q-9,-47.5 0,-47 Q9,-47.5 8.5,-37.5 Q6,-43 0,-43 Q-6,-43 -8.5,-37.5 Z" fill={color} /><path d="M-4,-45.5 Q0,-47 4,-45.5" stroke={hi} strokeWidth={1.1} fill="none" /></g>;
  }
}

// ── Pantallas con datos reales ───────────────────────────────────────

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;

function DirectorDashboard({ w, h, k }: { w: number; h: number; k: MkKpis | null }) {
  const paid = k?.pagados_activos ?? 0, total = Math.max(1, k?.negocios_total ?? 1);
  const pct = paid / total;
  const tiles = [
    { l: 'NEGOCIOS PAGANDO', v: String(paid), d: `+${k?.pagados_nuevos_mes ?? 0} mes`, c: '#F59E0B' },
    { l: 'MRR (MXN)', v: money(k?.mrr_mxn ?? 0), d: 'mensual', c: '#10B981' },
    { l: 'REGISTROS 30D', v: String(k?.registros_30d ?? 0), d: `${k?.registros_7d ?? 0} en 7d`, c: '#38BDF8' },
  ];
  const tw = (w - 16) / 3;
  const pts2 = [0.32, 0.4, 0.36, 0.5, 0.47, 0.6, 0.58, 0.72, 0.7, 0.86].map((v, i, arr) => [8 + (i * (w * 0.62 - 8)) / (arr.length - 1), h - 6 - v * (h * 0.36)] as [number, number]);
  const line = `M${pts2.map((p) => p.join(',')).join(' L')}`;
  return (
    <g>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="url(#screenBg)" />
      <rect width={w} height={9} rx={3} fill="#0F1A2E" />
      <circle cx={6} cy={4.5} r={1.8} fill="#22C55E" className="mk-blink-fast" />
      <text x={10} y={6.6} fontSize={4.6} fontWeight={800} fill="#E2E8F0" letterSpacing={0.3}>VYLTA · DIRECCIÓN COMERCIAL</text>
      <text x={w - 4} y={6.6} fontSize={4} fill="#64748B" textAnchor="end">EN VIVO</text>
      {tiles.map((t, i) => (
        <g key={t.l} transform={`translate(${4 + i * (tw + 4)},12)`}>
          <rect width={tw} height={19} rx={2} fill="#0E1729" stroke={`${t.c}55`} strokeWidth={0.6} />
          <text x={3} y={5.5} fontSize={3.1} fontWeight={700} fill="#64748B">{t.l}</text>
          <text x={3} y={13.5} fontSize={7} fontWeight={800} fill={t.c}>{t.v}</text>
          <text x={3} y={17.4} fontSize={2.8} fill="#94A3B8">{t.d}</text>
        </g>
      ))}
      <path d={`${line} L${pts2[pts2.length - 1][0]},${h - 4} L8,${h - 4} Z`} fill="url(#areaGreen)" opacity={0.8} />
      <path d={line} fill="none" stroke="#10B981" strokeWidth={1.1} className="mk-draw" />
      <g transform={`translate(${w * 0.82},${h * 0.66})`}>
        <circle r={10} fill="none" stroke="#1E293B" strokeWidth={4} />
        <circle r={10} fill="none" stroke="#F59E0B" strokeWidth={4} strokeDasharray={`${(2 * Math.PI * 10 * pct).toFixed(1)} 999`} transform="rotate(-90)" />
        <text y={1.6} fontSize={4.4} fontWeight={800} fill="#F8FAFC" textAnchor="middle">{Math.round(pct * 100)}%</text>
        <text y={16} fontSize={2.8} fill="#94A3B8" textAnchor="middle">pagan</text>
      </g>
    </g>
  );
}

function StrategyBoard({ w, h, k, posts }: { w: number; h: number; k: MkKpis | null; posts: MkPost[] }) {
  const funnel = [
    { l: 'Publicaciones 7d', v: k?.posts_7d ?? 0, c: '#A78BFA' },
    { l: 'Registros 30d', v: k?.registros_30d ?? 0, c: '#38BDF8' },
    { l: 'Pagando', v: k?.pagados_activos ?? 0, c: '#F59E0B' },
  ];
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(Date.now() + (i - 3) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const ps = posts.filter((p) => (p.published_at ?? p.scheduled_for ?? '').slice(0, 10) === key);
    return { n: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()], today: i === 3, ps };
  });
  return (
    <g>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="url(#screenBg)" />
      <text x={5} y={7} fontSize={4.6} fontWeight={800} fill="#E2E8F0">EMBUDO</text>
      {funnel.map((f, i) => {
        const bw = (w * 0.46) * (1 - i * 0.22);
        return (
          <g key={f.l} transform={`translate(${5 + i * 3},${11 + i * 9})`}>
            <rect width={bw} height={7} rx={1.5} fill={f.c} opacity={0.85} />
            <text x={2.5} y={4.9} fontSize={3.3} fontWeight={700} fill="#0B1020">{f.l}</text>
            <text x={bw + 2} y={5.2} fontSize={4.4} fontWeight={800} fill="#F8FAFC">{f.v}</text>
          </g>
        );
      })}
      <text x={w * 0.58} y={7} fontSize={4.6} fontWeight={800} fill="#E2E8F0">SEMANA</text>
      {days.map((d, i) => (
        <g key={i} transform={`translate(${w * 0.58 + i * ((w * 0.4) / 7)},11)`}>
          <rect width={(w * 0.4) / 7 - 1.5} height={h - 16} rx={1.5} fill={d.today ? '#2E1065' : '#0E1729'} stroke={d.today ? '#A78BFA' : '#1E293B'} strokeWidth={0.6} />
          <text x={((w * 0.4) / 7 - 1.5) / 2} y={5} fontSize={3.2} fill="#94A3B8" textAnchor="middle">{d.n}</text>
          {d.ps.map((p, j) => (
            <rect key={j} x={1.5} y={8 + j * 6} width={(w * 0.4) / 7 - 4.5} height={4.4} rx={1} fill={p.channel === 'facebook' ? '#1877F2' : '#DD2A7B'} opacity={p.status === 'publicado' ? 1 : 0.55} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Moodboard({ w, h, posts }: { w: number; h: number; posts: MkPost[] }) {
  const imgs = posts.filter((p) => p.image_url).slice(0, 4);
  const iw = (w - 10) / 4;
  return (
    <g>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="#0E0B14" />
      <text x={4} y={6.5} fontSize={4.4} fontWeight={800} fill="#FDA4AF">ESTUDIO · PIEZAS RECIENTES</text>
      {Array.from({ length: 4 }).map((_, i) => {
        const p = imgs[i];
        return (
          <g key={i} transform={`translate(${2 + i * (iw + 2)},10)`}>
            <rect width={iw} height={h - 18} rx={2} fill="#1F1A26" />
            {p?.image_url
              ? <image href={p.image_url} width={iw} height={h - 18} preserveAspectRatio="xMidYMid slice" clipPath={`inset(0 round 2px)`} />
              : <text x={iw / 2} y={(h - 18) / 2} fontSize={3.4} fill="#64748B" textAnchor="middle">en proceso</text>}
            {p && <rect x={2} y={2} width={iw * 0.36} height={4} rx={2} fill={p.channel === 'facebook' ? '#1877F2' : '#DD2A7B'} />}
          </g>
        );
      })}
      {['#F43F5E', '#F59E0B', '#10B981', '#38BDF8', '#A78BFA'].map((c, i) => <rect key={c} x={4 + i * 7} y={h - 6} width={5} height={3} rx={1} fill={c} />)}
    </g>
  );
}

function SocialWall({ w, h, posts }: { w: number; h: number; posts: MkPost[] }) {
  const fb = posts.find((p) => p.channel === 'facebook' && p.image_url);
  const ig = posts.find((p) => p.channel === 'instagram' && p.image_url);
  const live = posts.filter((p) => p.status === 'publicado').length;
  const card = (p: MkPost | undefined, x: number, color: string, label: string) => (
    <g transform={`translate(${x},11)`}>
      <rect width={w * 0.44} height={h - 15} rx={2.5} fill="#0E1729" stroke={`${color}66`} strokeWidth={0.7} />
      <rect width={w * 0.44} height={6} rx={2.5} fill={color} />
      <text x={3} y={4.3} fontSize={3.4} fontWeight={800} fill="#fff">{label}</text>
      {p?.image_url && <image href={p.image_url} x={2} y={8} width={w * 0.44 - 4} height={h - 27} preserveAspectRatio="xMidYMid slice" />}
      <text x={3} y={h - 18} fontSize={3} fill="#CBD5E1">{p ? (p.status === 'publicado' ? '● Publicado' : '◷ Programado 7:00 pm') : 'Sin pieza'}</text>
    </g>
  );
  return (
    <g>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="url(#screenBg)" />
      <circle cx={6} cy={5} r={1.8} fill="#EF4444" className="mk-blink-fast" />
      <text x={10} y={6.6} fontSize={4.4} fontWeight={800} fill="#F8FAFC">SOCIAL · EN VIVO</text>
      <text x={w - 4} y={6.6} fontSize={3.6} fill="#F9A8D4" textAnchor="end">{live} publicadas</text>
      {card(fb, 3, '#1877F2', 'FACEBOOK')}
      {card(ig, w * 0.53, '#DD2A7B', 'INSTAGRAM')}
    </g>
  );
}

function TalentBoard({ w, h, agents }: { w: number; h: number; agents: MkAgent[] }) {
  const cols = 4, cw = (w - 10) / cols;
  return (
    <g>
      <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={4} fill="#05080F" />
      <rect width={w} height={h} rx={3} fill="url(#screenBg)" />
      <text x={4} y={6.5} fontSize={4.2} fontWeight={800} fill="#6EE7B7">EQUIPO · {agents.filter((a) => a.enabled).length} ACTIVOS</text>
      {[...agents.slice(0, 11), null].map((a, i) => (
        <g key={i} transform={`translate(${3 + (i % cols) * (cw + 1.3)},${10 + Math.floor(i / cols) * 9.5})`}>
          <rect width={cw} height={8} rx={1.5} fill={a ? '#0E1729' : '#052E1F'} stroke={a ? `${a.color}66` : '#10B981'} strokeWidth={0.5} strokeDasharray={a ? undefined : '1.5 1'} />
          {a ? <>
            <circle cx={4} cy={4} r={2.4} fill={a.color} opacity={a.enabled ? 1 : 0.3} />
            <text x={7.6} y={5.2} fontSize={3} fontWeight={700} fill={a.enabled ? '#E2E8F0' : '#64748B'}>{a.name.split(' ')[0]}</text>
          </> : <text x={cw / 2} y={5.3} fontSize={3} fontWeight={700} fill="#34D399" textAnchor="middle">+ Vacante</text>}
        </g>
      ))}
    </g>
  );
}

// ── Caminatas ────────────────────────────────────────────────────────

type Trip = { agent: string; path: P[]; stops: { at: number; ms: number; target: string }[]; total: number; started: number; done?: () => void; room?: { seat: number; dir: 'in' | 'out' } };
const SPEED = 4.5;        // baldosas por segundo
const DWELL_MS = 2800;    // pausa con cada persona
function segLengths(path: P[]) { const o: number[] = []; for (let i = 1; i < path.length; i++) o.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return o; }
function pathLen(path: P[]) { return segLengths(path).reduce((s, x) => s + x, 0); }
function along(path: P[], dist: number): { p: P; dir: number } {
  const segs = segLengths(path);
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i]) { const k = segs[i] ? dist / segs[i] : 0; const a = path[i], b = path[i + 1]; return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: (b[0] - a[0]) - (b[1] - a[1]) }; }
    dist -= segs[i];
  }
  return { p: path[path.length - 1], dir: 0 };
}
// Dónde va la caminata en el instante `now`: distancia recorrida, con quién está
// hablando (si está en una pausa), a quién va y si ya terminó.
function tripState(tr: Trip, now: number): { dist: number; visiting?: string; next?: string; finished: boolean } {
  let t = (now - tr.started) / 1000, prev = 0;
  for (const s of tr.stops) {
    const walk = (s.at - prev) / SPEED;
    if (t < walk) return { dist: prev + t * SPEED, next: s.target, finished: false };
    t -= walk;
    if (t < s.ms / 1000) return { dist: s.at, visiting: s.target, finished: false };
    t -= s.ms / 1000; prev = s.at;
  }
  const rest = (tr.total - prev) / SPEED;
  return t < rest ? { dist: prev + t * SPEED, finished: false } : { dist: tr.total, finished: true };
}

// ── Oficina ──────────────────────────────────────────────────────────

export function OfficeFloor({ agents, activity, selected, onSelect, kpis, posts, meeting, projections, onOpenProjection, onOpenMeeting }: {
  agents: MkAgent[]; activity: MkActivity[]; selected: string | null; onSelect: (id: string | null) => void;
  kpis: MkKpis | null; posts: MkPost[];
  meeting: MkMeeting | null; projections: MkProjection[]; onOpenProjection: (p: MkProjection) => void; onOpenMeeting: () => void;
}) {
  const [trips, setTrips] = useState<Record<string, Trip>>({});
  const [frame, setFrame] = useState(0);
  const seen = useRef<number>(0);
  const [now, setNow] = useState(() => Date.now());
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);

  const byIdRef = useRef(byId); byIdRef.current = byId;
  // Quién está sentado en la sala de juntas (id → asiento).
  const [inRoom, setInRoom] = useState<Record<string, number>>({});
  const inRoomRef = useRef(inRoom); inRoomRef.current = inRoom;
  const tripsRef = useRef(trips); tripsRef.current = trips;
  const startTrip = useCallback((fromId: string, targetIds: string[], done?: () => void) => {
    const from = byIdRef.current[fromId];
    const targets = targetIds.map((id) => byIdRef.current[id]).filter((t): t is MkAgent => !!t && t.id !== fromId);
    if (!from || !targets.length || inRoomRef.current[fromId] !== undefined || tripsRef.current[fromId]?.room) { done?.(); return; }
    tripsRef.current[fromId]?.done?.();
    const trip: Trip = { agent: fromId, ...planTrip(from, targets), started: performance.now(), done };
    setTrips((cur) => ({ ...cur, [fromId]: trip }));
  }, []);

  // El chat pide caminatas y espera a que el agente regrese a su lugar.
  useEffect(() => walkBus.register((from, targets) => new Promise<void>((res) => startTrip(from, targets, res))), [startTrip]);

  // Encargos que ocurren fuera del chat (tareas del ciclo): caminata de un destino.
  useEffect(() => {
    if (!activity.length) return;
    const newest = activity[0].id;
    if (seen.current === 0) { seen.current = newest; return; }
    const fresh = activity.filter((e) => e.id > seen.current && e.kind === 'talk' && e.target_agent && e.target_agent !== e.agent_id).reverse();
    seen.current = Math.max(seen.current, newest);
    for (const e of fresh) {
      if (walkBus.busy.has(e.agent_id) || tripsRef.current[e.agent_id] || inRoomRef.current[e.agent_id] !== undefined) continue;
      startTrip(e.agent_id, [e.target_agent!]);
    }
  }, [activity, startTrip]);

  const attendeesRef = useRef<string[]>([]);
  const zoomWhenSeated = useRef(false);
  const attendeesKey = meeting?.status === 'en_curso' ? meeting.attendees.slice(0, ROOM_SEATS.length).join(',') : '';
  useEffect(() => {
    const want = attendeesKey ? attendeesKey.split(',') : [];
    const now = performance.now();
    const next: Record<string, Trip> = {};
    want.forEach((id, i) => {
      const a = byIdRef.current[id];
      if (!a || inRoomRef.current[id] !== undefined || tripsRef.current[id]?.room?.dir === 'in') return;
      tripsRef.current[id]?.done?.();
      next[id] = { agent: id, ...roomTrip(a, i), started: now, room: { seat: i, dir: 'in' } };
    });
    const leaving = Object.entries(inRoomRef.current).filter(([id]) => !want.includes(id));
    leaving.forEach(([id, seatIdx]) => {
      const a = byIdRef.current[id]; if (!a) return;
      const t = roomTrip(a, seatIdx);
      next[id] = { agent: id, path: [...t.path].reverse(), stops: [], total: t.total, started: now, room: { seat: seatIdx, dir: 'out' } };
    });
    if (leaving.length) setInRoom((cur) => { const n = { ...cur }; leaving.forEach(([id]) => delete n[id]); return n; });
    if (Object.keys(next).length) setTrips((cur) => ({ ...cur, ...next }));
    // Al convocar: vista completa para ver a todos caminar; cuando el último
    // se sienta, la cámara entra a la sala.
    attendeesRef.current = want;
    if (want.length && Object.keys(next).length && !Object.keys(inRoomRef.current).length) { zoomWhenSeated.current = true; setFocus(null); }
  }, [attendeesKey]);

  useEffect(() => {
    if (!Object.keys(trips).length) return;
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      setFrame(t);
      const done = Object.values(trips).filter((tr) => tripState(tr, t).finished);
      if (done.length) {
        setTrips((cur) => { const n = { ...cur }; done.forEach((d) => { if (n[d.agent] === d) delete n[d.agent]; }); return n; });
        done.forEach((d) => d.done?.());
        const seated = done.filter((d) => d.room?.dir === 'in');
        if (seated.length) setInRoom((cur) => {
          const n = { ...cur }; seated.forEach((d) => { n[d.agent] = d.room!.seat; });
          if (zoomWhenSeated.current && attendeesRef.current.every((id) => n[id] !== undefined || !byIdRef.current[id])) { zoomWhenSeated.current = false; setTimeout(() => setFocus('juntas'), 400); }
          return n;
        });
      } else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trips]);

  const poseOf = useCallback((a: MkAgent): Pose & { next?: string } => {
    const tr = trips[a.id];
    const [sx, sy] = seatOf(a);
    if (!tr) {
      const r = inRoom[a.id];
      if (r !== undefined) return { x: ROOM_SEATS[r][0], y: ROOM_SEATS[r][1], walking: false, away: false, facing: 1 };
      return { x: sx, y: sy, walking: false, away: false, facing: 1 };
    }
    const st = tripState(tr, frame);
    const { p, dir } = along(tr.path, st.dist);
    return { x: p[0], y: p[1], walking: !st.visiting && !st.finished, away: !st.finished, facing: dir < 0 ? -1 : 1, visiting: st.visiting, next: st.next };
  }, [trips, frame, inRoom]);

  const bubbles = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const a of agents) {
      if (trips[a.id]?.room) { out[a.id] = trips[a.id].room!.dir === 'in' ? 'Va a la sala de juntas' : 'Regresa a su lugar'; continue; }
      if (trips[a.id]) {
        const st = poseOf(a);
        const name = (id?: string) => byId[id ?? '']?.name.split(' ')[0] ?? 'el equipo';
        out[a.id] = st.visiting ? `Revisando con ${name(st.visiting)}` : st.next ? `Va con ${name(st.next)}` : 'Regresa a su lugar';
        continue;
      }
      if (a.current_action) { out[a.id] = a.current_action; continue; }
      const last = activity.find((e) => e.agent_id === a.id);
      out[a.id] = last && now - new Date(last.created_at).getTime() < 3 * 60_000 ? last.text : null;
    }
    return out;
  }, [agents, activity, now, trips, byId, poseOf]);

  // ── Cámara ──
  const full = useMemo(() => {
    const minX = iso(0, D)[0] - 40, maxX = iso(W, 0)[0] + 40;
    const minY = iso(0, 0, WALL_H + 0.6)[1] - 30, maxY = iso(W, D)[1] + 30;
    return [minX, minY, maxX - minX, maxY - minY] as const;
  }, []);
  const [focus, setFocus] = useState<string | null>(null);
  const fullStr = full.map((v) => v.toFixed(1)).join(' ');
  const vbRef = useRef<number[]>([...full]);
  const target = useMemo(() => {
    if (!focus) return [...full];
    const z = zoneById[focus];
    const top = z.y < HALL_Y ? WALL_H : 3.0;
    const c = [iso(z.x, z.y, top), iso(z.x + z.w, z.y, top), iso(z.x + z.w, z.y + z.d), iso(z.x, z.y + z.d), iso(z.x, z.y, top)];
    let x0 = Math.min(...c.map((p) => p[0])) - 24, x1 = Math.max(...c.map((p) => p[0])) + 24;
    let y0 = Math.min(...c.map((p) => p[1])) - 30, y1 = Math.max(...c.map((p) => p[1])) + 16;
    const aspect = full[2] / full[3];
    if ((x1 - x0) / (y1 - y0) < aspect) { const w = (y1 - y0) * aspect, cx = (x0 + x1) / 2; x0 = cx - w / 2; x1 = cx + w / 2; }
    else { const h = (x1 - x0) / aspect, cy = (y0 + y1) / 2; y0 = cy - h / 2; y1 = cy + h / 2; }
    return [x0, y0, x1 - x0, y1 - y0];
  }, [focus, full]);
  // El acercamiento se anima directo sobre el SVG (sin volver a dibujar la
  // oficina en cada cuadro): 520 ms con salida suave.
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const from = [...vbRef.current], t0 = performance.now(), dur = 520;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      vbRef.current = from.map((v, i) => v + (target[i] - v) * e);
      svg.setAttribute('viewBox', vbRef.current.map((v) => v.toFixed(1)).join(' '));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  // Histéresis: solo cambia de sala si el cursor se queda en otra sala; pasar
  // por el pasillo o por los muros no suelta el acercamiento.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null | undefined>(undefined);
  const focusRef = useRef(focus); focusRef.current = focus;
  const schedule = (want: string | null, ms: number) => {
    if (pending.current === want) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    pending.current = want;
    hoverTimer.current = setTimeout(() => { pending.current = undefined; setFocus(want); }, ms);
  };
  const cancel = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = null; pending.current = undefined; };
  const onMove = (e: React.MouseEvent) => {
    if (zoomWhenSeated.current) return; // mientras llegan a la reunión, la cámara no se mueve
    const svg = svgRef.current; if (!svg) return;
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const [wx, wy] = unIso(p.x, p.y);
    const want = ZONES.find((zz) => wx >= zz.x + 0.3 && wx <= zz.x + zz.w - 0.3 && wy >= zz.y + 0.3 && wy <= zz.y + zz.d - 0.3)?.id ?? null;
    if (!want || want === focusRef.current) { if (pending.current !== null) cancel(); return; }
    schedule(want, focusRef.current ? 450 : 280);
  };
  const onLeave = () => { if (!zoomWhenSeated.current) schedule(null, 500); };

  // ── Escena ──
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
  const night = hour < 7 || hour >= 19;
  const awayKey = Object.keys(trips).sort().join(',');
  const staticScene = useMemo(() => {
  const drawables: Drawable[] = [];
  const away = new Set(awayKey ? awayKey.split(',') : []);
  const slot = (a: MkAgent) => `${a.zone}:${a.desk % (DESKS[a.zone]?.length ?? 1)}`;
  const workingByDesk = new Set(agents.filter((a) => a.enabled && (a.status === 'working' || a.status === 'talking') && !away.has(a.id)).map(slot));
  const colorByDesk = Object.fromEntries(agents.map((a) => [slot(a), a.color]));
  const awayByDesk = new Set(agents.filter((a) => away.has(a.id)).map(slot));

  // Escritorios
  for (const [zone, list] of Object.entries(DESKS)) {
    list.forEach(([x, y], i) => {
      const occupied = agents.some((a) => a.zone === zone && a.desk % list.length === i);
      if (!occupied && zone !== 'direccion') return;
      const id = `${zone}:${i}`;
      const on = workingByDesk.has(id);
      const glow = colorByDesk[id] ?? zoneById[zone].accent;
      const w = deskW(zone);
      const exec = zone === 'direccion';
      const top = exec ? '#3A2618' : '#273247';
      const accent = zoneById[zone].accent;
      drawables.push({ key: `pool-${id}`, depth: -0.5, node: <ellipse key={`pool-${id}`} cx={iso(x + w / 2, y + 0.3)[0]} cy={iso(x + w / 2, y + 0.3)[1]} rx={w * 22} ry={w * 11} fill="url(#lightPool)" opacity={on ? 0.9 : 0.5} /> });
      drawables.push({ key: `sh-desk-${id}`, depth: x + y + 0.5, node: <polygon key={`sh-desk-${id}`} points={floorPoly(x + 0.15, y + 0.2, w, 1)} fill="#000" opacity={0.3} /> });
      drawables.push(box(`leg-a-${id}`, x + 0.05, y + 0.85, 0, 0.1, 0.1, 0.66, '#64748B'));
      drawables.push(box(`leg-b-${id}`, x + w - 0.15, y + 0.85, 0, 0.1, 0.1, 0.66, '#64748B'));
      drawables.push(box(`panel-${id}`, x + 0.1, y + 0.2, 0.15, w - 0.2, 0.06, 0.5, exec ? '#2A1A10' : '#1A2232'));
      drawables.push(box(`top-${id}`, x, y, 0.66, w, 1, 0.08, top, { stroke: '#00000040', top: shade(top, -0.08), edge: on ? glow : `${accent}88` }));
      if (awayByDesk.has(id)) {
        const cx = x + w / 2, cy = y - 0.38; const [px, py] = iso(cx, cy);
        drawables.push({ key: `chair-${id}`, depth: cx + cy + 0.8, node: <g key={`chair-${id}`} transform={`translate(${px},${py})`}><rect x={-12.5} y={-45} width={25} height={31} rx={8} fill="#1C2433" stroke="#3B4A61" strokeWidth={0.8} /><rect x={-13} y={-16} width={26} height={7} rx={3.5} fill="#111827" /></g> });
      }
      // Computadoras tipo iMac (dos en Dirección): marco de aluminio, pantalla
      // de vidrio, barbilla plateada, pie delgado, teclado y mouse plateados.
      const screens = exec ? [x + 0.45, x + 1.6] : [x + 0.62];
      screens.forEach((mx, si) => {
        const sw = 1.0, zt = 1.5, zb = 0.86, yy = y + 0.36;
        const Wd = sw * T, H = (zt - zb) * T, scrH = H * 0.78, neck = (zb - 0.74) * T;
        drawables.push({
          key: `mon-${id}-${si}`, depth: x + w + y + 1.05, // encima de la cubierta del escritorio
          node: (
            <g key={`mon-${id}-${si}`}>
              {/* pie sobre el escritorio */}
              <polygon points={floorPoly(mx + sw / 2 - 0.2, yy - 0.02, 0.4, 0.26, 0.745)} fill="#C9CED6" stroke="#9AA1AB" strokeWidth={0.4} />
              {/* grosor lateral del equipo */}
              <polygon points={pts([iso(mx + sw, yy, zb - 0.02), iso(mx + sw, yy + 0.05, zb - 0.02), iso(mx + sw, yy + 0.05, zt), iso(mx + sw, yy, zt)])} fill="#8E959F" />
              <g transform={alongX(mx, yy, zt)}>
                <path d={`M${Wd / 2 - 3},${H} L${Wd / 2 + 3},${H} L${Wd / 2 + 2.4},${H + neck} L${Wd / 2 - 2.4},${H + neck} Z`} fill="url(#aluNeck)" />
                {on && <rect x={-2} y={-2} width={Wd + 4} height={scrH + 4} rx={3} fill={glow} opacity={0.5} filter="url(#glow)" />}
                <rect x={-0.8} y={-0.8} width={Wd + 1.6} height={H + 0.8} rx={1.8} fill="url(#alu)" stroke="#8E959F" strokeWidth={0.4} />
                <rect x={0.4} y={0.4} width={Wd - 0.8} height={scrH} rx={0.8} fill="#05070C" />
                <rect x={1.3} y={1.3} width={Wd - 2.6} height={scrH - 1.8} rx={0.4} fill={on ? '#0B1220' : '#0A0F1A'} />
                <g transform="translate(1.3,1.3)" opacity={on ? 1 : 0.3}>
                  <rect width={Wd - 2.6} height={2.2} fill={on ? glow : '#334155'} opacity={0.9} />
                  <rect x={0.8} y={3.4} width={(Wd - 4) * 0.28} height={scrH - 6} rx={0.4} fill="#111A2E" />
                  {[0, 1, 2].map((r) => <rect key={r} x={(Wd - 4) * 0.33} y={4 + r * 2.8} width={(Wd - 4) * (0.42 + ((r + si) % 3) * 0.12)} height={1.3} rx={0.6} fill="#94A3B8" opacity={0.75} className={on ? 'mk-code' : undefined} />)}
                  <polyline points={`${(Wd - 4) * 0.33},${scrH - 3.5} ${(Wd - 4) * 0.45},${scrH - 5.5} ${(Wd - 4) * 0.57},${scrH - 4.6} ${(Wd - 4) * 0.7},${scrH - 7} ${(Wd - 4) * 0.85},${scrH - 6.2}`} fill="none" stroke={on ? '#34D399' : '#334155'} strokeWidth={0.8} />
                </g>
                {/* reflejo del vidrio */}
                <path d={`M${Wd * 0.55},0.4 L${Wd - 0.4},0.4 L${Wd - 0.4},${scrH * 0.55} Z`} fill="#fff" opacity={0.05} />
              </g>
              {/* teclado y mouse */}
              <polygon points={pts([iso(mx + 0.08, y + 0.68, 0.75), iso(mx + 0.86, y + 0.68, 0.75), iso(mx + 0.86, y + 0.86, 0.75), iso(mx + 0.08, y + 0.86, 0.75)])} fill="#E5E7EB" stroke="#9CA3AF" strokeWidth={0.4} />
              {[0.72, 0.77, 0.82].map((ky) => <polyline key={ky} points={pts([iso(mx + 0.12, y + ky, 0.752), iso(mx + 0.82, y + ky, 0.752)])} stroke="#B8BEC7" strokeWidth={0.5} strokeDasharray="1.2 0.8" />)}
              <ellipse cx={iso(mx + 1.02, y + 0.78, 0.75)[0]} cy={iso(mx + 1.02, y + 0.78, 0.75)[1]} rx={2.6} ry={1.7} fill="#F3F4F6" stroke="#9CA3AF" strokeWidth={0.4} />
            </g>
          ),
        });
      });
    });
  }

  // ── Dirección
  drawables.push(box('dir-shelf', 0.15, 0.7, 0, 0.5, 2.4, 2.4, '#2A1A10', {
    edge: '#F59E0B',
    extra: <g>{[0.35, 0.95, 1.55].map((z, r) => Array.from({ length: 6 }).map((_, i) => {
      const y0 = 0.85 + i * 0.36; const c = ['#F59E0B', '#FBBF24', '#B45309', '#FDE68A', '#D97706', '#92400E'][(i + r) % 6];
      return <polygon key={`${r}-${i}`} points={pts([iso(0.66, y0, z), iso(0.66, y0 + 0.26, z), iso(0.66, y0 + 0.26, z + 0.45), iso(0.66, y0, z + 0.45)])} fill={c} opacity={0.85} />;
    }))}</g>,
  }));
  drawables.push(glowMat('dir-rug', 5.5, 3.3, 3.2, 2.6, '#F59E0B'));
  drawables.push(box('dir-sofa', 6.0, 5.0, 0, 2.6, 0.9, 0.45, '#1F2937', { edge: '#F59E0B' }));
  drawables.push(box('dir-sofa-back', 6.0, 5.6, 0.45, 2.6, 0.3, 0.45, '#111827'));
  drawables.push(box('dir-table', 6.5, 3.8, 0, 1.6, 0.8, 0.32, '#0F172A', { top: '#1E293B', edge: '#F59E0B' }));
  drawables.push(plant('dir-plant', 0.6, 6.0));
  drawables.push(plant('dir-plant2', 8.3, 0.5));
  // ── Estrategia: mesa holográfica
  drawables.push(glowMat('str-rug', 11.8, 3.2, 5.4, 2.5, '#8B5CF6'));
  drawables.push(box('str-table', 12.3, 3.7, 0, 4.4, 1.4, 0.7, '#1A1F38', { top: '#252B4D', edge: '#A78BFA' }));
  [12.6, 13.9, 15.2, 16.5].forEach((x, i) => {
    drawables.push(box(`str-chair-a${i}`, x, 3.15, 0, 0.5, 0.4, 0.45, '#312E81'));
    drawables.push(box(`str-chair-b${i}`, x, 5.2, 0, 0.5, 0.4, 0.45, '#312E81'));
  });
  drawables.push(hologram('holo', 14.5, 4.4));
  drawables.push(plant('str-plant', 18.4, 6.3));
  // ── Datos e IA
  [24.0, 25.1, 26.2, 27.3, 28.4].forEach((x, i) => {
    drawables.push(box(`rack-${i}`, x, 0.4, 0, 0.9, 0.9, 2.6, '#070B14', {
      stroke: '#22D3EE40', edge: '#22D3EE',
      extra: <g>{Array.from({ length: 9 }).map((_, r) => {
        const [lx, ly] = iso(x + 0.15 + (r % 3) * 0.22, 1.3, 0.3 + r * 0.25);
        return <circle key={r} cx={lx} cy={ly} r={1.5} fill={r % 3 === 0 ? '#22D3EE' : r % 3 === 1 ? '#22C55E' : '#F59E0B'} className="mk-led" style={{ animationDelay: `${(i * 7 + r) * 0.17}s` }} />;
      })}</g>,
    }));
  });
  drawables.push({ key: 'cable-tray', depth: 1, node: <polyline key="cable-tray" points={pts([iso(23.6, 1.6, 0.02), iso(23.6, 3.4, 0.02), iso(21.7, 3.4, 0.02)])} fill="none" stroke="#22D3EE" strokeWidth={2} opacity={0.5} className="mk-dash" strokeDasharray="6 6" /> });
  drawables.push(aiCore('ai-core', 21.7, 1.9));
  // ── Estudio creativo
  drawables.push(box('studio-backdrop', 1.2, 16.8, 0, 3.6, 0.15, 2.4, '#F8FAFC', { stroke: '#CBD5E1' }));
  drawables.push(glowMat('studio-mat', 1.3, 17.1, 3.4, 1.6, '#F43F5E'));
  drawables.push(softbox('softbox-a', 0.9, 18.6));
  drawables.push(softbox('softbox-b', 4.8, 18.6));
  drawables.push(camera('camera', 2.9, 19.2));
  drawables.push(plant('cre-plant', 9.2, 19.2));
  // ── Social media: muro de pantallas con publicaciones reales
  drawables.push(glowMat('soc-rug', 12.2, 17.0, 5.6, 2.6, '#EC4899'));
  drawables.push(box('soc-stand', 12.6, 16.6, 0, 4.8, 0.3, 0.45, '#111827', { edge: '#EC4899' }));
  drawables.push({ key: 'soc-wall', depth: 12.6 + 16.6 + 5.5, node: <g key="soc-wall" transform={alongX(12.6, 16.6, 2.85)}><SocialWall w={4.8 * T} h={2.3 * T} posts={posts} /></g> });
  drawables.push(box('beanbag-a', 17.0, 18.6, 0, 0.9, 0.9, 0.45, '#BE185D'));
  drawables.push(box('beanbag-b', 12.0, 18.7, 0, 0.9, 0.9, 0.45, '#4338CA'));
  // ── Recursos Humanos
  drawables.push(box('rh-board-stand', 26.9, 15.7, 0, 2.7, 0.25, 0.4, '#111827', { edge: '#10B981' }));
  drawables.push({ key: 'rh-board', depth: 26.9 + 15.7 + 3, node: <g key="rh-board" transform={alongX(26.9, 15.7, 2.6)}><TalentBoard w={2.7 * T} h={2.0 * T} agents={agents} /></g> });
  // ── Sala de juntas: mesa larga, sillas, pantalla grande al fondo
  drawables.push(glowMat('jt-rug', 22.6, 10.0, 4.8, 4.4, '#38BDF8'));
  drawables.push(box('jt-table', 23.9, 10.5, 0, 2.2, 3.3, 0.72, '#1E293B', { top: '#2A3548', edge: '#38BDF8' }));
  ROOM_SEATS.forEach(([cx, cy], i) => drawables.push(box(`jt-chair-${i}`, cx - 0.25, cy - 0.2, 0, 0.5, 0.4, 0.42, '#1E3A5F', { top: '#24466F' })));
  drawables.push(box('jt-screen-stand', 21.5, 9.15, 0, 7, 0.2, 0.62, '#0B1220', { edge: '#38BDF8' }));
  const shown = meeting ? projections.find((p) => p.meeting_id === meeting.id) ?? null : null;
  drawables.push({ key: 'jt-screen', depth: 30, node: (
    <g key="jt-screen" transform={alongX(21.5, 9.3, 3.0)} onClick={(e) => { e.stopPropagation(); if (meeting) onOpenMeeting(); else if (shown) onOpenProjection(shown); }}>
      <RoomScreen w={7 * T} h={2.3 * T} p={shown} topic={meeting?.topic ?? null} live={!!meeting} />
    </g>
  ) });
  drawables.push(plant('jt-plant', 29.2, 13.7));
  drawables.push(plant('rh-plant', 29.2, 19.2));
  // ── Pasillo
  drawables.push(box('reception', 18.9, 7.35, 0, 1.0, 1.3, 0.95, '#0B1220', { top: '#111A2E', edge: '#10B981' }));
  drawables.push(box('coffee', 9.6, 7.7, 0, 0.7, 0.7, 1.3, '#1F1A17', { top: '#2D2520', edge: '#F59E0B' }));
  drawables.push(waterCooler('water', 29.2, 7.8));

  // Muros de cristal ahumado con borde luminoso del color del departamento
  for (const z of ZONES) {
    const glass = (key: string, x: number, y: number, w: number, d: number) => {
      drawables.push(box(key, x, y, 0, w, d, 1.9, z.accent, { opacity: 0.16, stroke: `${z.accent}55` }));
      const [a, b] = w > d ? [iso(x, y + d, 1.9), iso(x + w, y + d, 1.9)] : [iso(x + w, y, 1.9), iso(x + w, y + d, 1.9)];
      drawables.push({ key: `${key}-edge`, depth: x + w + y + d + 0.02, node: <line key={`${key}-edge`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={z.accent} strokeWidth={1.6} filter="url(#softGlow)" opacity={0.9} /> });
    };
    if (z.x + z.w < W) glass(`gw-e-${z.id}`, z.x + z.w - 0.08, z.y, 0.08, z.d);
    glass(`gw-s-${z.id}-a`, z.x, z.y + z.d - 0.08, z.w * 0.38, 0.08);
    glass(`gw-s-${z.id}-b`, z.x + z.w * 0.62, z.y + z.d - 0.08, z.w * 0.38, 0.08);
  }

  return drawables;
  }, [agents, awayKey, posts, meeting, projections, onOpenProjection, onOpenMeeting]);

  const drawables: Drawable[] = [...staticScene];
  for (const a of agents) {
    const pose = poseOf(a);
    const nearSide = !trips[a.id] && inRoom[a.id] !== undefined && pose.x > 25 ;
    drawables.push({ key: `p-${a.id}`, depth: nearSide ? TABLE_DEPTH + 0.2 : pose.x + pose.y + (pose.away ? 1.4 : 0.9), node: <Person key={`p-${a.id}`} a={a} pose={pose} t={pose.walking ? frame : 0} selected={selected === a.id} onSelect={onSelect} /> });
  }
  drawables.sort((p, q) => p.depth - q.depth);

  const focusZone = focus ? zoneById[focus] : null;
  const zoneAgents = focusZone ? (focusZone.id === 'juntas' ? agents.filter((a) => inRoom[a.id] !== undefined) : agents.filter((a) => a.zone === focusZone.id)) : [];

  // Letreros de departamento: en los muros (salas del fondo) o flotando en
  // esquinas despejadas (salas del frente). Se dibujan al final: nada los tapa.
  const SIGNS: { z: string; at: [number, number, number]; wall?: boolean }[] = [
    { z: 'direccion', at: [4.0, 0.02, 4.7], wall: true },
    { z: 'estrategia', at: [13.4, 0.02, 4.7], wall: true },
    { z: 'datos', at: [24.0, 0.02, 4.7], wall: true },
    { z: 'creativo', at: [3.4, 9.2, 2.3] },
    { z: 'social', at: [16.6, 9.2, 2.3] },
    { z: 'rh', at: [28.2, 18.4, 2.1] },
    { z: 'juntas', at: [21.6, 9.32, 3.85], wall: true },
  ];

  // Fondo, muros con pantallas y letreros: solo cambian con los datos.
  const backdrop = useMemo(() => (
      <>
        {/* Edificio */}
        <polygon points={pts([iso(-0.6, -0.6), iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(-0.6, D + 0.6)])} fill="#1E293B" />
        <polygon points={pts([iso(-0.6, D + 0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.6), iso(-0.6, D + 0.6, -0.6)])} fill="#0F172A" />
        <polygon points={pts([iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.6), iso(W + 0.6, -0.6, -0.6)])} fill="#070B14" />
        <polyline points={pts([iso(-0.6, D + 0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, -0.6)])} fill="none" stroke="#10B981" strokeWidth={1.4} opacity={0.6} filter="url(#softGlow)" />
        <polygon points={floorPoly(0, 0, W, D)} fill="url(#hall)" />
        {/* Guías luminosas del pasillo */}
        <line x1={iso(0.6, HALL_Y)[0]} y1={iso(0.6, HALL_Y)[1]} x2={iso(W - 0.6, HALL_Y)[0]} y2={iso(W - 0.6, HALL_Y)[1]} stroke="#10B981" strokeWidth={1.2} strokeDasharray="10 12" opacity={0.55} className="mk-dash" />
        {ZONES.map((z) => (
          <g key={`f-${z.id}`}>
            <polygon points={floorPoly(z.x, z.y, z.w, z.d)} fill={`url(#${z.pattern})`} />
            <polygon points={floorPoly(z.x, z.y, z.w, z.d)} fill={z.accent} opacity={focus === z.id ? 0.1 : 0.03} style={{ transition: 'opacity .3s' }} />
            <polyline points={pts([iso(z.x, z.y + z.d, 0.02), iso(z.x + z.w, z.y + z.d, 0.02), iso(z.x + z.w, z.y, 0.02)])} fill="none" stroke={z.accent} strokeWidth={1.3} opacity={0.75} filter="url(#softGlow)" />
          </g>
        ))}

        {/* Muros */}
        <polygon points={pts([iso(0, 0), iso(W, 0), iso(W, 0, WALL_H), iso(0, 0, WALL_H)])} fill="url(#wallBack)" />
        <polygon points={pts([iso(0, 0), iso(0, D), iso(0, D, WALL_H), iso(0, 0, WALL_H)])} fill="url(#wallLeft)" />
        <polygon points={pts([iso(0, 0, WALL_H), iso(W, 0, WALL_H), iso(W, -0.25, WALL_H), iso(0, -0.25, WALL_H)])} fill="#2A3550" />
        <polygon points={pts([iso(0, 0, WALL_H), iso(0, D, WALL_H), iso(-0.25, D, WALL_H), iso(-0.25, 0, WALL_H)])} fill="#222C44" />
        <line x1={iso(0, 0, 0.12)[0]} y1={iso(0, 0, 0.12)[1]} x2={iso(W, 0, 0.12)[0]} y2={iso(W, 0, 0.12)[1]} stroke="#10B981" strokeWidth={1} opacity={0.45} filter="url(#softGlow)" />
        <line x1={iso(0, 0, 0.12)[0]} y1={iso(0, 0, 0.12)[1]} x2={iso(0, D, 0.12)[0]} y2={iso(0, D, 0.12)[1]} stroke="#10B981" strokeWidth={1} opacity={0.45} filter="url(#softGlow)" />

        {/* Ventanales con la ciudad */}
        {[[0.7, 3.2], [9.6, 12.9]].map(([x0, x1]) => (
          <g key={`win-${x0}`} transform={alongX(x0, 0, 3.3)}>
            <rect width={(x1 - x0) * T} height={2.2 * T} fill="url(#sky)" stroke="#334155" strokeWidth={2} />
            <Skyline w={(x1 - x0) * T} h={2.2 * T} night={night} seed={x0} />
            <line x1={(x1 - x0) * T / 2} y1={0} x2={(x1 - x0) * T / 2} y2={2.2 * T} stroke="#334155" strokeWidth={1.6} />
          </g>
        ))}
        {[[1.2, 6.2], [18.0, 19.6]].map(([y0, y1]) => (
          <g key={`winl-${y0}`} transform={alongLeftWall(y1, 3.3)}>
            <rect width={(y1 - y0) * T} height={2.2 * T} fill="url(#sky)" stroke="#334155" strokeWidth={2} />
            <Skyline w={(y1 - y0) * T} h={2.2 * T} night={night} seed={y0 + 7} />
          </g>
        ))}

        {/* Dashboard del Director (KPIs reales) */}
        <g transform={alongX(4.0, 0.03, 3.45)}><DirectorDashboard w={4.9 * T} h={2.35 * T} k={kpis} /></g>
        {/* Muro de Estrategia */}
        <g transform={alongX(13.4, 0.03, 3.4)}><StrategyBoard w={5.2 * T} h={2.2 * T} k={kpis} posts={posts} /></g>
        {/* Estudio creativo: piezas reales en el muro izquierdo */}
        <g transform={alongLeftWall(17.6, 3.2)}><Moodboard w={6.6 * T} h={2.1 * T} posts={posts} /></g>

        {/* Logo VYLTA iluminado */}
        <g transform={alongX(19.4, 0.02, 4.45)}>
          <rect x={-2} y={-1} width={3.3 * T} height={0.95 * T} rx={6} fill="#060A14" stroke="#10B98155" strokeWidth={1} />
          <g filter="url(#bigGlow)">
            <rect x={4} y={3.5} width={17} height={17} rx={4.5} fill="none" stroke="url(#logoGrad)" strokeWidth={2.2} />
            <path d="M8.5,8 L12.5,16.5 L16.5,8" fill="none" stroke="url(#logoGrad)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            <text x={26} y={18.5} fontSize={15} fontWeight={900} fill="url(#logoGrad)" letterSpacing={2.5}>VYLTA</text>
          </g>
        </g>

      </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [kpis, posts, night, focus]);
  const signs = useMemo(() => (
      <>
        {/* Letreros de departamento */}
        {SIGNS.map((s) => {
          const z = zoneById[s.z];
          const label = `${z.icon}  ${z.label.toUpperCase()}`;
          const wpx = label.length * 6.2 + 18;
          if (s.wall) {
            return (
              <g key={`sign-${s.z}`} transform={alongX(s.at[0], s.at[1], s.at[2])}>
                <rect width={wpx} height={15} rx={4} fill="#060A14" stroke={z.accent} strokeWidth={1.2} filter="url(#softGlow)" />
                <text x={9} y={10.5} fontSize={8.2} fontWeight={800} fill={z.accent} letterSpacing={1.2}>{label}</text>
              </g>
            );
          }
          const [sx, sy] = iso(...s.at);
          return (
            <g key={`sign-${s.z}`} transform={`translate(${sx},${sy})`}>
              <line x1={0} y1={0} x2={0} y2={-14} stroke={z.accent} strokeWidth={1} opacity={0.6} />
              <rect x={-wpx / 2} y={-30} width={wpx} height={16} rx={8} fill="#060A14e6" stroke={z.accent} strokeWidth={1.2} filter="url(#softGlow)" />
              <text x={0} y={-19} fontSize={8} fontWeight={800} fill={z.accent} textAnchor="middle" letterSpacing={1.1}>{label}</text>
            </g>
          );
        })}

      </>
  ), []);

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={fullStr} className="h-auto w-full select-none"
           onClick={() => onSelect(null)} onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={() => { if (pending.current === null) cancel(); }}>
        <defs>
          <pattern id="wood" width="22" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
            <rect width="22" height="10" fill="#33241A" /><path d="M0,5 H22" stroke="#40301F" strokeWidth="0.8" /><path d="M11,0 V5" stroke="#40301F" strokeWidth="0.6" />
          </pattern>
          <pattern id="tileV" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#1B1F35" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#8B5CF61f" strokeWidth="0.8" />
          </pattern>
          <pattern id="tileG" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#14231F" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#10B9811f" strokeWidth="0.8" />
          </pattern>
          <pattern id="concrete" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#26202B" /><circle cx="8" cy="12" r="0.8" fill="#3A3140" /><circle cx="28" cy="30" r="0.7" fill="#3A3140" /><circle cx="33" cy="9" r="0.6" fill="#3A3140" />
          </pattern>
          <pattern id="juntasP" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#151A2B" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#38BDF824" strokeWidth="0.8" />
          </pattern>
          <pattern id="carpet" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#1E1B33" /><circle cx="3" cy="3" r="0.6" fill="#EC489922" />
          </pattern>
          <pattern id="tech" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#0F1828" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#22D3EE2e" strokeWidth="0.8" />
          </pattern>
          <pattern id="hall" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#131A28" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#ffffff0a" strokeWidth="0.8" />
          </pattern>
          <radialGradient id="core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#A5F3FC" /><stop offset="60%" stopColor="#22D3EE" stopOpacity="0.6" /><stop offset="100%" stopColor="#22D3EE" stopOpacity="0" /></radialGradient>
          <radialGradient id="lightPool" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.22" /><stop offset="100%" stopColor="#E0F2FE" stopOpacity="0" /></radialGradient>
          <linearGradient id="wallBack" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1A2236" /><stop offset="1" stopColor="#0E1424" /></linearGradient>
          <linearGradient id="wallLeft" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#141B2C" /><stop offset="1" stopColor="#0A0F1C" /></linearGradient>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={night ? '#050B1F' : '#5EA8DD'} /><stop offset="1" stopColor={night ? '#1A2B55' : '#C9E6F7'} /></linearGradient>
          <linearGradient id="screenBg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0B1220" /><stop offset="1" stopColor="#060A14" /></linearGradient>
          <linearGradient id="areaGreen" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10B981" stopOpacity="0.55" /><stop offset="1" stopColor="#10B981" stopOpacity="0" /></linearGradient>
          <linearGradient id="alu" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F3F4F6" /><stop offset="0.8" stopColor="#D5DAE1" /><stop offset="1" stopColor="#BCC2CB" /></linearGradient>
          <linearGradient id="aluNeck" x1="0" x2="1"><stop offset="0" stopColor="#A9B0BA" /><stop offset="0.5" stopColor="#D9DEE5" /><stop offset="1" stopColor="#9BA2AD" /></linearGradient>
          <linearGradient id="logoGrad" x1="0" x2="1"><stop offset="0" stopColor="#34D399" /><stop offset="1" stopColor="#10B981" /></linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="bigGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {backdrop}

        {drawables.map((d) => d.node)}

        {signs}

        {/* Globos de lo que hace cada quien: capa superior, nada los tapa */}
        {agents.map((a) => {
          const text = bubbles[a.id];
          if (!text) return null;
          const pose = poseOf(a);
          const [bx, by] = iso(pose.x, pose.y);
          return (
            <g key={`b-${a.id}`} transform={`translate(${bx},${by + (pose.away ? -84 : -76) - (a.desk % 2 ? 22 : 0)})`} className="mk-bubble" pointerEvents="none">
              <rect x={-80} y={-24} width={160} height={22} rx={11} fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
              <path d="M-5,-2.5 L0,5 L5,-2.5 Z" fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
              <rect x={-6} y={-4} width={12} height={3} fill="#ffffff" />
              <text x={0} y={-9.5} fontSize={8.6} textAnchor="middle" fill="#0F172A" fontWeight={600}>{text.length > 35 ? `${text.slice(0, 34)}…` : text}</text>
            </g>
          );
        })}

        <style>{`
          .mk-pulse { animation: mkPulse 1.6s ease-in-out infinite; }
          @keyframes mkPulse { 50% { opacity: .55; } }
          .mk-breathe { animation: mkBreathe 3.4s ease-in-out infinite; }
          @keyframes mkBreathe { 50% { transform: translateY(-0.8px); } }
          .mk-type-body { animation: mkBob 0.9s ease-in-out infinite; }
          @keyframes mkBob { 50% { transform: translateY(0.9px); } }
          .mk-arm-l { animation: mkType .28s ease-in-out infinite alternate; }
          .mk-arm-r { animation: mkType .28s ease-in-out infinite alternate; animation-delay: .14s; }
          @keyframes mkType { to { transform: translateY(-1.6px); } }
          .mk-led { animation: mkLed 1.4s steps(2) infinite; }
          @keyframes mkLed { 50% { opacity: .15; } }
          .mk-blink-fast { animation: mkLed .7s steps(2) infinite; }
          .mk-code { animation: mkCodeW 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: left; }
          @keyframes mkCodeW { 50% { transform: scaleX(.6); } }
          .mk-draw { stroke-dasharray: 220; animation: mkDraw 6s ease-in-out infinite; }
          @keyframes mkDraw { 0% { stroke-dashoffset: 220; } 40%, 100% { stroke-dashoffset: 0; } }
          .mk-core { animation: mkCore 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes mkCore { 50% { transform: scale(1.12); opacity: .8; } }
          .mk-ring { animation: mkSpin 6s linear infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes mkSpin { to { transform: rotate(360deg); } }
          .mk-holo { animation: mkHolo 3s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }
          @keyframes mkHolo { 50% { transform: scaleY(.75); opacity: .7; } }
          .mk-bubble { animation: mkPop .35s ease-out; }
          @keyframes mkPop { from { opacity: 0; } }
          .mk-zz { animation: mkZz 2.4s ease-in-out infinite; }
          @keyframes mkZz { 50% { transform: translate(3px,-4px); opacity: .4; } }
          .mk-dash { animation: mkDash 1.2s linear infinite; }
          @keyframes mkDash { to { stroke-dashoffset: -44; } }
          .mk-dot { animation: mkDotA 1s ease-in-out infinite; }
          @keyframes mkDotA { 50% { opacity: .2; } }
          .mk-twinkle { animation: mkLed 3s steps(2) infinite; }
          .mk-person:hover > ellipse:first-child { opacity: .5; }
        `}</style>
      </svg>

      {focusZone && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 text-white shadow-xl backdrop-blur">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: focusZone.accent }}>{focusZone.icon} {focusZone.label}</div>
          <div className="mt-0.5 text-sm font-semibold">{zoneAgents.length ? zoneAgents.map((a) => a.name.split(' ')[0]).join(' · ') : 'Sin personal por ahora'}</div>
          <div className="text-[11px] text-white/60">{zoneAgents.filter((a) => a.enabled && a.status !== 'idle').length} trabajando · {zoneAgents.filter((a) => !a.enabled).length} en pausa</div>
        </div>
      )}
    </div>
  );
}

// ── Piezas decorativas ───────────────────────────────────────────────

function Skyline({ w, h, night, seed }: { w: number; h: number; night: boolean; seed: number }) {
  const rnd = (i: number) => { const x = Math.sin(seed * 99 + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const blds = Array.from({ length: Math.ceil(w / 9) }).map((_, i) => ({ x: i * 9, bw: 7 + rnd(i) * 4, bh: h * (0.3 + rnd(i + 50) * 0.55) }));
  return (
    <g>
      {blds.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={h - b.bh} width={b.bw} height={b.bh} fill={night ? '#0B1226' : '#7FA3C4'} opacity={night ? 1 : 0.75} />
          {night && Array.from({ length: Math.floor(b.bh / 6) }).map((_, r) => rnd(i * 7 + r) > 0.45 && (
            <rect key={r} x={b.x + 2} y={h - b.bh + 3 + r * 6} width={1.6} height={1.6} fill="#FDE68A" opacity={0.8} className={rnd(r + i) > 0.85 ? 'mk-twinkle' : undefined} />
          ))}
        </g>
      ))}
    </g>
  );
}

function glowMat(key: string, x: number, y: number, w: number, d: number, color: string): Drawable {
  return {
    key, depth: -1,
    node: (
      <g key={key}>
        <polygon points={floorPoly(x, y, w, d)} fill={color} opacity={0.12} />
        <polygon points={floorPoly(x + 0.12, y + 0.12, w - 0.24, d - 0.24)} fill="none" stroke={color} strokeWidth={1} opacity={0.55} filter="url(#softGlow)" />
      </g>
    ),
  };
}

function plant(key: string, x: number, y: number): Drawable {
  const [px, py] = iso(x + 0.3, y + 0.3, 0.55);
  return {
    key, depth: x + y + 1.2,
    node: (
      <g key={key}>
        {box(`${key}-pot`, x, y, 0, 0.6, 0.6, 0.55, '#334155', { top: '#1E293B' }).node}
        <g transform={`translate(${px},${py})`}>
          {[[-7, -14, '#15803D'], [6, -16, '#16A34A'], [0, -23, '#166534'], [-3, -9, '#22C55E'], [5, -8, '#15803D'], [-9, -20, '#166534']].map(([dx, dy, c], i) => (
            <ellipse key={i} cx={dx as number} cy={dy as number} rx={6} ry={9.5} fill={c as string} transform={`rotate(${(dx as number) * 4} ${dx} ${dy})`} />
          ))}
        </g>
      </g>
    ),
  };
}

function hologram(key: string, x: number, y: number): Drawable {
  const [cx, cy] = iso(x, y, 0.72);
  return {
    key, depth: x + y + 2.5,
    node: (
      <g key={key} transform={`translate(${cx},${cy})`}>
        <ellipse rx={26} ry={10} fill="#A78BFA" opacity={0.18} filter="url(#glow)" />
        <path d="M-26,0 L-12,-46 L12,-46 L26,0 Z" fill="#A78BFA" opacity={0.08} />
        {[[-14, 18, '#A78BFA'], [-6, 28, '#C4B5FD'], [2, 22, '#8B5CF6'], [10, 34, '#DDD6FE']].map(([bx, bh, c], i) => (
          <rect key={i} x={bx as number} y={-(bh as number) - 4} width={6} height={bh as number} rx={1} fill={c as string} opacity={0.75} className="mk-holo" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
        <ellipse rx={22} ry={8} fill="none" stroke="#C4B5FD" strokeWidth={1} opacity={0.7} className="mk-ring" />
      </g>
    ),
  };
}

function aiCore(key: string, x: number, y: number): Drawable {
  const [cx, cy] = iso(x, y, 0);
  return {
    key, depth: x + y + 1,
    node: (
      <g key={key}>
        {box(`${key}-base`, x - 0.7, y - 0.7, 0, 1.4, 1.4, 0.35, '#0F172A', { stroke: '#22D3EE80', top: '#132036', edge: '#22D3EE' }).node}
        <g transform={`translate(${cx},${cy - 42})`}>
          <circle r={34} fill="url(#core)" className="mk-core" />
          <circle r={11} fill="#ECFEFF" />
          <ellipse rx={25} ry={8} fill="none" stroke="#22D3EE" strokeWidth={1.6} className="mk-ring" />
          <ellipse rx={8} ry={25} fill="none" stroke="#A78BFA" strokeWidth={1.2} className="mk-ring" style={{ animationDuration: '9s' }} />
        </g>
      </g>
    ),
  };
}

function softbox(key: string, x: number, y: number): Drawable {
  const [bx, by] = iso(x, y, 0);
  return {
    key, depth: x + y,
    node: (
      <g key={key} transform={`translate(${bx},${by})`}>
        <line x1={0} y1={0} x2={0} y2={-46} stroke="#64748B" strokeWidth={2} />
        <path d="M-7,0 L0,-6 L7,0" stroke="#64748B" strokeWidth={2} fill="none" />
        <rect x={-14} y={-68} width={28} height={23} rx={3} fill="#FFFBEB" stroke="#1E293B" strokeWidth={2} filter="url(#softGlow)" />
        <rect x={-11} y={-65} width={22} height={17} rx={2} fill="#FEF3C7" />
      </g>
    ),
  };
}

function camera(key: string, x: number, y: number): Drawable {
  const [bx, by] = iso(x, y, 0);
  return {
    key, depth: x + y,
    node: (
      <g key={key} transform={`translate(${bx},${by})`}>
        <path d="M0,-30 L-8,0 M0,-30 L8,0 M0,-30 L0,0" stroke="#94A3B8" strokeWidth={1.6} />
        <rect x={-10} y={-42} width={20} height={13} rx={2} fill="#0F172A" stroke="#334155" />
        <circle cx={-1} cy={-35.5} r={4.2} fill="#1E293B" stroke="#94A3B8" />
        <circle cx={7} cy={-39.5} r={1.4} fill="#EF4444" className="mk-led" />
      </g>
    ),
  };
}

function waterCooler(key: string, x: number, y: number): Drawable {
  const [bx, by] = iso(x + 0.3, y + 0.3, 1.1);
  return {
    key, depth: x + y + 0.6,
    node: (
      <g key={key}>
        {box(`${key}-body`, x, y, 0, 0.6, 0.6, 1.1, '#334155').node}
        <ellipse cx={bx} cy={by - 8} rx={7} ry={10} fill="#7DD3FC" opacity={0.75} />
      </g>
    ),
  };
}
