import { redirect } from 'next/navigation';
import { getAdminUserServer } from '@/lib/admin-server';
import { QueryProvider } from '@/components/providers/query-provider';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';

// ═════════════════════════════════════════════════════════════════════
// Layout admin — "Control Center"
//
// Separado del layout (app) normal porque:
//   - Usa branding dorado/gold (diferenciación visual crítica)
//   - Sidebar diferente (con secciones admin)
//   - Si entras aquí sin ser admin, te saca de inmediato
//
// Como el layout (app) también redirige admins a /admin, el flujo es:
//   - Admin loggeado → va a /dashboard → layout (app) redirect a /admin
//   - Admin loggeado entra directo a /admin → este layout lo deja pasar
//   - User normal entra a /admin → este layout lo manda a /dashboard
// ═════════════════════════════════════════════════════════════════════

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await getAdminUserServer();

  if (!adminUser) {
    // No es admin. Si está autenticado, mandar al CRM normal.
    // Si no está autenticado, redirect a login.
    redirect('/dashboard');
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-vylta-admin-bg">
        <AdminSidebar role={adminUser.role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar adminName={adminUser.name || 'Admin'} role={adminUser.role} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
