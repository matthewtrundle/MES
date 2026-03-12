import { listWebhookSubscriptions } from '@/lib/actions/webhooks';
import { WebhookManager } from '@/components/admin/WebhookManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function WebhooksPage() {
  const subscriptions = await listWebhookSubscriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
        <p className="text-slate-500 mt-1">
          Configure outbound webhook subscriptions to integrate with external systems
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Subscriptions</CardTitle>
          <CardDescription>
            {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookManager subscriptions={subscriptions} />
        </CardContent>
      </Card>
    </div>
  );
}
