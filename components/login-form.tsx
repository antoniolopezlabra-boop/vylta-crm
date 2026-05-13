'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VyltaLogo } from '@/components/layout/vylta-logo';

// ══════════════════════════════════════════════════════════════════════
// Login dark premium — espejo de vylta.lat con identidad oficial.
//
// Composición:
//   • Background con grid sutil + halo verde + halo morado luxury
//   • Logo grande con tagline "Cada cliente regresa" tipo splash
//   • Card flotante con borde sutil y glow verde discreto
//   • Inputs dark con iconos
//   • Footer con shield trust signal
// ══════════════════════════════════════════════════════════════════════

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/dashboard';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      const msg = error.message.toLowerCase().includes('invalid')
        ? 'Email o contraseña incorrectos'
        : error.message.toLowerCase().includes('email not confirmed')
        ? 'Necesitas confirmar tu email primero'
        : 'No pudimos iniciar sesión. Intenta de nuevo.';
      toast.error(msg);
      return;
    }

    toast.success('¡Bienvenido de vuelta!');
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-vylta-black">
      {/* ── Background decorativo ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Halo verde principal arriba-izquierda */}
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-vylta-green/20 blur-[120px]" />
        {/* Halo morado luxury abajo-derecha */}
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-vylta-luxury/12 blur-[100px]" />
        {/* Grid sutil con mask radial */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#1F2937_1px,transparent_1px),linear-gradient(to_bottom,#1F2937_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"
          style={{
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)',
          }}
        />
      </div>

      {/* ── Contenido ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo + tagline */}
          <div className="mb-10 flex flex-col items-center animate-fade-in">
            <VyltaLogo size={64} />
            <h2 className="mt-5 text-3xl font-bold tracking-tightest text-vylta-bone">
              VYLTA
            </h2>
            <p className="mt-1 text-sm italic text-vylta-green">
              Cada cliente regresa.
            </p>
          </div>

          {/* Card del formulario */}
          <div className="animate-slide-up rounded-2xl border border-border bg-vylta-surface/80 p-7 shadow-card-lg backdrop-blur-xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight text-vylta-bone">
                Bienvenido de vuelta
              </h1>
              <p className="mt-1 text-sm text-vylta-muted">
                Inicia sesión para administrar tu negocio
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-vylta-muted">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="h-11 pl-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-vylta-muted">
                    Contraseña
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-vylta-green hover:text-vylta-green-light transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
                  <Input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="h-11 pl-10 pr-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-vylta-subtle transition hover:text-vylta-bone"
                    tabIndex={-1}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full h-11 mt-2 glow-primary bg-vylta-green hover:bg-vylta-green-light text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center text-sm text-vylta-muted">
              ¿No tienes cuenta aún?{' '}
              <a
                href="https://vylta.lat"
                className="font-semibold text-vylta-green hover:text-vylta-green-light transition-colors"
              >
                Créala en vylta.lat
              </a>
            </div>
          </div>

          {/* Footer con trust signal */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-vylta-subtle">
            <Shield className="h-3 w-3" />
            <span>Conexión segura · Hecho en México 🇲🇽</span>
          </div>
        </div>
      </div>
    </div>
  );
}
