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
    <div className="min-h-screen bg-slate-50">
      <AdminHeader user={user} />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
