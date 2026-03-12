import { getReceivingHistory } from '@/lib/actions/receiving';
import { ReceivingWorkflow } from '@/components/admin/ReceivingWorkflow';
import { ReceivingHistory } from '@/components/admin/ReceivingHistory';

export default async function ReceivingPage() {
  const history = await getReceivingHistory(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receiving</h1>
        <p className="text-sm text-slate-500 mt-1">
          Receive materials against purchase orders with automated IQC routing
        </p>
      </div>
      <ReceivingWorkflow />
      <ReceivingHistory records={history} />
    </div>
  );
}
