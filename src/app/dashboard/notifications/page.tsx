import { requireUser } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { NotificationList } from '@/components/admin/NotificationList';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 30;

export default async function NotificationsPage() {
  const user = await requireUser();

  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
    prisma.notification.count({
      where: { userId: user.id },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">All Notifications</h3>
            <p className="text-sm text-slate-500">{totalCount} notification{totalCount !== 1 ? 's' : ''} total</p>
          </div>
          <div className="p-4">
            <NotificationList notifications={notifications} />
          </div>
        </div>
      </main>
    </div>
  );
}
