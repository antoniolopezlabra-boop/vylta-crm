import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lógica de middleware para mantener la sesión de Supabase fresca.
 *
 * Se ejecuta en CADA request antes de llegar a la página. Refresca el token
 * si está por expirar, redirige a /login si la ruta requiere auth y no hay
 * sesión, y redirige a /dashboard si el usuario ya está logueado y va a
 * /login o /register.
 *
 * ⚡ ACTUALIZACIÓN (May 19 2026): se agregaron /register y /forgot-password
 * como rutas de auth (antes solo /login y /signup). Sin esto, usuarios
 * autenticados podrían entrar a /register al recargar la página y eso
 * rompería el flujo.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // CRÍTICO: getUser() valida el JWT y refresca el token si es necesario.
  // No quitar esta línea ni cambiarla por getSession() — getSession lee
  // localStorage que es fácilmente falsificable.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rutas de autenticación: el usuario LOGUEADO no debe verlas (lo mandamos
  // al dashboard si trata de entrar). Pero el usuario SIN sesión sí puede.
  const isAuthRoute = pathname.startsWith('/login')
                   || pathname.startsWith('/register')
                   || pathname.startsWith('/signup')
                   || pathname.startsWith('/forgot-password');

  const isPublicRoute = pathname === '/'
                     || pathname.startsWith('/_next')
                     || pathname.startsWith('/api/auth');

  // No autenticado tratando de entrar a ruta protegida → /login
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Autenticado tratando de entrar a /login o /register → /dashboard
  // (excepto /forgot-password: incluso usuarios logueados deben poder usarla
  // por si están cambiando su contraseña desde la sesión actual.)
  if (user && isAuthRoute && !pathname.startsWith('/forgot-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
