import { requireRole } from '@/lib/auth/rbac';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side role check (middleware also checks, but this is a safety net)
  const user = await requireRole(['admin']);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <AdminHeader user={user} />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0 p-4 lg:p-6 lg:px-8">
          <div className="max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
