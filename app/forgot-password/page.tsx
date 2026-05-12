'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Sparkles, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ══════════════════════════════════════════════════════════════════════
// Página de recuperación de contraseña
//
// Flujo:
//   1. Usuario mete su email
//   2. Supabase manda email con link de reset (configurado vía Resend)
//   3. El link los lleva a book.vylta.lat/reset.html (página de reset
//      compartida con la app móvil)
//   4. Mostramos pantalla de "revisa tu correo"
//
// IMPORTANTE: usamos la misma URL de reset que la app móvil para que
// los emails de Resend funcionen para ambas plataformas.
// ══════════════════════════════════════════════════════════════════════

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || sent) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Misma URL que usa la app móvil para reset
      redirectTo: 'https://book.vylta.lat/reset.html',
    });

    if (error) {
      setLoading(false);
      toast.error('No pudimos enviar el correo. Intenta de nuevo.');
      return;
    }

    setSent(true);
    setLoading(false);
    toast.success('Correo enviado');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-vylta-green-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-vylta-green-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/login" className="mb-8 flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vylta-green-500 text-white shadow-lg shadow-vylta-green-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">VYLTA</span>
          </Link>

          {/* Card */}
          <div className="animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
            {!sent ? (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Recuperar contraseña
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Te enviaremos un correo con instrucciones para restablecerla.
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

                  <Button type="submit" disabled={loading} size="lg" className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar correo de recuperación'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            ) : (
              <>
                {/* Estado: correo enviado */}
                <div className="text-center">
                  <div className="mb-6 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-vylta-green-500/10">
                      <CheckCircle2 className="h-8 w-8 text-vylta-green-600 dark:text-vylta-green-400" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Revisa tu correo
                  </h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Si <span className="font-semibold text-foreground">{email}</span> está
                    registrado en VYLTA, recibirás un correo con instrucciones para
                    restablecer tu contraseña.
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Revisa también tu carpeta de spam. El correo viene de{' '}
                    <span className="font-mono">noreply@vylta.lat</span>.
                  </p>

                  <Link
                    href="/login"
                    className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} VYLTA — Hecho en México 🇲🇽
          </p>
        </div>
      </div>
    </div>
  );
}
