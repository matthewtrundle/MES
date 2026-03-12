'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Globe, Plus, Trash2, Pencil, Eye, EyeOff, History } from 'lucide-react';
import { deleteWebhookSubscription, updateWebhookSubscription } from '@/lib/actions/webhooks';
import { CreateWebhookDialog } from './CreateWebhookDialog';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';

interface Subscription {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    deliveries: number;
  };
}

interface WebhookManagerProps {
  subscriptions: Subscription[];
}

export function WebhookManager({ subscriptions: initialSubscriptions }: WebhookManagerProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [isPending, startTransition] = useTransition();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingDeliveriesId, setViewingDeliveriesId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  function handleToggleActive(id: string, currentActive: boolean) {
    startTransition(async () => {
      try {
        await updateWebhookSubscription(id, { active: !currentActive });
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, active: !currentActive } : s))
        );
      } catch {
        // Silently fail
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this webhook subscription? This cannot be undone.')) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteWebhookSubscription(id);
        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // Silently fail
      }
    });
  }

  function toggleSecretVisibility(id: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleCreated() {
    // Trigger page reload to get fresh data
    window.location.reload();
  }

  function maskSecret(secret: string): string {
    if (secret.length <= 8) return '****';
    return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
  }

  if (viewingDeliveriesId) {
    const subscription = subscriptions.find((s) => s.id === viewingDeliveriesId);
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => setViewingDeliveriesId(null)}>
            Back to Subscriptions
          </Button>
          <h3 className="text-sm font-medium text-slate-700">
            Deliveries for: {subscription?.name ?? 'Unknown'}
          </h3>
        </div>
        <WebhookDeliveryLog subscriptionId={viewingDeliveriesId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Subscription
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No webhook subscriptions configured</p>
          <p className="text-xs mt-1">Create a subscription to send event data to external systems</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deliveries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="font-medium">{subscription.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px] inline-block">
                      {subscription.url}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {subscription.events.slice(0, 3).map((event) => (
                        <Badge key={event} variant="secondary" className="text-[10px]">
                          {event}
                        </Badge>
                      ))}
                      {subscription.events.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{subscription.events.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono">
                        {revealedSecrets.has(subscription.id)
                          ? subscription.secret
                          : maskSecret(subscription.secret)}
                      </code>
                      <button
                        onClick={() => toggleSecretVisibility(subscription.id)}
                        className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        {revealedSecrets.has(subscription.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(subscription.id, subscription.active)}
                      disabled={isPending}
                    >
                      <Badge
                        variant={subscription.active ? 'default' : 'secondary'}
                        className={subscription.active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'hover:bg-slate-200'}
                      >
                        {subscription.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setViewingDeliveriesId(subscription.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <History className="h-3 w-3" />
                      {subscription._count.deliveries}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(subscription.id)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateWebhookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
