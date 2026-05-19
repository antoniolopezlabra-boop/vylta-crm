'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VyltaLogo } from '@/components/layout/vylta-logo';

// ══════════════════════════════════════════════════════════════════════
// Register dark premium — espejo de LoginForm.
//
// Filosofía de UX (alineada con la app móvil — May 2026):
//   • Solo 3 campos: nombre, email, contraseña → registro en 30 seg
//   • La info del negocio (nombre, tipo, horarios, etc.) se captura
//     después en el wizard de /setup. NO pedirla aquí.
//   • Esto reduce fricción en el momento más crítico (registro)
//     y es el patrón estándar de SaaS modernos (Slack, Notion, Calendly).
//
// Después del registro exitoso → redirigir a /setup donde el usuario
// completa la configuración inicial guiada.
// ══════════════════════════════════════════════════════════════════════

export function RegisterForm() {
  const router = useRouter();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  function validate(): string | null {
    if (!name.trim()) return 'Ingresa tu nombre';
    if (name.trim().length < 2) return 'El nombre es muy corto';
    if (!email.trim()) return 'Ingresa tu correo electrónico';
    if (!email.includes('@') || !email.includes('.')) return 'Correo electrónico inválido';
    if (!password) return 'Crea una contraseña';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // ────────────────────────────────────────────────────────────────
    // Crear cuenta vía Supabase Auth.
    //
    // user_metadata.full_name se guarda en auth.users — la app móvil
    // y el CRM lo leen desde useAuth() para mostrar "Hola {nombre}".
    // ────────────────────────────────────────────────────────────────
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        // No mandar email de confirmación: la sesión queda activa
        // inmediatamente para que el usuario continúe al wizard.
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard`
          : undefined,
      },
    });

    if (signUpError) {
      setLoading(false);
      const msg = signUpError.message.toLowerCase();
      const friendly =
        msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')
          ? 'Ya existe una cuenta con este correo. ¿Intentas iniciar sesión?'
          : msg.includes('password')
          ? 'La contraseña no cumple los requisitos. Usa al menos 6 caracteres.'
          : msg.includes('invalid') && msg.includes('email')
          ? 'El correo electrónico no es válido'
          : 'No pudimos crear tu cuenta. Intenta de nuevo.';
      toast.error(friendly);
      return;
    }

    // ────────────────────────────────────────────────────────────────
    // Verificar si Supabase pide confirmación de email.
    // En configuración default de Supabase, si "Confirm email" está ON,
    // signUp devuelve user pero session=null. Mostramos mensaje.
    // En nuestra configuración actual está OFF para login inmediato.
    // ────────────────────────────────────────────────────────────────
    if (data?.user && !data.session) {
      setLoading(false);
      toast.success(
        'Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
        { duration: 6000 },
      );
      router.push('/login');
      return;
    }

    toast.success('¡Cuenta creada! Vamos a configurar tu negocio.');
    // El refresh es importante para que el middleware vea la nueva sesión
    // antes de la siguiente navegación.
    router.refresh();
    router.push('/setup');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-vylta-black">
      {/* ── Background decorativo ── */}
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
                Crear cuenta
              </h1>
              <p className="mt-1 text-sm text-vylta-muted">
                Empecemos con lo básico. Configuras tu negocio en el siguiente paso.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre */}
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
                    autoCapitalize="words"
                    required
                    disabled={loading}
                    maxLength={60}
                    className="h-11 pl-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-vylta-muted">
                  Correo electrónico
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
                    autoCapitalize="none"
                    required
                    disabled={loading}
                    className="h-11 pl-10 bg-vylta-card border-border text-vylta-bone placeholder:text-vylta-subtle focus:border-vylta-green/50 focus:ring-2 focus:ring-vylta-green/15"
                  />
                </div>
              </div>

              {/* Password */}
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

              {/* CTA */}
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

              {/* Disclaimer */}
              <p className="text-[11px] text-vylta-subtle text-center leading-relaxed pt-1">
                Al crear tu cuenta aceptas nuestros{' '}
                <a
                  href="https://vylta.lat/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vylta-green hover:text-vylta-green-light transition-colors font-medium"
                >
                  Términos
                </a>{' '}
                y{' '}
                <a
                  href="https://vylta.lat/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vylta-green hover:text-vylta-green-light transition-colors font-medium"
                >
                  Aviso de Privacidad
                </a>
                .
              </p>
            </form>

            {/* Link a login */}
            <div className="mt-5 pt-5 border-t border-border text-center text-sm text-vylta-muted">
              ¿Ya tienes cuenta?{' '}
              <Link
                href="/login"
                className="font-semibold text-vylta-green hover:text-vylta-green-light transition-colors"
              >
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
