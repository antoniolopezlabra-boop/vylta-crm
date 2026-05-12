# VYLTA CRM

Aplicación web ejecutiva tipo CRM para los suscriptores de VYLTA.

## 🎯 Propósito

Espejo funcional de la app móvil VYLTA, pero diseñado para escritorio:
- Sidebar ejecutivo lateral
- Tablas densas y dashboards expandidos
- Atajos de teclado
- Vista calendario semanal/mensual
- Dashboards inspirados en Stripe / Linear

## 🏗️ Stack técnico

- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS 3.4
- **Componentes**: shadcn/ui
- **Base de datos**: Supabase (compartida con app móvil)
- **Auth**: Supabase Auth (mismo login que móvil)
- **Gráficas**: Recharts
- **Iconos**: lucide-react
- **Formularios**: react-hook-form + zod
- **Tema**: next-themes (light/dark)

## 🚀 Desarrollo local

```bash
npm install
cp .env.local.example .env.local
# Llenar variables de entorno
npm run dev
```

Abre http://localhost:3000

## 🌐 Producción

Hosteado en Vercel: https://app.vylta.lat

## 📦 Arquitectura

```
┌─────────────────────────────────────────┐
│ Móvil (Expo)  │  Web (Next.js — este)   │
└──────┬────────┴────────┬────────────────┘
       │                 │
       └────────┬────────┘
                ▼
       ┌──────────────────┐
       │ Supabase (común) │
       │ - Auth           │
       │ - DB             │
       │ - Edge Functions │
       └──────────────────┘
```

La lógica de negocio vive en Supabase Edge Functions (compartidas con móvil).
Esta web solo es UI nueva consumiendo esas funciones.

## 🎨 Identidad visual

- Verde primario: `#10B981`
- Tipografía: Inter
- Modo claro y oscuro soportados

## 📄 Licencia

Propietario VYLTA. Todos los derechos reservados.
