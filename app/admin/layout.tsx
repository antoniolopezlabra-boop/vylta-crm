import { redirect } from 'next/navigation';
import { getAdminUserServer } from '@/lib/admin-server';
import { QueryProvider } from '@/components/providers/query-provider';
import { AdminTabs } from '@/components/admin/admin-tabs';

// ═════════════════════════════════════════════════════════════════════
// Layout admin — Control Center (REDISEÑO May 22 2026)
//
// ⚡ CAMBIO MAYOR: sidebar lateral reemplazado por top tabs.
// Razón: Antonio reportó que el sidebar quitaba demasiado espacio
// horizontal y era subutilizado (solo 4 items). Tabs arriba liberan
// ~250px de ancho útil para gráficas, mapas y tablas.
// ═════════════════════════════════════════════════════════════════════

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await getAdminUserServer();

  if (!adminUser) {
    redirect('/dashboard');
  }

  return (
    <QueryProvider>
      <div className="flex min-h-screen flex-col bg-vylta-admin-bg">
        <AdminTabs role={adminUser.role} adminName={adminUser.name || 'Admin'} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1800px] p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </QueryProvider>
  );
}
