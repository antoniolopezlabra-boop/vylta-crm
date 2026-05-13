'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// QueryProvider — wrapper de React Query para todo el CRM
//
// Configuración optimizada para Supabase:
//   • staleTime 30s: datos considerados frescos por 30s sin re-fetch
//   • gcTime 5min: cache permanece 5min después de no usarse
//   • refetchOnWindowFocus: refresca silenciosamente al volver al tab
//   • refetchOnReconnect: refresca si vuelve la conexión a internet
//   • retry 1: si una query falla, reintenta 1 vez (no spammea)
//
// El cliente se crea con useState para garantizar 1 sola instancia por
// usuario (no se recrea en cada render).
//
// DevTools: solo visibles en desarrollo. En producción no aparecen.
// ══════════════════════════════════════════════════════════════════════

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,        // 30s frescos
            gcTime: 5 * 60 * 1000,        // 5min en cache
            refetchOnWindowFocus: true,   // re-fetch al volver al tab
            refetchOnReconnect: true,     // re-fetch al recuperar conexión
            retry: 1,                     // 1 reintento si falla
            // No mostrar loading state si solo estamos refetching en background
            // (los datos viejos se siguen viendo mientras llegan los nuevos)
            refetchOnMount: 'always',
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
