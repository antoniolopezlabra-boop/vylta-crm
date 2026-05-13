# VYLTA CRM Web

CRM dashboard para dueños de negocio en VYLTA. Built with Next.js 15, Supabase, TanStack Query y Tailwind.

## Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **DB / Auth**: Supabase (project `nhjmwmkaduiaifgztymi`, São Paulo)
- **Data layer**: TanStack Query + Realtime
- **Pagos**: Stripe (live mode)
- **UI**: shadcn/ui + Tailwind v4
- **Hosting**: Vercel

## Desarrollo local

```bash
# 1. Variables de entorno
cp .env.example .env.local
# Edita .env.local con tus keys

# 2. Instalar dependencias
npm install

# 3. Correr en dev
npm run dev
# Abre http://localhost:3000
```

## Deploy a Vercel

### Primera vez
1. Crea proyecto en https://vercel.com/new
2. Conecta el repo `antoniolopezlabra-boop/vylta-crm`
3. Framework preset: **Next.js** (auto-detectado)
4. Build command: `npm run build` (default)
5. Output directory: `.next` (default)
6. En **Environment Variables**, pega TODAS las del `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_APP_URL` = `https://app.vylta.lat`
7. Click **Deploy**

### Dominio custom (app.vylta.lat)
1. En Vercel → Project → Settings → Domains → Add `app.vylta.lat`
2. Vercel te dará un CNAME (algo como `cname.vercel-dns.com`)
3. En Cloudflare → vylta.lat → DNS → Add Record:
   - Type: `CNAME`
   - Name: `app`
   - Target: `cname.vercel-dns.com`
   - Proxy: **DNS only** (gris, no naranja) — Vercel maneja SSL
4. Espera 1-5 min y Vercel verifica automáticamente

### Deploys posteriores
Cada push a `main` autodespliega. Las preview branches también generan URLs temporales.

## Variables críticas de Supabase
Asegúrate de que en Supabase → Authentication → URL Configuration:
- **Site URL**: `https://app.vylta.lat`
- **Redirect URLs**: incluye `https://app.vylta.lat/**`

Sin esto, los magic links y resets de contraseña apuntarín a localhost.

## Stripe webhook en producción
Si aún no está configurado, el webhook de Stripe va en:
```
https://app.vylta.lat/api/stripe/webhook
```
(o donde sea que esté tu route handler). Asegúrate de actualizar el endpoint en Stripe Dashboard.
