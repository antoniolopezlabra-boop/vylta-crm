'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, ArrowLeft, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VyltaLogo } from '@/components/layout/vylta-logo';

// ═════════════════════════════════════════════════════════════════════
// Register dark premium — espejo del LoginForm con identidad oficial.
//
// FLUJO DE ONBOARDING (May 2026 — paridad con app móvil):
//   1. Aquí: solo 3 campos mínimos (nombre, email, password) → ~30 seg
//   2. Setup wizard (4 pasos): negocio, servicios, horarios, link
//
// POR QUÉ NO PEDIR MÁS AQUÍ:
//   - Pedir nombre/tipo de negocio aquí Y en el wizard es redundante
//   - Reducir fricción en el momento más crítico (registro)
//   - El wizard tiene mejor contexto visual (iconos, progress, anim)
//   - Patrón estándar de SaaS modernos (Slack, Notion, Calendly)
// ═════════════════════════════════════════════════════════════════════

export function RegisterForm() {
  const router = useRouter();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  function validateBeforeSubmit(): string | null {
    if (!name.trim() || !email.trim() || !password) {
      return 'Por favor completa todos los campos';
    }
    if (password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (!email.includes('@') || !email.includes('.')) {
      return 'Ingresa un correo electrónico válido';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      setLoading(false);
      const lower = error.message.toLowerCase();
      let msg = 'No pudimos crear tu cuenta. Intenta de nuevo.';
      if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
        msg = 'Ya existe una cuenta con este correo electrónico';
      } else if (lower.includes('password')) {
        msg = 'La contraseña no cumple los requisitos mínimos';
      } else if (lower.includes('email')) {
        msg = 'El correo electrónico no es válido';
      }
      toast.error(msg);
      return;
    }

    if (!data?.session) {
      // Supabase Auth está configurado en este proyecto sin verificación
      // de email (los usuarios pueden entrar directo). Si en algún momento
      // se activa la verificación, este branch capturará ese caso.
      setLoading(false);
      toast.success('Cuenta creada. Revisa tu correo para confirmar.');
      router.push('/login');
      return;
    }

    toast.success('¡Bienvenido a VYLTA!');
    router.push('/setup');
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-vylta-black">
      {/* ── Background decorativo (idéntico al login) ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-vylta-green/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-vylta-luxury/12 blur-[100px]" />
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
          <div className="mb-8 flex flex-col items-center animate-fade-in">
            <VyltaLogo size={56} />
            <h2 className="mt-4 text-2xl font-bold tracking-tightest text-vylta-bone">
              VYLTA
            </h2>
            <p className="mt-1 text-xs italic text-vylta-green">
              Cada cliente regresa.
            </p>
          </div>

          {/* Card del formulario */}
          <div className="animate-slide-up rounded-2xl border border-border bg-vylta-surface/80 p-7 shadow-card-lg backdrop-blur-xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight text-vylta-bone">
                Crea tu cuenta
              </h1>
              <p className="mt-1 text-sm text-vylta-muted">
                Empecemos con lo básico. Configurarás tu negocio en el siguiente paso.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-vylta-muted">
                  Tu nombre
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ej. María López"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    disabled={loading}
                    maxLength={60}
                    className="h-11 pl-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>
              </div>

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
                <Label htmlFor="password" className="text-xs font-semibold text-vylta-muted">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vylta-subtle" />
                  <Input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs leading-relaxed text-vylta-subtle">
                Al continuar aceptas nuestros{' '}
                <a href="https://vylta.lat/terminos" target="_blank" rel="noopener noreferrer" className="font-semibold text-vylta-green hover:text-vylta-green-light">
                  Términos
                </a>{' '}
                y{' '}
                <a href="https://vylta.lat/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-vylta-green hover:text-vylta-green-light">
                  Aviso de Privacidad
                </a>.
              </p>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center text-sm text-vylta-muted">
              ¿Ya tienes cuenta?{' '}
              <Link
                href="/login"
                className="font-semibold text-vylta-green hover:text-vylta-green-light transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Inicia sesión
              </Link>
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
