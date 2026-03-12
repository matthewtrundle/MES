'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { markAsRead, markAllAsRead, deleteNotification } from '@/lib/actions/notifications';
import { Button } from '@/components/ui/button';
import {
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationListProps {
  notifications: Notification[];
}

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const categoryLabels: Record<string, string> = {
  system: 'System',
  quality: 'Quality',
  production: 'Production',
  shipping: 'Shipping',
  inventory: 'Inventory',
};

const categoryColors: Record<string, string> = {
  system: 'bg-slate-100 text-slate-700',
  quality: 'bg-purple-100 text-purple-700',
  production: 'bg-blue-100 text-blue-700',
  shipping: 'bg-green-100 text-green-700',
  inventory: 'bg-amber-100 text-amber-700',
};

function getEntityLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case 'ncr': return '/dashboard/ncr';
    case 'work_order': return '/admin/work-orders';
    case 'unit': return '/dashboard/traceability';
    case 'material_lot': return '/dashboard/inventory';
    default: return null;
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function NotificationList({ notifications: initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (filterRead === 'unread' && n.read) return false;
    if (filterRead === 'read' && !n.read) return false;
    return true;
  });

  function handleMarkAsRead(id: string) {
    startTransition(async () => {
      try {
        await markAsRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date() } : n))
        );
      } catch {
        // Silently fail
      }
    });
  }

  function handleMarkAllAsRead() {
    startTransition(async () => {
      try {
        await markAllAsRead();
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
        );
      } catch {
        // Silently fail
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } catch {
        // Silently fail
      }
    });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Filters and actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="all">All Types</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="success">Success</option>
          </select>

          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        <div className="ml-auto">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all as read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No notifications match your filters</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {filteredNotifications.map((notification) => {
            const link = getEntityLink(notification.entityType, notification.entityId);

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors',
                  !notification.read && 'bg-blue-50/40'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {typeIcons[notification.type] || typeIcons.info}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        notification.read ? 'text-slate-600' : 'text-slate-900 font-medium'
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          categoryColors[notification.category] || categoryColors.system
                        )}>
                          {categoryLabels[notification.category] || notification.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(notification.createdAt)}
                        </span>
                        {link && (
                          <Link
                            href={link}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View details
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={isPending}
                          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        disabled={isPending}
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
