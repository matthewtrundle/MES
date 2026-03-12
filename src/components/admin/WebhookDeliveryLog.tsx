'use client';

import { useState, useEffect, useTransition } from 'react';
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
import { RefreshCw, RotateCcw } from 'lucide-react';
import { getWebhookDeliveries, retryWebhookDelivery } from '@/lib/actions/webhooks';

interface Delivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: unknown;
  statusCode: number | null;
  responseBody: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  deliveredAt: Date | null;
  status: string;
  createdAt: Date;
}

interface WebhookDeliveryLogProps {
  subscriptionId: string;
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function WebhookDeliveryLog({ subscriptionId }: WebhookDeliveryLogProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadDeliveries() {
    setLoading(true);
    try {
      const result = await getWebhookDeliveries(subscriptionId, { limit: 50 });
      setDeliveries(result.deliveries);
      setTotal(result.total);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, [subscriptionId]);

  function handleRetry(deliveryId: string) {
    startTransition(async () => {
      try {
        await retryWebhookDelivery(deliveryId);
        // Reload deliveries after retry
        await loadDeliveries();
      } catch {
        // Silently fail
      }
    });
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Loading deliveries...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {total} delivery{total !== 1 ? ' records' : ' record'}
        </p>
        <Button variant="outline" size="sm" onClick={loadDeliveries}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No deliveries recorded yet
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP Code</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <>
                  <TableRow
                    key={delivery.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() =>
                      setExpandedId(expandedId === delivery.id ? null : delivery.id)
                    }
                  >
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        {delivery.eventType}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[delivery.status] || ''}
                      >
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {delivery.statusCode ?? '-'}
                    </TableCell>
                    <TableCell>{delivery.attempts}/3</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(delivery.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(delivery.deliveredAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {delivery.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(delivery.id);
                          }}
                          disabled={isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === delivery.id && (
                    <TableRow key={`${delivery.id}-details`}>
                      <TableCell colSpan={7} className="bg-slate-50">
                        <div className="space-y-2 py-2">
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Payload</p>
                            <pre className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-32 font-mono">
                              {JSON.stringify(delivery.payload, null, 2)}
                            </pre>
                          </div>
                          {delivery.responseBody && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Response</p>
                              <pre className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-32 font-mono">
                                {delivery.responseBody}
                              </pre>
                            </div>
                          )}
                          {delivery.lastAttemptAt && (
                            <p className="text-xs text-slate-400">
                              Last attempt: {formatDate(delivery.lastAttemptAt)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
