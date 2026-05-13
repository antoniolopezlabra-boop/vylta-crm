import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// VyltaLogo — logo oficial de la marca en SVG inline.
//
// Reproduce la "V" geométrica del lockup oficial: superficie #0F1424
// (surface oscuro) con border verde #10B981 + V blanca recortada.
// Usable a cualquier tamaño sin perder definición.
//
// Variantes:
//   <VyltaLogo size={36} />              → solo icono
//   <VyltaLogo size={36} withWordmark /> → icono + "VYLTA" al lado
//   <VyltaLogo size={64} withTagline /> → stacked con tagline
// ══════════════════════════════════════════════════════════════════════

interface VyltaLogoProps {
  size?: number;
  withWordmark?: boolean;
  withTagline?: boolean;
  className?: string;
  /** When true, renders a flat "on-light" version (rare). Default = on-dark. */
  inverted?: boolean;
}

export function VyltaLogo({
  size = 32,
  withWordmark = false,
  withTagline = false,
  className,
  inverted = false,
}: VyltaLogoProps) {
  const surfaceFill = inverted ? '#F1F5F9' : '#0F1424';
  const accentStroke = '#10B981';
  const vFill = inverted ? '#0A0E1A' : '#F1F5F9';

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Superficie del icono con borde verde VYLTA */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill={surfaceFill}
        stroke={accentStroke}
        strokeWidth="2.5"
      />
      {/* V geométrica centrada — dos diagonales que convergen */}
      <path
        d="M16 18 L32 46 L48 18"
        stroke={vFill}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (withTagline) {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        {icon}
        <div className="text-center">
          <div
            className="font-bold tracking-tight text-vylta-bone"
            style={{ fontSize: size * 0.5, letterSpacing: '0.02em' }}
          >
            VYLTA
          </div>
          <div
            className="italic text-vylta-green"
            style={{ fontSize: size * 0.2, marginTop: 2 }}
          >
            Cada cliente regresa.
          </div>
        </div>
      </div>
    );
  }

  if (withWordmark) {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        {icon}
        <span
          className="font-bold tracking-tight text-vylta-bone"
          style={{ fontSize: size * 0.5, letterSpacing: '0.04em' }}
        >
          VYLTA
        </span>
      </div>
    );
  }

  return <span className={className}>{icon}</span>;
}
