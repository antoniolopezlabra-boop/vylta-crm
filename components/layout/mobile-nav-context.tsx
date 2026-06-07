'use client';

import { createContext, useContext, useState, useCallback } from 'react';

// ══════════════════════════════════════════════════════════════════════
// MobileNavContext — estado del menú lateral en móvil (cajón / drawer)
//
// El layout autenticado (app/(app)/layout.tsx) es un Server Component que
// hace auth + fetch, así que no puede tener useState. Este provider de
// cliente comparte el estado abierto/cerrado del cajón entre el Topbar
// (botón hamburguesa) y el Sidebar (el cajón en sí) sin dependencias
// extra.
//
// En escritorio (lg+) el sidebar es estático y este estado es irrelevante.
// ══════════════════════════════════════════════════════════════════════

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    // Fallback seguro si algún componente lo usa fuera del provider.
    return { open: false, setOpen: () => {}, toggle: () => {} };
  }
  return ctx;
}
