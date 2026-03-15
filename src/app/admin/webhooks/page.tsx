import { listWebhookSubscriptions } from '@/lib/actions/webhooks';
import { WebhookManager } from '@/components/admin/WebhookManager';

export default async function WebhooksPage() {
  const subscriptions = await listWebhookSubscriptions();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <WebhookManager subscriptions={subscriptions} />
      </div>
    </div>
  );
}
