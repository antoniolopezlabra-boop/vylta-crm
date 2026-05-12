import { Construction, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ══════════════════════════════════════════════════════════════════════
// Componente reutilizable para páginas pendientes ('coming soon')
//
// Usado por /marketing, /equipo, /chat-ia y /reportes (más detallado).
// Mantiene la navegación del sidebar funcionando aunque las features
// no estén construidas aún.
// ══════════════════════════════════════════════════════════════════════

interface ComingSoonProps {
  title: string;
  description: string;
  features?: string[];
  planRequired?: 'Premium' | 'Luxury';
}

export function ComingSoon({ title, description, features, planRequired }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-vylta-green-500/20 to-vylta-green-700/20">
          <Construction className="h-7 w-7 text-vylta-green-600 dark:text-vylta-green-400" />
        </div>

        {planRequired && (
          <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full bg-vylta-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-vylta-amber-700 dark:text-amber-400">
            <Sparkles className="h-3 w-3" />
            Plan {planRequired}
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{description}</p>

        {features && features.length > 0 && (
          <ul className="mx-auto mt-6 inline-flex flex-col gap-2 text-left text-sm">
            {features.map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-vylta-green-500" />
                {feat}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 inline-flex items-center gap-2 rounded-lg border border-vylta-green-500/30 bg-vylta-green-500/5 px-4 py-2.5 text-sm">
          <Sparkles className="h-4 w-4 text-vylta-green-600 dark:text-vylta-green-400" />
          <span className="font-semibold">Próximamente disponible</span>
        </div>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Volver al inicio
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
