import type { Config } from 'tailwindcss';

// ══════════════════════════════════════════════════════════════════════
// VYLTA CRM — Tailwind config con sistema de diseño ejecutivo
//
// Paleta basada en la identidad VYLTA:
//   • Verde primario #10B981 (acción, marca, éxito)
//   • Grises slate para neutrales
//   • Modo oscuro tipo "professional dark" (Linear / Vercel style)
// ══════════════════════════════════════════════════════════════════════

const config: Config = {
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
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:   'hsl(var(--primary))',
          foreground:'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:   'hsl(var(--secondary))',
          foreground:'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:   'hsl(var(--destructive))',
          foreground:'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:   'hsl(var(--muted))',
          foreground:'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:   'hsl(var(--accent))',
          foreground:'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:   'hsl(var(--popover))',
          foreground:'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:   'hsl(var(--card))',
          foreground:'hsl(var(--card-foreground))',
        },
        // ── Paleta semántica VYLTA ──
        vylta: {
          green: { 50:'#ECFDF5', 100:'#D1FAE5', 200:'#A7F3D0', 300:'#6EE7B7', 400:'#34D399', 500:'#10B981', 600:'#059669', 700:'#047857', 800:'#065F46', 900:'#064E3B' },
          amber: { 500:'#F59E0B', 700:'#B45309' },
          rose:  { 500:'#F43F5E' },
          indigo:{ 500:'#6366F1' },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':       { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.3s ease-out',
        'slide-up':       'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
