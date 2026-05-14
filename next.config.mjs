/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimización de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nhjmwmkaduiaifgztymi.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'vylta.lat',
      },
    ],
  },

  // Strict mode de React
  reactStrictMode: true,

  // ESLint: no bloquear el build de producción por warnings/errors del linter.
  // La calidad del código se valida en local con `npm run lint` y en pre-commit hooks,
  // no en el deploy. Esto evita que reglas cosméticas (como no-unescaped-entities)
  // bloqueen lanzamientos legítimos.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript: tampoco bloquear el build por errores de TS.
  // La validación real corre con `npm run type-check` localmente.
  // En CI/CD futuro se puede activar esto si se desea estricto.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Headers de seguridad básicos
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
