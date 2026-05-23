'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════
// ThemeToggle — Botón compacto para cambiar entre modo claro y oscuro.
//
// UBICACIÓN: integrado en el topbar del CRM Web, entre el ícono de
// notificaciones y el avatar del usuario.
//
// PRINCIPIOS DE DISEÑO:
//   • Tamaño y estilo idéntico al botón de notificaciones (Bell) para
//     mantener consistencia visual en el header.
//   • Iconos Sun/Moon con animación suave al cambiar (escala + rotación).
//   • Tooltip via atributo title nativo (simple y accesible).
//   • Hydration-safe: muestra placeholder hasta que el tema esté listo
//     para evitar mismatch SSR/CSR.
//
// PERSISTENCIA:
// next-themes guarda la preferencia automáticamente en localStorage con
// la key 'theme'. La proxima vez que el usuario entre, recordamos su
// elección sin importar el modo del sistema.
// ══════════════════════════════════════════════════════════════════════

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evitar mismatch de hydration: el server renderiza dark por default,
  // pero el cliente puede tener light en localStorage. Esperamos a que
  // el componente esté montado para mostrar el ícono correcto.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder durante hydration — mismo tamaño y estilo que el final
  // para evitar layout shift.
  if (!mounted) {
    return (
      <button
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-vylta-muted"
        aria-label="Cambiar tema"
        disabled
      >
        <Sun className="h-[18px] w-[18px] opacity-0" />
      </button>
    );
  }

  const isDark = (resolvedTheme || theme) === 'dark';

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-vylta-muted transition hover:bg-vylta-card hover:text-vylta-bone dark:hover:bg-vylta-card"
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {/* Wrapper con animación: el ícono activo escala y rota suavemente.
          Los dos íconos están superpuestos; el opacity controla cuál se ve. */}
      <div className="relative h-[18px] w-[18px]">
        <Sun
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-300 ${
            isDark
              ? 'opacity-0 rotate-90 scale-50'
              : 'opacity-100 rotate-0 scale-100'
          }`}
          strokeWidth={2}
        />
        <Moon
          className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-300 ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-50'
          }`}
          strokeWidth={2}
        />
      </div>
    </button>
  );
}
