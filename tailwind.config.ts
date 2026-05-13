import type { Config } from 'tailwindcss';

// ══════════════════════════════════════════════════════════════════════
// VYLTA CRM — Tailwind config oficial (Brand Kit v1.0 · Mayo 2026)
//
// Paleta EXACTA según brand-guidelines.html:
//   • Negro VYLTA  #0A0E1A → background principal
//   • Surface     #0F1424 → cards
//   • Card         #161B2E → cards elevados / popovers
//   • Verde VYLTA  #10B981 → acento principal
//   • Verde claro  #3ECF8E → hover, highlights
//   • Verde WA     #25D366 → SOLO íconos WhatsApp
//   • Morado Luxury#A78BFA → SOLO Plan Luxury (¡no usar indigo!)
//   • Blanco hueso #F1F5F9 → texto principal
//   • Texto muted  #94A3B8 → subtítulos
//   • Texto sutil  #64748B → labels
//
// Dark mode permanente — la marca VYLTA es dark-first.
// ══════════════════════════════════════════════════════════════════════

const config: Config = {
  // Activar dark de forma global (el ThemeProvider fuerza la clase)
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1600px' },
    },
    extend: {
      fontFamily: {
        // Inter es la fuente oficial según brand guidelines
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // SF Mono / monoespaciada para hex codes, IDs, números técnicos
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        // Inter se beneficia de tracking ligeramente negativo en displays
        tightest: '-0.04em',
        tighter:  '-0.02em',
      },
      colors: {
        // ── Tokens semánticos (siguen las CSS vars de globals.css) ──
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── PALETA OFICIAL VYLTA (hex exactos del brand kit) ──
        vylta: {
          // Base
          black:    '#0A0E1A',  // Background principal
          surface:  '#0F1424',  // Cards
          card:     '#161B2E',  // Cards elevados
          bone:     '#F1F5F9',  // Texto principal (blanco hueso)
          // Texto
          muted:    '#94A3B8',  // Subtítulos
          subtle:   '#64748B',  // Labels
          // Borde
          border:   '#1F2937',
          // Verdes — el acento principal de la marca
          green: {
            DEFAULT: '#10B981',
            light:   '#3ECF8E',  // hover / highlights
            // Escala completa para casos específicos (KPIs, charts)
            50:  '#ECFDF5',
            100: '#D1FAE5',
            200: '#A7F3D0',
            300: '#6EE7B7',
            400: '#34D399',
            500: '#10B981',
            600: '#059669',
            700: '#047857',
            800: '#065F46',
            900: '#064E3B',
          },
          // Verde WhatsApp — uso restringido
          whatsapp: '#25D366',
          // Morado Luxury — uso restringido al plan Luxury
          luxury: {
            DEFAULT: '#A78BFA',
            light:   '#C4B5FD',
            dark:    '#8B5CF6',
          },
          // Acentos secundarios (KPIs, charts, status — uso esporádico)
          amber:    '#F59E0B',  // alertas / por cobrar
          rose:     '#F43F5E',  // negativos / urgente (sobrio sobre dark)
          sky:      '#0EA5E9',  // info
        },
      },
      borderRadius: {
        lg:  'var(--radius)',
        md:  'calc(var(--radius) - 2px)',
        sm:  'calc(var(--radius) - 4px)',
        xl:  'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      boxShadow: {
        // Sombras hechas para dark mode — más oscuras y dramáticas
        'card-sm':  '0 1px 2px hsl(0 0% 0% / 0.3)',
        'card':     '0 4px 12px -2px hsl(0 0% 0% / 0.4), 0 1px 0 hsl(0 0% 100% / 0.04) inset',
        'card-lg':  '0 16px 40px -12px hsl(0 0% 0% / 0.5), 0 1px 0 hsl(0 0% 100% / 0.05) inset',
        // CTA con glow verde
        'cta':      '0 0 0 1px hsl(160 84% 39% / 0.3), 0 8px 24px hsl(160 84% 39% / 0.25), 0 1px 0 hsl(0 0% 100% / 0.1) inset',
        // Card luxury con glow morado sutil
        'luxury':   '0 0 0 1px hsl(258 90% 76% / 0.3), 0 8px 24px hsl(258 90% 76% / 0.15)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':       { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'slide-down':     { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'scale-in':       { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        'glow-pulse':     {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(160 84% 39% / 0.5)' },
          '50%':       { boxShadow: '0 0 0 8px hsl(160 84% 39% / 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.4s ease-out',
        'slide-up':       'slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-down':     'slide-down 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in':       'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'glow-pulse':     'glow-pulse 2s ease-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
