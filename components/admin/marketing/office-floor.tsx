'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MkActivity, MkAgent } from '@/hooks/use-marketing';

// ═══════════════════════════════════════════════════════════════════════
// OfficeFloor — la oficina de marketing vista desde arriba (isométrica)
//
// Todo se dibuja con un proyector isométrico propio (sin librerías):
//   mundo (x, y, z) en baldosas → pantalla (sx, sy).
// Cada mueble es una caja con techo + 2 caras visibles, pintadas de atrás
// hacia adelante junto con los personajes (algoritmo del pintor).
//
// Vida:
//   • Monitores encendidos con el color de quien trabaja, servidores que
//     parpadean, núcleo de IA, muro social con el feed corriendo.
//   • Cuando un agente le encarga algo a otro, se levanta, camina por el
//     pasillo hasta su escritorio, platica con él y regresa a su lugar.
//   • Al pasar el cursor por una sala, la cámara se acerca a esa sala.
// ═══════════════════════════════════════════════════════════════════════

const T = 26;
const COS = 0.866, SIN = 0.5;
const W = 30, D = 20;
const HALL_Y = 8.0;                 // pasillo central

function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * T * COS, (x + y) * T * SIN - z * T];
}
function unIso(sx: number, sy: number): [number, number] {
  const a = sx / (T * COS), b = sy / (T * SIN);
  return [(a + b) / 2, (b - a) / 2];
}
const pts = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c * (1 - amt) : c + (255 - c) * -amt)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

type Drawable = { key: string; depth: number; node: React.ReactNode };

function box(key: string, x: number, y: number, z: number, w: number, d: number, h: number, color: string,
  opts: { opacity?: number; stroke?: string; top?: string; extra?: React.ReactNode; depthBias?: number } = {}): Drawable {
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  return {
    key, depth: x + w + y + d + z * 0.01 + (opts.depthBias ?? 0),
    node: (
      <g key={key} opacity={opts.opacity ?? 1}>
        <polygon points={pts(left)} fill={shade(color, 0.1)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(right)} fill={shade(color, 0.26)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(top)} fill={opts.top ?? color} stroke={opts.stroke} strokeWidth={0.6} />
        {opts.extra}
      </g>
    ),
  };
}

const floorPoly = (x: number, y: number, w: number, d: number) => pts([iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d)]);

// Sombra suave en el piso bajo un mueble.
function shadow(key: string, x: number, y: number, w: number, d: number, depth: number): Drawable {
  return { key, depth, node: <polygon key={key} points={floorPoly(x + 0.12, y + 0.18, w, d)} fill="#0F172A" opacity={0.08} /> };
}

// ── Distribución de la oficina ───────────────────────────────────────

type Zone = { id: string; label: string; x: number; y: number; w: number; d: number; floor: string; pattern?: string; accent: string };
const ZONES: Zone[] = [
  { id: 'direccion', label: 'Dirección', x: 0, y: 0, w: 9, d: 7, floor: '#C9A27E', pattern: 'wood', accent: '#F59E0B' },
  { id: 'estrategia', label: 'Estrategia', x: 10, y: 0, w: 9, d: 7, floor: '#EEF2F7', pattern: 'tile', accent: '#8B5CF6' },
  { id: 'datos', label: 'Datos e IA', x: 20, y: 0, w: 10, d: 7, floor: '#162033', pattern: 'tech', accent: '#22D3EE' },
  { id: 'creativo', label: 'Estudio creativo', x: 0, y: 9, w: 10, d: 11, floor: '#F4EFE7', pattern: 'concrete', accent: '#F43F5E' },
  { id: 'social', label: 'Social media', x: 11, y: 9, w: 8, d: 11, floor: '#EEF0FB', pattern: 'carpet', accent: '#EC4899' },
  { id: 'rh', label: 'Recursos Humanos', x: 20, y: 9, w: 10, d: 11, floor: '#EDF5F0', pattern: 'tile', accent: '#64748B' },
];
const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z]));

// Escritorios por sala (esquina del escritorio; el agente se sienta detrás, al norte).
const DESKS: Record<string, [number, number][]> = {
  direccion: [[3, 2.4]],
  estrategia: [[10.7, 1.6], [13.6, 1.6], [16.5, 1.6], [10.7, 5.4], [16.5, 5.4]],
  datos: [[24.0, 4.7], [26.9, 4.7], [24.0, 6.0]],
  creativo: [[1.0, 10.8], [4.1, 10.8], [7.2, 10.8], [1.0, 13.6], [4.1, 13.6]],
  social: [[12.0, 10.8], [15.6, 10.8], [12.0, 13.8], [15.6, 13.8]],
  rh: [[21.2, 10.8], [24.6, 10.8], [27.4, 10.8], [21.2, 16.0]],
};
const deskW = (zone: string) => (zone === 'direccion' ? 3 : 2.2);

function deskOf(a: MkAgent): [number, number] {
  const list = DESKS[a.zone] ?? DESKS.estrategia;
  return list[a.desk % list.length];
}
function seatOf(a: MkAgent): [number, number] {
  const [dx, dy] = deskOf(a);
  return [dx + deskW(a.zone) / 2, dy - 0.38];
}
// Punto junto al escritorio donde se para quien viene a platicar.
function visitSpot(a: MkAgent): [number, number] {
  const [dx, dy] = deskOf(a);
  return [dx - 0.45, dy + 0.35];
}
function doorOf(zone: string): [number, number] {
  const z = zoneById[zone] ?? ZONES[1];
  const cx = z.x + z.w / 2;
  return z.y < HALL_Y ? [cx, z.y + z.d + 0.5] : [cx, z.y - 0.5];
}

// Recorrido: levantarse → puerta → pasillo → puerta destino → junto al escritorio.
function routeBetween(from: MkAgent, to: MkAgent): [number, number][] {
  const [sx, sy] = seatOf(from);
  const [fx] = deskOf(from);
  const up: [number, number] = [fx - 0.45, sy];
  const goal = visitSpot(to);
  if (from.zone === to.zone) return [[sx, sy], up, [up[0], goal[1]], goal];
  const d1 = doorOf(from.zone), d2 = doorOf(to.zone);
  return [[sx, sy], up, [up[0], d1[1] - (d1[1] > sy ? 0.6 : -0.6)], d1, [d1[0], HALL_Y], [d2[0], HALL_Y], d2, [goal[0], d2[1]], goal];
}

// ── Personaje ────────────────────────────────────────────────────────

type Pose = { x: number; y: number; walking: boolean; away: boolean; facing: 1 | -1; visiting?: string };

function Person({ a, pose, selected, bubble, onSelect, t }: {
  a: MkAgent; pose: Pose; selected: boolean; bubble: string | null; onSelect: (id: string) => void; t: number;
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
      <ellipse cx={0} cy={2} rx={standing ? 12 : 20} ry={standing ? 5.5 : 9} fill={standing ? '#0F172A' : a.color}
               opacity={standing ? 0.18 : selected ? 0.55 : working ? 0.3 : 0.12} className={working && !standing ? 'mk-pulse' : undefined} />
      {selected && <ellipse cx={0} cy={2} rx={standing ? 15 : 23} ry={standing ? 7 : 10.5} fill="none" stroke={a.color} strokeWidth={2} />}

      {!standing && <>
        <rect x={-12} y={-44} width={24} height={30} rx={8} fill="#2B3646" />
        <rect x={-9.5} y={-41} width={19} height={24} rx={6} fill="#3B475A" />
      </>}

      <g transform={standing ? `scale(${pose.facing},1)` : undefined}>
        {standing && <>
          {/* Piernas en movimiento */}
          <rect x={-5.5} y={-12 + step * 1.2} width={4.5} height={13 - step * 1.2} rx={2} fill="#1E293B" />
          <rect x={1} y={-12 - step * 1.2} width={4.5} height={13 + step * 1.2} rx={2} fill="#273449" />
          <ellipse cx={-3.2} cy={1.5 + step * 0.6} rx={3.4} ry={1.6} fill="#0F172A" />
          <ellipse cx={3.2} cy={1.5 - step * 0.6} rx={3.4} ry={1.6} fill="#0F172A" />
        </>}
        <g transform={standing ? 'translate(0,-12)' : undefined} className={!standing ? (working ? 'mk-type-body' : 'mk-breathe') : undefined}>
          {/* Torso con sombreado */}
          <path d="M-11,-6 Q-12.5,-27 0,-29.5 Q12.5,-27 11,-6 Z" fill={outfit} />
          <path d="M3,-28.5 Q12.5,-26 11,-6 L5,-6 Q7,-18 3,-28.5 Z" fill="#000" opacity={0.12} />
          {L.tie && <path d="M0,-27 L-2.6,-20 L0,-8 L2.6,-20 Z" fill={L.tie} />}
          {!L.tie && <path d="M-4,-28 L0,-23 L4,-28" stroke="#ffffff80" strokeWidth={1.4} fill="none" />}
          {/* Brazos */}
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
          {/* Cuello y cabeza */}
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

      {paused && <text x={12} y={-48} fontSize={12} fill="#64748B" className="mk-zz">z z</text>}
      {pose.visiting && !pose.walking && (
        <g transform="translate(14,-50)"><rect x={-1} y={-9} width={22} height={13} rx={6.5} fill="#fff" stroke={a.color} /><g fill={a.color}><circle cx={5} cy={-2.5} r={1.4} className="mk-dot" /><circle cx={10} cy={-2.5} r={1.4} className="mk-dot" style={{ animationDelay: '.2s' }} /><circle cx={15} cy={-2.5} r={1.4} className="mk-dot" style={{ animationDelay: '.4s' }} /></g></g>
      )}
      <g transform={`translate(0,${standing ? -66 : -58})`}>
        <rect x={-34} y={-9} width={68} height={15} rx={7.5} fill="#0F172Ae6" />
        <circle cx={-25} cy={-1.5} r={3} fill={paused ? '#94A3B8' : working || pose.walking ? '#22C55E' : a.color} className={working ? 'mk-blink-fast' : undefined} />
        <text x={-19} y={2} fontSize={8.5} fontWeight={700} fill="#fff">{a.name.split(' ')[0]}</text>
      </g>
      {bubble && (
        <g transform={`translate(0,${(standing ? -84 : -76) - (a.desk % 2 ? 22 : 0)})`} className="mk-bubble">
          <rect x={-80} y={-24} width={160} height={22} rx={11} fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
          <path d="M-5,-2.5 L0,5 L5,-2.5 Z" fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
          <rect x={-6} y={-4} width={12} height={3} fill="#ffffff" />
          <text x={0} y={-9.5} fontSize={8.6} textAnchor="middle" fill="#0F172A" fontWeight={600}>
            {bubble.length > 35 ? `${bubble.slice(0, 34)}…` : bubble}
          </text>
        </g>
      )}
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

// ── Caminatas (agente va con otro y regresa) ─────────────────────────

type Trip = { agent: string; path: [number, number][]; dwellAt: number; target: string; started: number; dwellMs: number };
const SPEED = 3.0; // baldosas por segundo

function segLengths(path: [number, number][]) {
  const out: number[] = [];
  for (let i = 1; i < path.length; i++) out.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return out;
}
function along(path: [number, number][], dist: number): { p: [number, number]; dir: number } {
  const segs = segLengths(path);
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i]) {
      const k = segs[i] ? dist / segs[i] : 0;
      const a = path[i], b = path[i + 1];
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: (b[0] - a[0]) - (b[1] - a[1]) };
    }
    dist -= segs[i];
  }
  return { p: path[path.length - 1], dir: 0 };
}

// ── Oficina ──────────────────────────────────────────────────────────

export function OfficeFloor({ agents, activity, selected, onSelect }: {
  agents: MkAgent[]; activity: MkActivity[]; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const [trips, setTrips] = useState<Record<string, Trip>>({});
  const [frame, setFrame] = useState(0);
  const seen = useRef<number>(0);
  const [now, setNow] = useState(() => Date.now());
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);

  // Nuevos encargos → el agente se levanta y va con la persona.
  useEffect(() => {
    if (!activity.length) return;
    const newest = activity[0].id;
    if (seen.current === 0) { seen.current = newest; return; }
    const fresh = activity.filter((e) => e.id > seen.current && e.kind === 'talk' && e.target_agent && e.target_agent !== e.agent_id).reverse();
    seen.current = Math.max(seen.current, newest);
    if (!fresh.length) return;
    setTrips((cur) => {
      const next = { ...cur };
      for (const e of fresh) {
        const from = byId[e.agent_id], to = byId[e.target_agent!];
        if (!from || !to || next[from.id]) continue;
        const go = routeBetween(from, to);
        const path = [...go, ...go.slice(0, -1).reverse()];
        next[from.id] = { agent: from.id, path, dwellAt: segLengths(go).reduce((s, x) => s + x, 0), target: to.id, started: performance.now(), dwellMs: 3500 };
      }
      return next;
    });
  }, [activity, byId]);

  // Animación mientras alguien camina.
  useEffect(() => {
    if (!Object.keys(trips).length) return;
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      setFrame(t);
      const done = Object.values(trips).filter((tr) => {
        const total = segLengths(tr.path).reduce((s, x) => s + x, 0);
        return (t - tr.started) / 1000 * SPEED - tr.dwellMs / 1000 * SPEED > total + 0.01;
      });
      if (done.length) setTrips((cur) => { const n = { ...cur }; done.forEach((d) => delete n[d.agent]); return n; });
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trips]);

  const poseOf = useCallback((a: MkAgent): Pose => {
    const tr = trips[a.id];
    const [sx, sy] = seatOf(a);
    if (!tr) return { x: sx, y: sy, walking: false, away: false, facing: 1 };
    const elapsed = (frame - tr.started) / 1000;
    let dist = elapsed * SPEED;
    const dwell = tr.dwellMs / 1000 * SPEED;
    let visiting: string | undefined;
    let walking = true;
    if (dist > tr.dwellAt && dist < tr.dwellAt + dwell) { dist = tr.dwellAt; walking = false; visiting = tr.target; }
    else if (dist >= tr.dwellAt + dwell) dist -= dwell;
    const { p, dir } = along(tr.path, Math.max(0, dist));
    const atSeat = Math.hypot(p[0] - sx, p[1] - sy) < 0.05 && dist > 0.1;
    return { x: p[0], y: p[1], walking: walking && !atSeat, away: !atSeat || !walking, facing: dir < 0 ? -1 : 1, visiting };
  }, [trips, frame]);

  // Burbuja: caminando, acción en curso o lo último que hizo (3 min).
  const bubbles = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const a of agents) {
      const tr = trips[a.id];
      if (tr) { out[a.id] = `Va con ${byId[tr.target]?.name.split(' ')[0] ?? 'el equipo'}`; continue; }
      if (a.current_action) { out[a.id] = a.current_action; continue; }
      const last = activity.find((e) => e.agent_id === a.id);
      out[a.id] = last && now - new Date(last.created_at).getTime() < 3 * 60_000 ? last.text : null;
    }
    return out;
  }, [agents, activity, now, trips, byId]);

  // ── Cámara: acercamiento a la sala bajo el cursor ──
  const full = useMemo(() => {
    const minX = iso(0, D)[0] - 40, maxX = iso(W, 0)[0] + 40;
    const minY = iso(0, 0, 4.2)[1] - 110, maxY = iso(W, D)[1] + 30;
    return [minX, minY, maxX - minX, maxY - minY] as const;
  }, []);
  const [focus, setFocus] = useState<string | null>(null);
  const [vb, setVb] = useState<number[]>([...full]);
  const target = useMemo(() => {
    if (!focus) return [...full];
    const z = zoneById[focus];
    const c = [iso(z.x, z.y, 3.6), iso(z.x + z.w, z.y, 3.6), iso(z.x + z.w, z.y + z.d), iso(z.x, z.y + z.d), iso(z.x, z.y, 3.6)];
    let x0 = Math.min(...c.map((p) => p[0])) - 30, x1 = Math.max(...c.map((p) => p[0])) + 30;
    let y0 = Math.min(...c.map((p) => p[1])) - 70, y1 = Math.max(...c.map((p) => p[1])) + 20;
    const aspect = full[2] / full[3];
    if ((x1 - x0) / (y1 - y0) < aspect) { const w = (y1 - y0) * aspect, cx = (x0 + x1) / 2; x0 = cx - w / 2; x1 = cx + w / 2; }
    else { const h = (x1 - x0) / aspect, cy = (y0 + y1) / 2; y0 = cy - h / 2; y1 = cy + h / 2; }
    return [x0, y0, x1 - x0, y1 - y0];
  }, [focus, full]);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setVb((cur) => {
        const nxt = cur.map((v, i) => v + (target[i] - v) * 0.14);
        const close = nxt.every((v, i) => Math.abs(v - target[i]) < 0.6);
        if (!close) raf = requestAnimationFrame(step);
        return close ? target : nxt;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const [wx, wy] = unIso(p.x, p.y);
    const z = ZONES.find((zz) => wx >= zz.x && wx <= zz.x + zz.w && wy >= zz.y && wy <= zz.y + zz.d);
    const want = z?.id ?? null;
    if (want === focus) { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } return; }
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Entrar a una sala es rápido; salir al pasillo espera un poco (evita saltos).
    hoverTimer.current = setTimeout(() => setFocus(want), want ? 260 : 700);
  };
  const onLeave = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setFocus(null), 350); };

  // ── Escena ──
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
  const night = hour < 7 || hour >= 19;
  const drawables: Drawable[] = [];
  const slot = (a: MkAgent) => `${a.zone}:${a.desk % (DESKS[a.zone]?.length ?? 1)}`;
  const workingByDesk = new Set(agents.filter((a) => a.enabled && (a.status === 'working' || a.status === 'talking') && !trips[a.id]).map(slot));
  const colorByDesk = Object.fromEntries(agents.map((a) => [slot(a), a.color]));
  const awayByDesk = new Set(agents.filter((a) => trips[a.id]).map(slot));

  for (const [zone, list] of Object.entries(DESKS)) {
    list.forEach(([x, y], i) => {
      const occupied = agents.some((a) => a.zone === zone && a.desk % list.length === i);
      if (!occupied && zone !== 'direccion') return;
      const id = `${zone}:${i}`;
      const on = workingByDesk.has(id);
      const glow = colorByDesk[id] ?? '#10B981';
      const w = deskW(zone);
      const exec = zone === 'direccion';
      const top = exec ? '#6B4A36' : zone === 'datos' ? '#3B4A61' : '#FFFFFF';
      drawables.push(shadow(`sh-desk-${id}`, x, y, w, 1, x + y + 0.5));
      drawables.push(box(`leg-a-${id}`, x + 0.05, y + 0.85, 0, 0.1, 0.1, 0.66, '#94A3B8'));
      drawables.push(box(`leg-b-${id}`, x + w - 0.15, y + 0.85, 0, 0.1, 0.1, 0.66, '#94A3B8'));
      drawables.push(box(`panel-${id}`, x + 0.1, y + 0.2, 0.15, w - 0.2, 0.06, 0.5, exec ? '#4A2F22' : '#CBD5E1'));
      drawables.push(box(`top-${id}`, x, y, 0.66, w, 1, 0.08, top, { stroke: '#00000014', top: shade(top, -0.06) }));
      // Silla vacía mientras el agente camina por la oficina
      if (awayByDesk.has(id)) {
        const cx = x + w / 2, cy = y - 0.38;
        const [px, py] = iso(cx, cy);
        drawables.push({ key: `chair-${id}`, depth: cx + cy + 0.8, node: <g key={`chair-${id}`} transform={`translate(${px},${py})`}><rect x={-12} y={-44} width={24} height={30} rx={8} fill="#2B3646" /><rect x={-13} y={-16} width={26} height={7} rx={3.5} fill="#1E293B" /></g> });
      }
      // Monitor (la pantalla mira al agente) + teclado
      const mx = x + (exec ? 1.05 : 0.65);
      const scr = [iso(mx, y + 0.35, 0.82), iso(mx + 0.95, y + 0.35, 0.82), iso(mx + 0.95, y + 0.35, 1.5), iso(mx, y + 0.35, 1.5)];
      drawables.push({
        key: `mon-${id}`, depth: x + y + 2.1,
        node: (
          <g key={`mon-${id}`}>
            <polygon points={pts([iso(mx + 0.42, y + 0.4, 0.74), iso(mx + 0.53, y + 0.4, 0.74), iso(mx + 0.53, y + 0.4, 0.86), iso(mx + 0.42, y + 0.4, 0.86)])} fill="#475569" />
            {on && <polygon points={pts(scr)} fill={glow} opacity={0.35} filter="url(#glow)" />}
            <polygon points={pts(scr)} fill={on ? glow : '#1E293B'} className={on ? 'mk-screen' : undefined} stroke="#0B1220" strokeWidth={1.4} />
            {on && [1.0, 1.15, 1.3].map((z, k) => (
              <line key={k} x1={iso(mx + 0.12, y + 0.35, z)[0]} y1={iso(mx + 0.12, y + 0.35, z)[1]} x2={iso(mx + 0.58 + k * 0.08, y + 0.35, z)[0]} y2={iso(mx + 0.58 + k * 0.08, y + 0.35, z)[1]}
                    stroke="#ffffffcc" strokeWidth={1.1} className="mk-code" style={{ animationDelay: `${k * 0.3}s` }} />
            ))}
            <polygon points={pts([iso(mx - 0.1, y + 0.72, 0.75), iso(mx + 0.9, y + 0.72, 0.75), iso(mx + 0.9, y + 0.92, 0.75), iso(mx - 0.1, y + 0.92, 0.75)])} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.4} />
            {exec && <circle cx={iso(x + 2.6, y + 0.6, 0.76)[0]} cy={iso(x + 2.6, y + 0.6, 0.76)[1]} r={3} fill="#F59E0B" opacity={0.9} />}
          </g>
        ),
      });
    });
  }

  // ── Muebles y ambiente ──
  drawables.push(box('dir-shelf', 0.15, 0.6, 0, 0.5, 2.6, 2.2, '#6B4A36', {
    extra: (
      <g>
        {[0.35, 0.95, 1.55].map((z, r) => Array.from({ length: 7 }).map((_, i) => {
          const y0 = 0.75 + i * 0.33;
          const c = ['#DC2626', '#2563EB', '#F59E0B', '#10B981', '#7C3AED', '#0EA5E9', '#F97316'][(i + r * 2) % 7];
          return <polygon key={`${r}-${i}`} points={pts([iso(0.66, y0, z), iso(0.66, y0 + 0.24, z), iso(0.66, y0 + 0.24, z + 0.45), iso(0.66, y0, z + 0.45)])} fill={c} />;
        }))}
      </g>
    ),
  }));
  drawables.push(rug('dir-rug', 5.6, 3.2, 3.0, 2.6, '#0F766E'));
  drawables.push(box('dir-sofa', 6.0, 5.0, 0, 2.6, 0.9, 0.45, '#0F766E'));
  drawables.push(box('dir-sofa-back', 6.0, 5.6, 0.45, 2.6, 0.3, 0.45, '#115E59'));
  drawables.push(box('dir-table', 6.5, 3.7, 0, 1.6, 0.8, 0.35, '#1F2937', { top: '#334155' }));
  drawables.push(plant('dir-plant', 0.6, 6.0));
  drawables.push(plant('dir-plant2', 8.2, 0.5));
  drawables.push(rug('str-rug', 11.8, 3.2, 5.4, 2.5, '#DDD6FE'));
  drawables.push(shadow('str-table-sh', 12.3, 3.7, 4.4, 1.4, 16));
  drawables.push(box('str-table', 12.3, 3.7, 0, 4.4, 1.4, 0.7, '#FFFFFF', { stroke: '#CBD5E1' }));
  [12.6, 13.9, 15.2, 16.5].forEach((x, i) => {
    drawables.push(box(`str-chair-a${i}`, x, 3.15, 0, 0.5, 0.4, 0.45, '#7C3AED'));
    drawables.push(box(`str-chair-b${i}`, x, 5.2, 0, 0.5, 0.4, 0.45, '#7C3AED'));
  });
  drawables.push(plant('str-plant', 18.4, 6.3));
  [24.0, 25.1, 26.2, 27.3, 28.4].forEach((x, i) => {
    drawables.push(box(`rack-${i}`, x, 0.4, 0, 0.9, 0.9, 2.5, '#0B1220', {
      stroke: '#22D3EE30',
      extra: (
        <g>
          {Array.from({ length: 8 }).map((_, r) => {
            const [lx, ly] = iso(x + 0.15 + (r % 3) * 0.22, 1.3, 0.3 + r * 0.27);
            return <circle key={r} cx={lx} cy={ly} r={1.6} fill={r % 3 === 0 ? '#22D3EE' : r % 3 === 1 ? '#22C55E' : '#F59E0B'}
                           className="mk-led" style={{ animationDelay: `${(i * 7 + r) * 0.17}s` }} />;
          })}
        </g>
      ),
    }));
  });
  drawables.push({ key: 'cable-tray', depth: 1, node: <polyline key="cable-tray" points={pts([iso(23.6, 1.6, 0.02), iso(23.6, 3.4, 0.02), iso(21.7, 3.4, 0.02)])} fill="none" stroke="#22D3EE" strokeWidth={2} opacity={0.35} className="mk-dash" strokeDasharray="6 6" /> });
  drawables.push(aiCore('ai-core', 21.7, 1.9));
  drawables.push(box('studio-backdrop', 1.0, 16.6, 0, 3.6, 0.15, 2.4, '#F8FAFC', { stroke: '#CBD5E1' }));
  drawables.push(rug('studio-mat', 1.2, 17.0, 3.2, 1.6, '#FDE68A'));
  drawables.push(softbox('softbox-a', 0.8, 18.5));
  drawables.push(softbox('softbox-b', 4.6, 18.5));
  drawables.push(camera('camera', 2.7, 19.1));
  drawables.push(plant('cre-plant', 9.2, 19.2));
  drawables.push(box('cre-cabinet', 9.2, 10.2, 0, 0.6, 2.0, 1.1, '#E2E8F0'));
  drawables.push(rug('soc-rug', 12.2, 16.8, 5.4, 2.6, '#FBCFE8'));
  drawables.push(socialWall('social-wall', 13.0, 17.2));
  drawables.push(box('beanbag-a', 16.8, 18.4, 0, 0.9, 0.9, 0.45, '#EC4899'));
  drawables.push(box('beanbag-b', 12.0, 18.6, 0, 0.9, 0.9, 0.45, '#6366F1'));
  drawables.push(rug('rh-rug', 23.3, 13.7, 3.2, 2.4, '#BBF7D0'));
  drawables.push(box('rh-table', 23.8, 14.2, 0, 2.2, 1.2, 0.7, '#FFFFFF', { stroke: '#CBD5E1' }));
  drawables.push(box('rh-chair-a', 24.1, 13.65, 0, 0.5, 0.4, 0.45, '#64748B'));
  drawables.push(box('rh-chair-b', 25.3, 15.6, 0, 0.5, 0.4, 0.45, '#64748B'));
  drawables.push(box('rh-files', 29.0, 12.0, 0, 0.7, 2.0, 1.4, '#94A3B8', { top: '#CBD5E1' }));
  drawables.push(plant('rh-plant', 29.2, 19.2));
  drawables.push(box('reception', 18.9, 7.4, 0, 1.0, 1.2, 0.95, '#0F172A', { top: '#10B981' }));
  drawables.push(box('coffee', 9.7, 7.7, 0, 0.7, 0.7, 1.3, '#78350F', { top: '#A16207', extra: <circle cx={iso(10.05, 8.4, 0.9)[0]} cy={iso(10.05, 8.4, 0.9)[1]} r={2} fill="#F59E0B" className="mk-led" /> }));
  drawables.push(waterCooler('water', 29.2, 7.8));

  for (const z of ZONES) {
    const g = { opacity: 0.28, stroke: '#7CB9E8' };
    if (z.x + z.w < W) drawables.push(box(`gw-e-${z.id}`, z.x + z.w - 0.08, z.y, 0, 0.08, z.d, 1.8, '#A5D8FF', g));
    drawables.push(box(`gw-s-${z.id}-a`, z.x, z.y + z.d - 0.08, 0, z.w * 0.38, 0.08, 1.8, '#A5D8FF', g));
    drawables.push(box(`gw-s-${z.id}-b`, z.x + z.w * 0.62, z.y + z.d - 0.08, 0, z.w * 0.38, 0.08, 1.8, '#A5D8FF', g));
  }

  for (const a of agents) {
    const pose = poseOf(a);
    drawables.push({
      key: `p-${a.id}`, depth: pose.x + pose.y + (pose.away ? 1.4 : 0.9),
      node: <Person key={`p-${a.id}`} a={a} pose={pose} t={frame} selected={selected === a.id} bubble={bubbles[a.id]} onSelect={(id) => onSelect(id)} />,
    });
  }
  drawables.sort((p, q) => p.depth - q.depth);

  const focusZone = focus ? zoneById[focus] : null;
  const zoneAgents = focusZone ? agents.filter((a) => a.zone === focusZone.id) : [];

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={vb.map((v) => v.toFixed(1)).join(' ')} className="h-auto w-full select-none"
           onClick={() => onSelect(null)} onMouseMove={onMove} onMouseLeave={onLeave}>
        <defs>
          <pattern id="wood" width="18" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
            <rect width="18" height="10" fill="#C9A27E" /><path d="M0,5 H18" stroke="#B88D66" strokeWidth="0.8" /><path d="M9,0 V5" stroke="#B88D66" strokeWidth="0.6" />
          </pattern>
          <pattern id="tile" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#EEF2F7" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#DCE3EC" strokeWidth="0.7" />
          </pattern>
          <pattern id="concrete" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#F4EFE7" /><circle cx="8" cy="12" r="0.8" fill="#E2D8C8" /><circle cx="28" cy="30" r="0.7" fill="#E2D8C8" /><circle cx="33" cy="9" r="0.6" fill="#E2D8C8" />
          </pattern>
          <pattern id="carpet" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#EEF0FB" /><circle cx="3" cy="3" r="0.7" fill="#DDE1F7" />
          </pattern>
          <pattern id="tech" width="22.5" height="13" patternUnits="userSpaceOnUse">
            <rect width="22.5" height="13" fill="#162033" /><path d="M0,6.5 L11.25,0 L22.5,6.5 L11.25,13 Z" fill="none" stroke="#22D3EE26" strokeWidth="0.8" />
          </pattern>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A5F3FC" /><stop offset="60%" stopColor="#22D3EE" stopOpacity="0.6" /><stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wallL" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F1F5F9" /><stop offset="1" stopColor="#D5DDE7" /></linearGradient>
          <linearGradient id="wallR" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#E2E8F0" /><stop offset="1" stopColor="#C3CEDB" /></linearGradient>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={night ? '#0B1735' : '#9DD5F5'} /><stop offset="1" stopColor={night ? '#1E3A6B' : '#DDF1FB'} />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>

        {/* Base del edificio */}
        <polygon points={pts([iso(-0.6, -0.6), iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(-0.6, D + 0.6)])} fill="#CBD5E1" />
        <polygon points={pts([iso(-0.6, D + 0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.55), iso(-0.6, D + 0.6, -0.55)])} fill="#94A3B8" />
        <polygon points={pts([iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.55), iso(W + 0.6, -0.6, -0.55)])} fill="#64748B" />
        <polygon points={floorPoly(0, 0, W, D)} fill="#D9DFE7" />
        {/* Corredor con alfombra */}
        <polygon points={floorPoly(0.4, 7.3, W - 0.8, 1.4)} fill="#B9C3D0" />
        <polygon points={floorPoly(0.6, 7.55, W - 1.2, 0.9)} fill="#C7D0DB" />
        {ZONES.map((z) => (
          <g key={`f-${z.id}`}>
            <polygon points={floorPoly(z.x, z.y, z.w, z.d)} fill={z.pattern ? `url(#${z.pattern})` : z.floor} />
            <polygon points={floorPoly(z.x, z.y, z.w, z.d)} fill={z.accent} opacity={focus === z.id ? 0.1 : 0} style={{ transition: 'opacity .3s' }} />
          </g>
        ))}

        {/* Muros del fondo con ventanales */}
        <polygon points={pts([iso(0, 0), iso(W, 0), iso(W, 0, 3.4), iso(0, 0, 3.4)])} fill="url(#wallR)" />
        <polygon points={pts([iso(0, 0), iso(0, D), iso(0, D, 3.4), iso(0, 0, 3.4)])} fill="url(#wallL)" />
        <polygon points={pts([iso(0, 0, 3.4), iso(W, 0, 3.4), iso(W, -0.2, 3.4), iso(0, -0.2, 3.4)])} fill="#94A3B8" />
        <polygon points={pts([iso(0, 0, 3.4), iso(0, D, 3.4), iso(-0.2, D, 3.4), iso(-0.2, 0, 3.4)])} fill="#A9B5C4" />
        {[1.2, 4.6, 11.2, 14.6].map((x) => (
          <g key={`win-${x}`}>
            <polygon points={pts([iso(x, 0, 1.0), iso(x + 2.6, 0, 1.0), iso(x + 2.6, 0, 2.95), iso(x, 0, 2.95)])} fill="url(#sky)" stroke="#64748B" strokeWidth={1.6} />
            <line x1={iso(x + 1.3, 0, 1.0)[0]} y1={iso(x + 1.3, 0, 1.0)[1]} x2={iso(x + 1.3, 0, 2.95)[0]} y2={iso(x + 1.3, 0, 2.95)[1]} stroke="#64748B" strokeWidth={1.2} />
            {night && [0.3, 0.8, 1.6, 2.1].map((k) => <circle key={k} cx={iso(x + k, 0, 1.3 + (k % 0.5))[0]} cy={iso(x + k, 0, 1.3 + (k % 0.5))[1]} r={1} fill="#FDE68A" opacity={0.7} />)}
          </g>
        ))}
        {[2, 11, 15].map((y) => (
          <g key={`winw-${y}`}>
            <polygon points={pts([iso(0, y, 1.0), iso(0, y + 2.6, 1.0), iso(0, y + 2.6, 2.95), iso(0, y, 2.95)])} fill="url(#sky)" stroke="#64748B" strokeWidth={1.6} />
            <line x1={iso(0, y + 1.3, 1.0)[0]} y1={iso(0, y + 1.3, 1.0)[1]} x2={iso(0, y + 1.3, 2.95)[0]} y2={iso(0, y + 1.3, 2.95)[1]} stroke="#64748B" strokeWidth={1.2} />
          </g>
        ))}
        {/* Pantalla de ventas del Director */}
        <g>
          <polygon points={pts([iso(5.6, 0.05, 1.3), iso(8.6, 0.05, 1.3), iso(8.6, 0.05, 2.9), iso(5.6, 0.05, 2.9)])} fill="#0F172A" stroke="#334155" strokeWidth={2.4} />
          {[0.35, 0.6, 0.5, 0.85, 0.75, 1.0].map((h, i) => (
            <polygon key={i} className="mk-bar" style={{ animationDelay: `${i * 0.4}s` }}
                     points={pts([iso(5.9 + i * 0.45, 0.05, 1.45), iso(6.2 + i * 0.45, 0.05, 1.45), iso(6.2 + i * 0.45, 0.05, 1.45 + h * 1.2), iso(5.9 + i * 0.45, 0.05, 1.45 + h * 1.2)])}
                     fill={i === 5 ? '#F59E0B' : '#10B981'} />
          ))}
        </g>
        {/* Letrero VYLTA en el muro */}
        <g transform={`translate(${iso(19.4, 0, 2.6)[0]},${iso(19.4, 0, 2.6)[1]}) skewY(30)`}>
          <rect x={-4} y={-15} width={66} height={22} rx={4} fill="#0F172A" />
          <text x={6} y={1} fontSize={14} fontWeight={900} fill="#10B981" letterSpacing={2}>VYLTA</text>
        </g>

        {/* Nombres de las salas pintados en el piso */}
        {ZONES.map((z) => {
          const [lx, ly] = iso(z.x + 0.5, z.y + z.d - 0.45);
          return (
            <text key={`lbl-${z.id}`} transform={`matrix(${COS},${SIN},${-COS},${SIN},${lx},${ly})`}
                  fontSize={17} fontWeight={800} letterSpacing={2}
                  fill={z.id === 'datos' ? '#22D3EE' : z.id === 'direccion' ? '#7C5134' : '#94A3B8'} opacity={focus === z.id ? 1 : 0.8}>
              {z.label.toUpperCase()}
            </text>
          );
        })}

        {drawables.map((d) => d.node)}

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
          .mk-screen { animation: mkScreen 2.2s ease-in-out infinite; }
          @keyframes mkScreen { 50% { opacity: .78; } }
          .mk-code { stroke-dasharray: 14; animation: mkCode 1.3s linear infinite; }
          @keyframes mkCode { from { stroke-dashoffset: 28; } to { stroke-dashoffset: 0; } }
          .mk-bar { animation: mkBar 3s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }
          @keyframes mkBar { 50% { transform: scaleY(.82); } }
          .mk-core { animation: mkCore 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes mkCore { 50% { transform: scale(1.12); opacity: .8; } }
          .mk-ring { animation: mkSpin 6s linear infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes mkSpin { to { transform: rotate(360deg); } }
          .mk-bubble { animation: mkPop .35s ease-out; }
          @keyframes mkPop { from { opacity: 0; } }
          .mk-zz { animation: mkZz 2.4s ease-in-out infinite; }
          @keyframes mkZz { 50% { transform: translate(3px,-4px); opacity: .4; } }
          .mk-dash { animation: mkDash 1.2s linear infinite; }
          @keyframes mkDash { to { stroke-dashoffset: -24; } }
          .mk-feed { animation: mkFeed 6s linear infinite; }
          @keyframes mkFeed { from { transform: translateY(0); } to { transform: translateY(-24px); } }
          .mk-dot { animation: mkDotA 1s ease-in-out infinite; }
          @keyframes mkDotA { 50% { opacity: .2; } }
          .mk-person:hover > ellipse:first-child { opacity: .45; }
        `}</style>
      </svg>

      {/* Ficha de la sala enfocada */}
      {focusZone && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-white shadow-xl backdrop-blur">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: focusZone.accent }}>{focusZone.label}</div>
          <div className="mt-0.5 text-sm font-semibold">
            {zoneAgents.length ? zoneAgents.map((a) => a.name.split(' ')[0]).join(' · ') : 'Sin personal por ahora'}
          </div>
          <div className="text-[11px] text-white/60">
            {zoneAgents.filter((a) => a.enabled && a.status !== 'idle').length} trabajando · {zoneAgents.filter((a) => !a.enabled).length} en pausa
          </div>
        </div>
      )}
    </div>
  );
}

// ── Piezas decorativas ───────────────────────────────────────────────

function rug(key: string, x: number, y: number, w: number, d: number, color: string): Drawable {
  return {
    key, depth: -1,
    node: (
      <g key={key}>
        <polygon points={floorPoly(x, y, w, d)} fill={color} opacity={0.55} />
        <polygon points={floorPoly(x + 0.15, y + 0.15, w - 0.3, d - 0.3)} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.5} />
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
        {box(`${key}-pot`, x, y, 0, 0.6, 0.6, 0.55, '#B45309', { top: '#3F2A1D' }).node}
        <g transform={`translate(${px},${py})`}>
          {[[-7, -14, '#16A34A'], [6, -16, '#22C55E'], [0, -23, '#15803D'], [-3, -9, '#4ADE80'], [5, -8, '#16A34A'], [-9, -20, '#15803D']].map(([dx, dy, c], i) => (
            <ellipse key={i} cx={dx as number} cy={dy as number} rx={6} ry={9.5} fill={c as string} transform={`rotate(${(dx as number) * 4} ${dx} ${dy})`} />
          ))}
        </g>
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
        {box(`${key}-base`, x - 0.7, y - 0.7, 0, 1.4, 1.4, 0.35, '#0F172A', { stroke: '#22D3EE80', top: '#132036' }).node}
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
        <line x1={0} y1={0} x2={0} y2={-46} stroke="#334155" strokeWidth={2} />
        <path d="M-7,0 L0,-6 L7,0" stroke="#334155" strokeWidth={2} fill="none" />
        <rect x={-14} y={-68} width={28} height={23} rx={3} fill="#FFFBEB" stroke="#1E293B" strokeWidth={2} />
        <rect x={-11} y={-65} width={22} height={17} rx={2} fill="#FEF3C7" className="mk-screen" />
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
        <path d="M0,-30 L-8,0 M0,-30 L8,0 M0,-30 L0,0" stroke="#1E293B" strokeWidth={1.6} />
        <rect x={-10} y={-42} width={20} height={13} rx={2} fill="#0F172A" />
        <circle cx={-1} cy={-35.5} r={4.2} fill="#334155" stroke="#94A3B8" />
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
        {box(`${key}-body`, x, y, 0, 0.6, 0.6, 1.1, '#E2E8F0').node}
        <ellipse cx={bx} cy={by - 8} rx={7} ry={10} fill="#7DD3FC" opacity={0.8} />
      </g>
    ),
  };
}

function socialWall(key: string, x: number, y: number): Drawable {
  const [bx, by] = iso(x, y, 0);
  return {
    key, depth: x + y + 3,
    node: (
      <g key={key}>
        {box(`${key}-stand`, x, y, 0, 3.6, 0.25, 0.4, '#334155').node}
        <g transform={`translate(${bx},${by})`}>
          <g transform="skewY(30)">
            <rect x={0} y={-76} width={84} height={48} rx={4} fill="#0F172A" stroke="#475569" strokeWidth={2} />
            <clipPath id="feedclip"><rect x={4} y={-72} width={76} height={40} rx={2} /></clipPath>
            <g clipPath="url(#feedclip)">
              <g className="mk-feed">
                {Array.from({ length: 7 }).map((_, i) => (
                  <g key={i} transform={`translate(6,${-70 + i * 12})`}>
                    <rect width={8} height={8} rx={2} fill={i % 2 ? '#E1306C' : '#1877F2'} />
                    <rect x={11} y={1} width={40 + (i % 3) * 8} height={2.4} rx={1.2} fill="#CBD5E1" />
                    <rect x={11} y={5} width={24 + (i % 2) * 14} height={2} rx={1} fill="#64748B" />
                    <text x={64} y={7} fontSize={6} fill="#F43F5E">♥</text>
                  </g>
                ))}
              </g>
            </g>
          </g>
        </g>
      </g>
    ),
  };
}
