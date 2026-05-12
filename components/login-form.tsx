'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ══════════════════════════════════════════════════════════════════════
// Formulario de login client-side. Maneja Supabase Auth con email/password.
// El middleware se encarga del redirect post-login a /dashboard.
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
      // Mensajes amigables traducidos al español
      const msg = error.message.toLowerCase().includes('invalid')
        ? 'Email o contraseña incorrectos'
        : error.message.toLowerCase().includes('email not confirmed')
        ? 'Necesitas confirmar tu email primero'
        : 'No pudimos iniciar sesión. Intenta de nuevo.';
      toast.error(msg);
      return;
    }

    toast.success('¡Bienvenido de vuelta!');
    // router.refresh() invalida el cache del Server y permite que el middleware redirija
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decoración de fondo: gradientes radiales y grid sutil */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-vylta-green-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-vylta-green-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo y marca */}
          <Link href="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vylta-green-500 text-white shadow-lg shadow-vylta-green-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">VYLTA</span>
          </Link>

          {/* Card del formulario */}
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">Bienvenido de vuelta</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Inicia sesión para acceder a tu CRM
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-vylta-green-600 hover:underline dark:text-vylta-green-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} size="lg" className="w-full">
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

            <div className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta aún?{' '}
              <a href="https://vylta.lat" className="font-semibold text-vylta-green-600 hover:underline dark:text-vylta-green-400">
                Crea una en vylta.lat
              </a>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} VYLTA — Hecho en México 🇲🇽
          </p>
        </div>
      </div>
    </div>
  );
}
