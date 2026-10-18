'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

// Si algo de la oficina falla al dibujarse, se muestra esto en lugar de la
// pantalla en blanco de Next, y se puede recargar sin salir del panel.
export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[marketing]', error); }, [error]);
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-base font-semibold text-slate-800">La oficina tuvo un problema al actualizarse.</p>
      <p className="max-w-md text-sm text-slate-500">Tu información está a salvo; solo hace falta volver a cargar la vista.</p>
      <button onClick={() => { reset(); window.location.reload(); }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        <RotateCcw className="h-4 w-4" />Recargar
      </button>
    </div>
  );
}
