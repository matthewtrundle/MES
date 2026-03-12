'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createWebhookSubscription } from '@/lib/actions/webhooks';
import { webhookEventTypes } from '@/lib/validation/webhook-schemas';

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const eventTypeLabels: Record<string, string> = {
  work_order_released: 'Work Order Released',
  work_order_completed: 'Work Order Completed',
  work_order_shipped: 'Work Order Shipped',
  unit_created: 'Unit Created',
  operation_completed: 'Operation Completed',
  quality_check_recorded: 'Quality Check Recorded',
  ncr_created: 'NCR Created',
  ncr_dispositioned: 'NCR Dispositioned',
  ncr_closed: 'NCR Closed',
  eol_test_passed: 'EOL Test Passed',
  eol_test_failed: 'EOL Test Failed',
  shipment_created: 'Shipment Created',
  shipment_shipped: 'Shipment Shipped',
  material_lot_received: 'Material Lot Received',
  inventory_transaction_recorded: 'Inventory Transaction',
  iqc_inspection_completed: 'IQC Inspection Completed',
  iqc_disposition_recorded: 'IQC Disposition Recorded',
};

export function CreateWebhookDialog({ open, onOpenChange, onCreated }: CreateWebhookDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName('');
    setUrl('');
    setSecret('');
    setSelectedEvents([]);
    setError(null);
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  function selectAll() {
    setSelectedEvents([...webhookEventTypes]);
  }

  function selectNone() {
    setSelectedEvents([]);
  }

  function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('At least one event type must be selected');
      return;
    }

    startTransition(async () => {
      try {
        await createWebhookSubscription({
          name: name.trim(),
          url: url.trim(),
          secret: secret.trim() || undefined,
          events: selectedEvents as (typeof webhookEventTypes)[number][],
          active: true,
        });
        resetForm();
        onOpenChange(false);
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create webhook');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook Subscription</DialogTitle>
          <DialogDescription>
            Configure a new outbound webhook to send event data to an external URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              placeholder="e.g., ERP Integration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">
              Secret <span className="text-slate-400 font-normal">(optional, auto-generated if blank)</span>
            </Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="Min 16 characters"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Event Types</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select all
                </button>
                <span className="text-xs text-slate-300">|</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="border border-slate-200 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {webhookEventTypes.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
                >
                  <Checkbox
                    checked={selectedEvents.includes(event)}
                    onCheckedChange={() => toggleEvent(event)}
                  />
                  <span className="text-sm text-slate-700">
                    {eventTypeLabels[event] || event}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {selectedEvents.length} event type{selectedEvents.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            resetForm();
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
