'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Loader2, Lock, Palette, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// Diseño del formulario de reservas — SOLO Luxury (nov 2026)
//
// Guarda business_profiles.booking_theme. La vista pública solo lo entrega
// si el negocio es Luxury vigente (business_is_luxury), así que si baja de
// plan su página vuelve al diseño VYLTA sin perder lo configurado.
// book.html valida todo (colores #RRGGBB, lista blanca de fuentes).
// "Ver en mi página" abre el link real con ?tema=… (vista previa sin guardar).
// ══════════════════════════════════════════════════════════════════════

export interface BookingTheme {
  primary?: string;
  font?: string;
  titleFont?: string;
  background?: 'claro' | 'blanco' | 'crema' | 'tinte';
  corners?: 'redondo' | 'suave' | 'recto';
  header?: 'clasico' | 'color';
  welcome?: string;
}

const DEFAULT_THEME: Required<BookingTheme> = {
  primary: '#10B981',
  font: '',
  titleFont: '',
  background: 'claro',
  corners: 'redondo',
  header: 'clasico',
  welcome: '',
};

const PALETTES = [
  { name: 'VYLTA', hex: '#10B981' },
  { name: 'Rosa', hex: '#E91E78' },
  { name: 'Rosa pastel', hex: '#F472B6' },
  { name: 'Lila', hex: '#8B5CF6' },
  { name: 'Morado', hex: '#6D28D9' },
  { name: 'Vino', hex: '#9F1239' },
  { name: 'Coral', hex: '#F97316' },
  { name: 'Dorado', hex: '#B8860B' },
  { name: 'Turquesa', hex: '#0D9488' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Marino', hex: '#1E3A8A' },
  { name: 'Negro', hex: '#111827' },
];

// Debe coincidir con THEME_FONTS de book.html (vylta-planes).
const FONTS: { name: string; css: string; google: string; titleOnly?: boolean }[] = [
  { name: 'Poppins', css: "'Poppins', sans-serif", google: 'Poppins:wght@400;600;700;800' },
  { name: 'Montserrat', css: "'Montserrat', sans-serif", google: 'Montserrat:wght@400;600;700;800' },
  { name: 'Nunito', css: "'Nunito', sans-serif", google: 'Nunito:wght@400;600;700;800' },
  { name: 'Quicksand', css: "'Quicksand', sans-serif", google: 'Quicksand:wght@400;600;700' },
  { name: 'Raleway', css: "'Raleway', sans-serif", google: 'Raleway:wght@400;600;700;800' },
  { name: 'Lato', css: "'Lato', sans-serif", google: 'Lato:wght@400;700;900' },
  { name: 'DM Sans', css: "'DM Sans', sans-serif", google: 'DM+Sans:wght@400;500;700' },
  { name: 'Playfair Display', css: "'Playfair Display', serif", google: 'Playfair+Display:wght@500;700;800' },
  { name: 'Lora', css: "'Lora', serif", google: 'Lora:wght@400;600;700' },
  { name: 'Cormorant Garamond', css: "'Cormorant Garamond', serif", google: 'Cormorant+Garamond:wght@500;600;700' },
  { name: 'Dancing Script', css: "'Dancing Script', cursive", google: 'Dancing+Script:wght@500;700', titleOnly: true },
];
const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ── Paleta derivada (misma lógica que applyTheme en book.html) ─────────
function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(c: number[]) { return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function mix(a: string, b: string, t: number) { const x = hexRgb(a), y = hexRgb(b); return rgbHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t)); }
function lum(h: string) {
  const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function palette(hex: string) {
  const L = lum(hex);
  return {
    vp: hex,
    ink: L > 0.5 ? '#1F2937' : '#FFFFFF',
    text: L > 0.35 ? mix(hex, '#000000', Math.min(0.55, (L - 0.2) * 1.1)) : hex,
    dark: mix(hex, '#000000', 0.5),
    v50: mix(hex, '#FFFFFF', 0.92),
  };
}
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
const fontCss = (name: string) => FONTS.find(f => f.name === name)?.css || SYSTEM_FONT;

function encodeTheme(t: BookingTheme) {
  const json = JSON.stringify(t);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function DesignTab({
  userId,
  isLuxury,
  slug,
  onGoToPlan,
}: {
  userId: string;
  isLuxury: boolean;
  slug: string | null;
  onGoToPlan?: () => void;
}) {
  const [theme, setTheme] = useState<Required<BookingTheme>>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bizName, setBizName] = useState('Tu negocio');
  const [customHex, setCustomHex] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('business_profiles')
        .select('business_name, booking_theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.business_name) setBizName(data.business_name);
      const t = (data?.booking_theme || {}) as BookingTheme;
      setTheme({ ...DEFAULT_THEME, ...t, primary: t.primary && isHex(t.primary) ? t.primary : DEFAULT_THEME.primary } as Required<BookingTheme>);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Carga las fuentes elegidas para la vista previa.
  useEffect(() => {
    const fams = [theme.font, theme.titleFont]
      .map(n => FONTS.find(f => f.name === n)?.google)
      .filter(Boolean) as string[];
    if (!fams.length) return;
    const href = `https://fonts.googleapis.com/css2?${Array.from(new Set(fams)).map(f => `family=${f}`).join('&')}&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }, [theme.font, theme.titleFont]);

  const set = <K extends keyof BookingTheme>(k: K, v: Required<BookingTheme>[K]) => setTheme(prev => ({ ...prev, [k]: v }));
  const pal = useMemo(() => palette(theme.primary), [theme.primary]);

  function toSave(t: Required<BookingTheme>): BookingTheme {
    const out: BookingTheme = { primary: t.primary, background: t.background, corners: t.corners, header: t.header };
    if (t.font) out.font = t.font;
    if (t.titleFont) out.titleFont = t.titleFont;
    if (t.welcome.trim()) out.welcome = t.welcome.trim().slice(0, 240);
    return out;
  }

  async function save(reset = false) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('business_profiles')
        .update({ booking_theme: reset ? null : toSave(theme), updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      if (reset) setTheme(DEFAULT_THEME);
      toast.success(reset ? 'Volviste al diseño VYLTA' : 'Diseño guardado: ya se ve en tu link de reservas');
    } catch (err) {
      console.error('[design] save error:', err);
      toast.error('No pudimos guardar el diseño');
    } finally {
      setSaving(false);
    }
  }

  if (!isLuxury) {
    return (
      <div className="rounded-2xl border border-vylta-luxury/30 bg-vylta-luxury/5 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-vylta-luxury/15">
          <Lock className="h-5 w-5 text-vylta-luxury" />
        </div>
        <h3 className="text-base font-bold text-vylta-bone">Personaliza tu formulario con el Plan Luxury</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-vylta-muted">
          Cambia el color, el tipo de letra, el fondo y agrega un mensaje de bienvenida para que tu
          página de reservas se vea 100% de tu negocio.
        </p>
        <Button size="sm" className="mt-4" onClick={onGoToPlan}>
          Ver Plan Luxury
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-vylta-green" /></div>;
  }

  const radius = theme.corners === 'recto' ? 2 : theme.corners === 'suave' ? 8 : 14;
  const bg = theme.background === 'blanco' ? '#FFFFFF' : theme.background === 'crema' ? '#FBF7F1'
    : theme.background === 'tinte' ? mix(theme.primary, '#FFFFFF', 0.95) : '#F8FAFC';
  const bodyFont = fontCss(theme.font);
  const titleFont = theme.titleFont ? fontCss(theme.titleFont) : bodyFont;
  const colorHeader = theme.header === 'color';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Controles ── */}
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-vylta-bone">
            <Palette className="h-5 w-5 text-vylta-luxury" /> Diseño de tu formulario
          </h2>
          <p className="text-sm text-vylta-muted">Así se verá tu página de reservas para tus clientes.</p>
        </div>

        <Block title="Color principal">
          <div className="flex flex-wrap gap-2">
            {PALETTES.map(p => (
              <button
                key={p.hex}
                type="button"
                title={p.name}
                onClick={() => set('primary', p.hex)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-vylta-surface transition',
                  theme.primary.toLowerCase() === p.hex.toLowerCase() ? 'ring-2 ring-vylta-bone' : 'hover:scale-105',
                )}
                style={{ backgroundColor: p.hex }}
              >
                {theme.primary.toLowerCase() === p.hex.toLowerCase() && <Check className="h-4 w-4" style={{ color: palette(p.hex).ink }} />}
              </button>
            ))}
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold text-vylta-muted hover:text-vylta-bone">
              <input
                type="color"
                value={theme.primary}
                onChange={(e) => set('primary', e.target.value.toUpperCase())}
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Otro color
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={customHex || theme.primary}
              onChange={(e) => {
                const v = e.target.value.trim();
                setCustomHex(v);
                if (isHex(v)) set('primary', v.toUpperCase());
              }}
              onBlur={() => setCustomHex('')}
              maxLength={7}
              className="h-8 w-28 rounded-md border border-border bg-vylta-card/60 px-2 font-mono text-xs text-vylta-bone outline-none"
              aria-label="Código de color"
            />
            <span className="text-[11px] text-vylta-muted">Código de color (ej. #E91E78)</span>
          </div>
        </Block>

        <Block title="Fondo de la página">
          <Choices
            value={theme.background}
            onChange={(v) => set('background', v as any)}
            options={[
              { value: 'claro', label: 'Gris claro' },
              { value: 'blanco', label: 'Blanco' },
              { value: 'crema', label: 'Crema' },
              { value: 'tinte', label: 'Tono de tu color' },
            ]}
          />
        </Block>

        <div className="grid gap-6 sm:grid-cols-2">
          <Block title="Letra de los textos">
            <FontSelect value={theme.font} onChange={(v) => set('font', v)} allowTitleOnly={false} />
          </Block>
          <Block title="Letra de los títulos">
            <FontSelect value={theme.titleFont} onChange={(v) => set('titleFont', v)} allowTitleOnly placeholder="Igual que los textos" />
          </Block>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Block title="Esquinas">
            <Choices
              value={theme.corners}
              onChange={(v) => set('corners', v as any)}
              options={[
                { value: 'redondo', label: 'Redondas' },
                { value: 'suave', label: 'Suaves' },
                { value: 'recto', label: 'Rectas' },
              ]}
            />
          </Block>
          <Block title="Encabezado">
            <Choices
              value={theme.header}
              onChange={(v) => set('header', v as any)}
              options={[
                { value: 'clasico', label: 'Blanco' },
                { value: 'color', label: 'Con tu color' },
              ]}
            />
          </Block>
        </div>

        <Block title="Mensaje de bienvenida (opcional)">
          <Textarea
            value={theme.welcome}
            onChange={(e) => set('welcome', e.target.value.slice(0, 240))}
            placeholder="Ej.: ¡Bienvenida! Reserva tu momento de belleza ✨"
            rows={2}
          />
          <div className="mt-1 text-right text-[11px] text-vylta-muted">{theme.welcome.length}/240</div>
        </Block>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar diseño'}
          </Button>
          {slug && (
            <Button
              variant="outline"
              onClick={() => window.open(`https://book.vylta.lat/${slug}?tema=${encodeTheme(toSave(theme))}`, '_blank', 'noopener')}
            >
              <ExternalLink className="h-4 w-4" /> Ver en mi página
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => { if (window.confirm('¿Volver al diseño original de VYLTA?')) save(true); }}
          >
            <RotateCcw className="h-4 w-4" /> Restablecer
          </Button>
        </div>
        {slug && (
          <p className="text-[11px] text-vylta-muted">
            &ldquo;Ver en mi página&rdquo; muestra tus cambios sin guardarlos. Tus clientes solo ven el diseño guardado.
          </p>
        )}
      </div>

      {/* ── Vista previa ── */}
      <div className="xl:sticky xl:top-2 xl:self-start">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-vylta-muted">Vista previa</div>
        <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-zinc-800 shadow-2xl">
          <div className="space-y-3 p-3" style={{ background: bg, fontFamily: bodyFont, color: '#0F172A' }}>
            <div
              className="p-4 text-center"
              style={{
                borderRadius: radius + 4,
                background: colorHeader ? `linear-gradient(150deg, ${pal.vp}, ${pal.dark})` : '#FFFFFF',
                border: colorHeader ? 'none' : '1px solid #F1F5F9',
              }}
            >
              <div
                className="mx-auto mb-2 flex h-12 w-12 items-center justify-center text-lg font-extrabold"
                style={{ borderRadius: theme.corners === 'recto' ? 2 : 14, background: pal.vp, color: pal.ink, boxShadow: colorHeader ? '0 0 0 3px rgba(255,255,255,.7)' : undefined }}
              >
                {bizName.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-lg font-extrabold leading-tight" style={{ fontFamily: titleFont, color: colorHeader ? pal.ink : '#0F172A' }}>{bizName}</div>
              <div
                className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: colorHeader ? 'rgba(255,255,255,.92)' : pal.v50, color: pal.text }}
              >
                ● Acepta citas en línea
              </div>
              {theme.welcome.trim() && (
                <p className="mt-2 text-[11px] leading-snug" style={{ color: colorHeader ? pal.ink : '#475569', opacity: colorHeader ? 0.9 : 1 }}>
                  {theme.welcome.trim()}
                </p>
              )}
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500" style={{ fontFamily: titleFont }}>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]" style={{ background: pal.vp, color: pal.ink }}>1</span>
              Elige tu servicio
            </div>
            <div className="overflow-hidden bg-white" style={{ borderRadius: radius }}>
              {[['Pestañas', '21 servicios', false], ['Manos', '18 servicios', true], ['Pies', '7 servicios', false]].map(([n, c, sel]) => (
                <div key={n as string} className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-0" style={{ background: sel ? pal.v50 : undefined }}>
                  <div>
                    <div className="text-[13px] font-bold" style={{ fontFamily: titleFont }}>{n}</div>
                    <div className="text-[10px] text-slate-400">{c}</div>
                  </div>
                  {sel ? <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: pal.vp, color: pal.ink }}>1 ✓</span> : <span className="text-slate-400">›</span>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {['10:00', '10:30', '11:00', '11:30'].map((t, i) => (
                <div
                  key={t}
                  className="py-1.5 text-center text-[11px] font-semibold"
                  style={{
                    borderRadius: theme.corners === 'recto' ? 2 : 8,
                    border: `1.5px solid ${i === 1 ? pal.vp : '#E2E8F0'}`,
                    background: i === 1 ? pal.vp : '#FFFFFF',
                    color: i === 1 ? pal.ink : '#0F172A',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>

            <div className="flex justify-between bg-slate-900 px-3 py-2.5 text-[11px] text-white" style={{ borderRadius: radius }}>
              <span className="text-slate-400">Total</span>
              <span className="font-extrabold" style={{ color: lum(pal.vp) < 0.08 ? '#FFFFFF' : pal.vp }}>$450 MXN</span>
            </div>
            <div className="py-3 text-center text-sm font-bold" style={{ borderRadius: radius, background: pal.vp, color: pal.ink }}>
              Confirmar cita →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-vylta-muted">{title}</div>
      {children}
    </div>
  );
}

function Choices({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'rounded-lg border px-3 py-2 text-sm font-semibold transition',
            value === o.value
              ? 'border-vylta-green/60 bg-vylta-green/10 text-vylta-bone'
              : 'border-border text-vylta-muted hover:bg-vylta-card hover:text-vylta-bone',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FontSelect({ value, onChange, allowTitleOnly, placeholder = 'Predeterminada' }: {
  value: string; onChange: (v: string) => void; allowTitleOnly: boolean; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-border bg-vylta-card/60 px-3 text-sm text-vylta-bone outline-none focus:ring-2 focus:ring-vylta-green/20"
      style={{ fontFamily: value ? fontCss(value) : undefined }}
    >
      <option value="">{placeholder}</option>
      {FONTS.filter(f => allowTitleOnly || !f.titleOnly).map(f => (
        <option key={f.name} value={f.name} style={{ fontFamily: f.css }}>{f.name}</option>
      ))}
    </select>
  );
}
