import { requireUser } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { NotificationList } from '@/components/admin/NotificationList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-slate-500 mt-1">
          {unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up!'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            {totalCount} notification{totalCount !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationList notifications={notifications} />
        </CardContent>
      </Card>
    </div>
  );
}
