'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MkActivity, MkAgent } from '@/hooks/use-marketing';

// ═══════════════════════════════════════════════════════════════════════
// OfficeFloor — la oficina de marketing vista desde arriba (isométrica)
//
// Todo se dibuja con un proyector isométrico propio (sin librerías):
//   mundo (x, y, z) en "baldosas" → pantalla (sx, sy).
// Cada mueble es una caja con 3 caras (techo + 2 lados visibles) y se
// pinta de atrás hacia adelante (algoritmo del pintor) junto con los
// personajes, para que los escritorios tapen el cuerpo de quien está
// sentado detrás.
//
// Vida: los monitores se encienden cuando el agente trabaja, los
// servidores parpadean, el núcleo de IA pulsa, y cuando un agente le
// manda algo a otro viaja un paquete de luz entre sus escritorios.
// ═══════════════════════════════════════════════════════════════════════

const T = 26;                      // tamaño de baldosa en px
const COS = 0.866, SIN = 0.5;
const W = 30, D = 20;              // piso en baldosas

function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * T * COS, (x + y) * T * SIN - z * T];
}
const pts = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

type Drawable = { key: string; depth: number; node: React.ReactNode };

function box(key: string, x: number, y: number, z: number, w: number, d: number, h: number, color: string,
  opts: { opacity?: number; stroke?: string; topColor?: string; className?: string; extra?: React.ReactNode } = {}): Drawable {
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  return {
    key, depth: x + w + y + d + z * 0.01,
    node: (
      <g key={key} opacity={opts.opacity ?? 1} className={opts.className}>
        <polygon points={pts(left)} fill={shade(color, 0.12)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(right)} fill={shade(color, 0.28)} stroke={opts.stroke} strokeWidth={0.6} />
        <polygon points={pts(top)} fill={opts.topColor ?? color} stroke={opts.stroke} strokeWidth={0.6} />
        {opts.extra}
      </g>
    ),
  };
}

function floor(key: string, x: number, y: number, w: number, d: number, color: string, pattern?: string) {
  const p = [iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d)];
  return <polygon key={key} points={pts(p)} fill={pattern ? `url(#${pattern})` : color} stroke="#00000010" />;
}

// ── Distribución de la oficina ───────────────────────────────────────

type Zone = { id: string; label: string; x: number; y: number; w: number; d: number; floor: string; pattern?: string };
const ZONES: Zone[] = [
  { id: 'direccion', label: 'Dirección', x: 0, y: 0, w: 9, d: 7, floor: '#C9A27E', pattern: 'wood' },
  { id: 'estrategia', label: 'Estrategia', x: 10, y: 0, w: 9, d: 7, floor: '#E8EEF5' },
  { id: 'datos', label: 'Datos e IA', x: 20, y: 0, w: 10, d: 7, floor: '#1E293B', pattern: 'tech' },
  { id: 'creativo', label: 'Estudio creativo', x: 0, y: 9, w: 10, d: 11, floor: '#F3EEE6' },
  { id: 'social', label: 'Social media', x: 11, y: 9, w: 8, d: 11, floor: '#EEF2FF' },
  { id: 'rh', label: 'Recursos Humanos', x: 20, y: 9, w: 10, d: 11, floor: '#EEF6F1' },
];

// Escritorios por sala (esquina del escritorio; el agente se sienta detrás, al norte).
const DESKS: Record<string, [number, number][]> = {
  direccion: [[3, 2.4]],
  estrategia: [[10.7, 1.5], [13.6, 1.5], [16.5, 1.5], [10.7, 5.4], [16.5, 5.4]],
  datos: [[24.0, 4.6], [26.9, 4.6], [24.0, 6.0]],
  creativo: [[1.0, 10.6], [4.1, 10.6], [7.2, 10.6], [1.0, 13.4], [4.1, 13.4]],
  social: [[12.0, 10.6], [15.6, 10.6], [12.0, 13.6], [15.6, 13.6]],
  rh: [[21.2, 10.6], [24.6, 10.6], [27.4, 10.6], [21.2, 15.8]],
};

function seatOf(a: MkAgent): [number, number] {
  const list = DESKS[a.zone] ?? DESKS.estrategia;
  const [dx, dy] = list[a.desk % list.length];
  return [dx + (a.zone === 'direccion' ? 1.5 : 1.1), dy - 0.35];
}

// ── Personaje ────────────────────────────────────────────────────────

function Person({ a, selected, bubble, onSelect }: {
  a: MkAgent; selected: boolean; bubble: string | null; onSelect: (id: string) => void;
}) {
  const [sx, sy] = iso(...seatOf(a));
  const L = a.look ?? {};
  const skin = L.skin ?? '#E0AC69', hair = L.hair ?? '#2B1B12', outfit = L.outfit ?? a.color;
  const working = a.enabled && (a.status === 'working' || a.status === 'talking');
  const paused = !a.enabled;
  return (
    <g transform={`translate(${sx},${sy})`} className="mk-person" style={{ cursor: 'pointer' }}
       onClick={(e) => { e.stopPropagation(); onSelect(a.id); }} opacity={paused ? 0.55 : 1}>
      {/* Halo del agente */}
      <ellipse cx={0} cy={2} rx={20} ry={9} fill={a.color} opacity={selected ? 0.55 : working ? 0.3 : 0.12}
               className={working ? 'mk-pulse' : undefined} />
      {selected && <ellipse cx={0} cy={2} rx={23} ry={10.5} fill="none" stroke={a.color} strokeWidth={2} />}
      {/* Silla */}
      <rect x={-12} y={-44} width={24} height={30} rx={7} fill="#334155" />
      <rect x={-13} y={-16} width={26} height={7} rx={3} fill="#1E293B" />
      {/* Cuerpo */}
      <g className={working ? 'mk-type-body' : 'mk-breathe'}>
        <path d={`M-11,-6 Q-12,-27 0,-29 Q12,-27 11,-6 Z`} fill={outfit} />
        {L.tie && <path d="M0,-27 L-2.5,-20 L0,-9 L2.5,-20 Z" fill={L.tie} />}
        {!L.tie && <path d="M-4,-28 L0,-23 L4,-28" stroke="#ffffff70" strokeWidth={1.4} fill="none" />}
        {/* Brazos hacia el teclado */}
        <g className={working ? 'mk-arm-l' : undefined}><ellipse cx={-10} cy={-8} rx={3.4} ry={6} fill={outfit} transform="rotate(-25 -10 -8)" /><circle cx={-8} cy={-2} r={2.6} fill={skin} /></g>
        <g className={working ? 'mk-arm-r' : undefined}><ellipse cx={10} cy={-8} rx={3.4} ry={6} fill={outfit} transform="rotate(25 10 -8)" /><circle cx={8} cy={-2} r={2.6} fill={skin} /></g>
        {/* Cabeza */}
        <circle cx={0} cy={-37} r={8.2} fill={skin} />
        <Hair style={L.hairStyle} color={hair} />
        {L.glasses && <g stroke="#0F172A" strokeWidth={1} fill="#ffffff40"><circle cx={-3.2} cy={-36} r={2.4} /><circle cx={3.2} cy={-36} r={2.4} /><path d="M-0.8,-36 L0.8,-36" /></g>}
        {!L.glasses && <g fill="#1E293B"><circle cx={-2.8} cy={-36} r={0.95} /><circle cx={2.8} cy={-36} r={0.95} /></g>}
        <path d="M-2.4,-32.6 Q0,-31 2.4,-32.6" stroke="#7C2D12" strokeWidth={0.9} fill="none" />
      </g>
      {paused && <text x={12} y={-48} fontSize={12} fill="#64748B" className="mk-zz">z z</text>}
      {/* Gafete con nombre */}
      <g transform="translate(0,-58)">
        <rect x={-34} y={-9} width={68} height={15} rx={7.5} fill="#0F172Ae6" />
        <circle cx={-25} cy={-1.5} r={3} fill={paused ? '#94A3B8' : working ? '#22C55E' : a.color} className={working ? 'mk-blink-fast' : undefined} />
        <text x={-19} y={2} fontSize={8.5} fontWeight={700} fill="#fff">{a.name.split(' ')[0]}</text>
      </g>
      {bubble && (
        <g transform={`translate(0,${a.desk % 2 ? -98 : -76})`} className="mk-bubble">
          <rect x={-78} y={-24} width={156} height={22} rx={11} fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
          <path d="M-5,-2.5 L0,5 L5,-2.5 Z" fill="#ffffff" stroke={a.color} strokeWidth={1.4} />
          <rect x={-6} y={-4} width={12} height={3} fill="#ffffff" />
          <text x={0} y={-9.5} fontSize={8.6} textAnchor="middle" fill="#0F172A" fontWeight={600}>
            {bubble.length > 34 ? `${bubble.slice(0, 33)}…` : bubble}
          </text>
        </g>
      )}
    </g>
  );
}

function Hair({ style, color }: { style?: string; color: string }) {
  switch (style) {
    case 'long': return <path d="M-9,-36 Q-10,-48 0,-47 Q10,-48 9,-36 L9,-26 Q6,-30 6,-38 Q0,-43 -6,-38 Q-6,-30 -9,-26 Z" fill={color} />;
    case 'bun': return <g fill={color}><path d="M-8.5,-37 Q-9,-47 0,-46.5 Q9,-47 8.5,-37 Q5,-42 0,-42 Q-5,-42 -8.5,-37 Z" /><circle cx={0} cy={-48} r={4.2} /></g>;
    case 'ponytail': return <g fill={color}><path d="M-8.5,-37 Q-9,-47 0,-46.5 Q9,-47 8.5,-37 Q5,-42 0,-42 Q-5,-42 -8.5,-37 Z" /><path d="M7,-42 Q14,-38 10,-28 Q9,-35 6,-38 Z" /></g>;
    case 'curly': return <g fill={color}>{[-7, -3.5, 0, 3.5, 7].map((x) => <circle key={x} cx={x} cy={-44 + Math.abs(x) * 0.5} r={3.6} />)}</g>;
    case 'buzz': return <path d="M-8,-38 Q-8.5,-46 0,-46 Q8.5,-46 8,-38 Q4,-41.5 0,-41.5 Q-4,-41.5 -8,-38 Z" fill={color} opacity={0.85} />;
    case 'cap': return <g><path d="M-8.6,-38 Q-9,-47.5 0,-47.5 Q9,-47.5 8.6,-38 Z" fill={color} /><path d="M-9,-39 L-14,-38.5 Q-11,-41 -8,-41 Z" fill={color} /></g>;
    default: return <path d="M-8.5,-37 Q-9,-47 0,-46.5 Q9,-47 8.5,-37 Q6,-42.5 0,-42.5 Q-6,-42.5 -8.5,-37 Z" fill={color} />;
  }
}

// ── Oficina ──────────────────────────────────────────────────────────

type Packet = { id: number; from: [number, number]; to: [number, number]; color: string };

export function OfficeFloor({ agents, activity, selected, onSelect }: {
  agents: MkAgent[]; activity: MkActivity[]; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const [packets, setPackets] = useState<Packet[]>([]);
  const seen = useRef<number>(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  // Paquetes de luz cuando un agente le encarga algo a otro (solo eventos nuevos).
  useEffect(() => {
    if (!activity.length) return;
    const newest = activity[0].id;
    if (seen.current === 0) { seen.current = newest; return; }
    const fresh = activity.filter((e) => e.id > seen.current && e.kind === 'talk' && e.target_agent);
    seen.current = Math.max(seen.current, newest);
    if (!fresh.length) return;
    const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
    const add = fresh.flatMap((e) => {
      const f = byId[e.agent_id], t = byId[e.target_agent!];
      if (!f || !t) return [];
      return [{ id: e.id, from: iso(...seatOf(f), 1.6), to: iso(...seatOf(t), 1.6), color: f.color }];
    });
    setPackets((p) => [...p, ...add]);
    add.forEach((p) => setTimeout(() => setPackets((cur) => cur.filter((x) => x.id !== p.id)), 2600));
  }, [activity, agents]);

  // Burbuja: acción en curso, o lo último que hizo en los últimos 3 minutos.
  const bubbles = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const a of agents) {
      if (a.current_action) { out[a.id] = a.current_action; continue; }
      const last = activity.find((e) => e.agent_id === a.id);
      out[a.id] = last && now - new Date(last.created_at).getTime() < 3 * 60_000 ? last.text : null;
    }
    return out;
  }, [agents, activity, now]);

  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)));
  const night = hour < 7 || hour >= 19;
  const windowColor = night ? '#1E3A5F' : '#BFE3F7';

  const drawables: Drawable[] = [];
  const workingByDesk = new Set(agents.filter((a) => a.enabled && a.status !== 'idle' && a.status !== 'paused').map((a) => `${a.zone}:${a.desk}`));
  const colorByDesk = Object.fromEntries(agents.map((a) => [`${a.zone}:${a.desk}`, a.color]));

  // Escritorios con monitor (+ silla vacía si no hay nadie).
  for (const [zone, list] of Object.entries(DESKS)) {
    list.forEach(([x, y], i) => {
      const occupied = agents.some((a) => a.zone === zone && a.desk % list.length === i);
      const on = workingByDesk.has(`${zone}:${i}`);
      const glow = colorByDesk[`${zone}:${i}`] ?? '#10B981';
      const deskColor = zone === 'direccion' ? '#5B3A29' : zone === 'datos' ? '#334155' : '#F8FAFC';
      if (!occupied && zone !== 'direccion') return; // solo escritorios en uso (+ crecen con contrataciones)
      drawables.push(box(`desk-${zone}-${i}`, x, y, 0, zone === 'direccion' ? 3 : 2.2, 1, 0.72, deskColor, { stroke: '#00000018' }));
      // Monitor: la pantalla mira al agente; su reverso brilla cuando trabaja.
      const mx = x + (zone === 'direccion' ? 1.2 : 0.7);
      const scr = [iso(mx, y + 0.35, 0.78), iso(mx + 0.9, y + 0.35, 0.78), iso(mx + 0.9, y + 0.35, 1.45), iso(mx, y + 0.35, 1.45)];
      drawables.push({
        key: `mon-${zone}-${i}`, depth: x + y + 2.1,
        node: (
          <g key={`mon-${zone}-${i}`}>
            <polygon points={pts([iso(mx + 0.4, y + 0.4, 0.72), iso(mx + 0.5, y + 0.4, 0.72), iso(mx + 0.5, y + 0.4, 0.82), iso(mx + 0.4, y + 0.4, 0.82)])} fill="#475569" />
            <polygon points={pts(scr)} fill={on ? glow : '#1E293B'} opacity={on ? 0.95 : 1} className={on ? 'mk-screen' : undefined} stroke="#0F172A" strokeWidth={1.2} />
            {on && [0.95, 1.1, 1.25].map((z, k) => (
              <line key={k} x1={iso(mx + 0.1, y + 0.35, z)[0]} y1={iso(mx + 0.1, y + 0.35, z)[1]} x2={iso(mx + 0.55 + k * 0.08, y + 0.35, z)[0]} y2={iso(mx + 0.55 + k * 0.08, y + 0.35, z)[1]}
                    stroke="#ffffffcc" strokeWidth={1.1} className="mk-code" style={{ animationDelay: `${k * 0.3}s` }} />
            ))}
            {/* Teclado y taza */}
            <polygon points={pts([iso(mx - 0.1, y + 0.75, 0.73), iso(mx + 0.9, y + 0.75, 0.73), iso(mx + 0.9, y + 0.95, 0.73), iso(mx - 0.1, y + 0.95, 0.73)])} fill="#CBD5E1" />
          </g>
        ),
      });
    });
  }

  // ── Muebles y ambiente por sala ──
  // Dirección: librero, sillones, planta, pantalla de ventas en el muro.
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
  drawables.push(box('dir-sofa', 6.2, 4.6, 0, 2.2, 1, 0.5, '#0F766E', { extra: null }));
  drawables.push(box('dir-sofa-back', 6.2, 4.6, 0.5, 2.2, 0.3, 0.45, '#115E59'));
  drawables.push(box('dir-table', 6.6, 3.5, 0, 1.4, 0.7, 0.35, '#1F2937'));
  drawables.push(plant('dir-plant', 0.6, 6.2));
  // Estrategia: mesa de juntas con sillas y pizarrón.
  drawables.push(box('str-table', 12.3, 3.6, 0, 4.4, 1.4, 0.7, '#FFFFFF', { stroke: '#CBD5E1' }));
  [12.6, 13.9, 15.2, 16.5].forEach((x, i) => {
    drawables.push(box(`str-chair-a${i}`, x, 3.1, 0, 0.5, 0.4, 0.45, '#8B5CF6'));
    drawables.push(box(`str-chair-b${i}`, x, 5.1, 0, 0.5, 0.4, 0.45, '#8B5CF6'));
  });
  drawables.push(plant('str-plant', 18.4, 6.3));
  // Datos e IA: racks de servidores y el núcleo de IA.
  [24.0, 25.1, 26.2, 27.3, 28.4].forEach((x, i) => {
    drawables.push(box(`rack-${i}`, x, 0.4, 0, 0.9, 0.9, 2.5, '#111827', {
      stroke: '#0B1220',
      extra: (
        <g>
          {Array.from({ length: 7 }).map((_, r) => {
            const [lx, ly] = iso(x + 0.15 + (r % 3) * 0.22, 1.3, 0.4 + r * 0.3);
            return <circle key={r} cx={lx} cy={ly} r={1.6} fill={r % 3 === 0 ? '#22D3EE' : r % 3 === 1 ? '#22C55E' : '#F59E0B'}
                           className="mk-led" style={{ animationDelay: `${(i * 7 + r) * 0.17}s` }} />;
          })}
        </g>
      ),
    }));
  });
  drawables.push(aiCore('ai-core', 21.7, 1.9));
  // Estudio creativo: fondo de foto, luces, cámara.
  drawables.push(box('studio-backdrop', 1.0, 16.4, 0, 3.4, 0.15, 2.4, '#F1F5F9', { stroke: '#CBD5E1' }));
  drawables.push(softbox('softbox-a', 0.8, 18.4));
  drawables.push(softbox('softbox-b', 4.4, 18.4));
  drawables.push(camera('camera', 2.6, 19.0));
  drawables.push(plant('cre-plant', 9.2, 19.2));
  // Social: muro de pantallas con el feed.
  drawables.push(socialWall('social-wall', 13.0, 17.2));
  drawables.push(box('beanbag-a', 16.8, 18.4, 0, 0.9, 0.9, 0.45, '#EC4899'));
  drawables.push(box('beanbag-b', 12.0, 18.5, 0, 0.9, 0.9, 0.45, '#6366F1'));
  // RH: mesa de entrevistas, archiveros, tablero de vacantes.
  drawables.push(box('rh-table', 23.8, 14.2, 0, 2.2, 1.2, 0.7, '#FFFFFF', { stroke: '#CBD5E1' }));
  drawables.push(box('rh-chair-a', 24.1, 13.6, 0, 0.5, 0.4, 0.45, '#64748B'));
  drawables.push(box('rh-chair-b', 25.3, 15.6, 0, 0.5, 0.4, 0.45, '#64748B'));
  drawables.push(box('rh-files', 29.0, 12.0, 0, 0.7, 2.0, 1.4, '#94A3B8'));
  drawables.push(plant('rh-plant', 29.2, 19.2));
  // Pasillo: máquina de café y recepción.
  drawables.push(box('coffee', 9.7, 7.8, 0, 0.7, 0.7, 1.3, '#78350F', { extra: null }));

  // Muros de cristal de cada sala (frentes visibles).
  for (const z of ZONES) {
    const glass = '#A5D8FF';
    if (z.x + z.w < W) drawables.push(box(`gw-e-${z.id}`, z.x + z.w - 0.08, z.y, 0, 0.08, z.d, 1.8, glass, { opacity: 0.32, stroke: '#7CB9E8' }));
    drawables.push(box(`gw-s-${z.id}-a`, z.x, z.y + z.d - 0.08, 0, z.w * 0.38, 0.08, 1.8, glass, { opacity: 0.32, stroke: '#7CB9E8' }));
    drawables.push(box(`gw-s-${z.id}-b`, z.x + z.w * 0.62, z.y + z.d - 0.08, 0, z.w * 0.38, 0.08, 1.8, glass, { opacity: 0.32, stroke: '#7CB9E8' }));
  }

  // Personajes
  for (const a of agents) {
    const [x, y] = seatOf(a);
    drawables.push({
      key: `p-${a.id}`, depth: x + y + 0.9,
      node: <Person key={`p-${a.id}`} a={a} selected={selected === a.id} bubble={bubbles[a.id]} onSelect={(id) => onSelect(id)} />,
    });
  }

  drawables.sort((p, q) => p.depth - q.depth);

  // Encuadre
  const minX = iso(0, D)[0] - 40, maxX = iso(W, 0)[0] + 40;
  const minY = iso(0, 0, 4.2)[1] - 110, maxY = iso(W, D)[1] + 30;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-auto w-full select-none" onClick={() => onSelect(null)}>
      <defs>
        <pattern id="wood" width="18" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
          <rect width="18" height="10" fill="#C9A27E" /><path d="M0,5 H18" stroke="#B88D66" strokeWidth="0.8" />
        </pattern>
        <pattern id="tech" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#1E293B" /><path d="M0,8 H16 M8,0 V16" stroke="#22D3EE22" strokeWidth="0.8" />
        </pattern>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A5F3FC" /><stop offset="60%" stopColor="#22D3EE" stopOpacity="0.6" /><stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Base del edificio */}
      <polygon points={pts([iso(-0.6, -0.6), iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(-0.6, D + 0.6)])} fill="#CBD5E1" />
      <polygon points={pts([iso(-0.6, D + 0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.5), iso(-0.6, D + 0.6, -0.5)])} fill="#94A3B8" />
      <polygon points={pts([iso(W + 0.6, -0.6), iso(W + 0.6, D + 0.6), iso(W + 0.6, D + 0.6, -0.5), iso(W + 0.6, -0.6, -0.5)])} fill="#64748B" />
      {floor('hall', 0, 0, W, D, '#D8DEE6')}
      {ZONES.map((z) => floor(`f-${z.id}`, z.x, z.y, z.w, z.d, z.floor, z.pattern))}

      {/* Muros del fondo con ventanales */}
      <polygon points={pts([iso(0, 0), iso(W, 0), iso(W, 0, 3.4), iso(0, 0, 3.4)])} fill="#E2E8F0" stroke="#CBD5E1" />
      <polygon points={pts([iso(0, 0), iso(0, D), iso(0, D, 3.4), iso(0, 0, 3.4)])} fill="#CBD5E1" stroke="#B6C2D1" />
      {[1.2, 4.6, 11.2, 14.6].map((x) => (
        <polygon key={`win-${x}`} points={pts([iso(x, 0, 1.0), iso(x + 2.6, 0, 1.0), iso(x + 2.6, 0, 2.9), iso(x, 0, 2.9)])} fill={windowColor} stroke="#94A3B8" strokeWidth={1.4} />
      ))}
      {[2, 11, 15].map((y) => (
        <polygon key={`winw-${y}`} points={pts([iso(0, y, 1.0), iso(0, y + 2.6, 1.0), iso(0, y + 2.6, 2.9), iso(0, y, 2.9)])} fill={windowColor} stroke="#94A3B8" strokeWidth={1.4} />
      ))}
      {/* Pantalla de ventas del Director en el muro */}
      <g>
        <polygon points={pts([iso(5.6, 0.05, 1.3), iso(8.6, 0.05, 1.3), iso(8.6, 0.05, 2.9), iso(5.6, 0.05, 2.9)])} fill="#0F172A" stroke="#334155" strokeWidth={2} />
        {[0.35, 0.6, 0.5, 0.85, 0.75, 1.0].map((h, i) => (
          <polygon key={i} className="mk-bar" style={{ animationDelay: `${i * 0.4}s` }}
                   points={pts([iso(5.9 + i * 0.45, 0.05, 1.45), iso(6.2 + i * 0.45, 0.05, 1.45), iso(6.2 + i * 0.45, 0.05, 1.45 + h * 1.2), iso(5.9 + i * 0.45, 0.05, 1.45 + h * 1.2)])}
                   fill={i === 5 ? '#F59E0B' : '#10B981'} />
        ))}
      </g>
      {/* Logo en el muro de estrategia */}
      <text x={iso(8.8, 0, 3.0)[0]} y={iso(8.8, 0, 3.0)[1]} fontSize={13} fontWeight={800} fill="#10B981" transform={`rotate(30 ${iso(8.8, 0, 3.0)[0]} ${iso(8.8, 0, 3.0)[1]})`}>VYLTA</text>

      {/* Nombres de las salas pintados en el piso (como señalización) */}
      {ZONES.map((z) => {
        const [lx, ly] = iso(z.x + 0.5, z.y + z.d - 0.45);
        return (
          <text key={`lbl-${z.id}`} transform={`matrix(${COS},${SIN},${-COS},${SIN},${lx},${ly})`}
                fontSize={17} fontWeight={800} letterSpacing={2}
                fill={z.id === 'datos' ? '#22D3EE' : z.id === 'direccion' ? '#7C5134' : '#94A3B8'} opacity={0.85}>
            {z.label.toUpperCase()}
          </text>
        );
      })}

      {drawables.map((d) => d.node)}

      {/* Paquetes de luz entre escritorios */}
      {packets.map((p) => {
        const mx = (p.from[0] + p.to[0]) / 2, my = Math.min(p.from[1], p.to[1]) - 70;
        const path = `M${p.from[0]},${p.from[1]} Q${mx},${my} ${p.to[0]},${p.to[1]}`;
        return (
          <g key={`pk-${p.id}`}>
            <path d={path} fill="none" stroke={p.color} strokeWidth={1.6} strokeDasharray="4 5" opacity={0.6} className="mk-dash" />
            <circle r={5} fill={p.color} stroke="#fff" strokeWidth={1.5}>
              <animateMotion dur="1.6s" fill="freeze" path={path} />
            </circle>
          </g>
        );
      })}

      <style>{`
        .mk-pulse { animation: mkPulse 1.6s ease-in-out infinite; }
        @keyframes mkPulse { 50% { opacity: .55; } }
        .mk-breathe { animation: mkBreathe 3.4s ease-in-out infinite; transform-origin: 0 0; }
        @keyframes mkBreathe { 50% { transform: translateY(-0.8px); } }
        .mk-type-body { animation: mkBob 0.9s ease-in-out infinite; }
        @keyframes mkBob { 50% { transform: translateY(0.9px); } }
        .mk-arm-l { animation: mkTypeL .28s ease-in-out infinite alternate; }
        .mk-arm-r { animation: mkTypeR .28s ease-in-out infinite alternate; animation-delay: .14s; }
        @keyframes mkTypeL { to { transform: translateY(-1.6px); } }
        @keyframes mkTypeR { to { transform: translateY(-1.6px); } }
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
        @keyframes mkPop { from { opacity: 0; transform: translateY(-70px) scale(.85); } }
        .mk-zz { animation: mkZz 2.4s ease-in-out infinite; }
        @keyframes mkZz { 50% { transform: translate(3px,-4px); opacity: .4; } }
        .mk-dash { animation: mkDash 1s linear infinite; }
        @keyframes mkDash { to { stroke-dashoffset: -18; } }
        .mk-feed { animation: mkFeed 6s linear infinite; }
        @keyframes mkFeed { from { transform: translateY(0); } to { transform: translateY(-24px); } }
        .mk-person:hover > ellipse:first-child { opacity: .45; }
      `}</style>
    </svg>
  );
}

// ── Piezas decorativas ───────────────────────────────────────────────

function plant(key: string, x: number, y: number): Drawable {
  const [px, py] = iso(x + 0.3, y + 0.3, 0.55);
  return {
    key, depth: x + y + 1.2,
    node: (
      <g key={key}>
        {box(`${key}-pot`, x, y, 0, 0.6, 0.6, 0.55, '#B45309').node}
        <g transform={`translate(${px},${py})`}>
          {[[-7, -14, '#16A34A'], [6, -16, '#22C55E'], [0, -22, '#15803D'], [-3, -9, '#4ADE80'], [5, -8, '#16A34A']].map(([dx, dy, c], i) => (
            <ellipse key={i} cx={dx as number} cy={dy as number} rx={6} ry={9} fill={c as string} transform={`rotate(${(dx as number) * 4} ${dx} ${dy})`} />
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
        {box(`${key}-base`, x - 0.7, y - 0.7, 0, 1.4, 1.4, 0.35, '#0F172A', { stroke: '#22D3EE80' }).node}
        <g transform={`translate(${cx},${cy - 40})`}>
          <circle r={30} fill="url(#core)" className="mk-core" />
          <circle r={11} fill="#ECFEFF" />
          <ellipse rx={24} ry={8} fill="none" stroke="#22D3EE" strokeWidth={1.6} className="mk-ring" />
          <ellipse rx={8} ry={24} fill="none" stroke="#A78BFA" strokeWidth={1.2} className="mk-ring" style={{ animationDuration: '9s' }} />
          <text y={44} textAnchor="middle" fontSize={8} fontWeight={800} fill="#22D3EE">IA</text>
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
        <path d="M-6,0 L0,-6 L6,0" stroke="#334155" strokeWidth={2} fill="none" />
        <rect x={-13} y={-66} width={26} height={22} rx={3} fill="#FFFBEB" stroke="#1E293B" strokeWidth={2} />
        <rect x={-10} y={-63} width={20} height={16} rx={2} fill="#FEF3C7" className="mk-screen" />
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
        <rect x={-9} y={-41} width={18} height={12} rx={2} fill="#0F172A" />
        <circle cx={-1} cy={-35} r={4} fill="#334155" stroke="#94A3B8" />
        <circle cx={6} cy={-39} r={1.4} fill="#EF4444" className="mk-led" />
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
            <rect x={0} y={-74} width={82} height={46} rx={4} fill="#0F172A" stroke="#475569" strokeWidth={2} />
            <clipPath id="feedclip"><rect x={4} y={-70} width={74} height={38} rx={2} /></clipPath>
            <g clipPath="url(#feedclip)">
              <g className="mk-feed">
                {Array.from({ length: 6 }).map((_, i) => (
                  <g key={i} transform={`translate(6,${-68 + i * 12})`}>
                    <rect width={8} height={8} rx={2} fill={i % 2 ? '#E1306C' : '#1877F2'} />
                    <rect x={11} y={1} width={40 + (i % 3) * 8} height={2.4} rx={1.2} fill="#CBD5E1" />
                    <rect x={11} y={5} width={24 + (i % 2) * 14} height={2} rx={1} fill="#64748B" />
                    <text x={62} y={7} fontSize={6} fill="#F43F5E">♥</text>
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
