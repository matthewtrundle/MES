import { getReceivingHistory, getReceivingDiscrepancySummary } from '@/lib/actions/receiving';
import { ReceivingWorkflow } from '@/components/admin/ReceivingWorkflow';
import { ReceivingHistory } from '@/components/admin/ReceivingHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function ReceivingPage() {
  const [history, discrepancySummary] = await Promise.all([
    getReceivingHistory(30),
    getReceivingDiscrepancySummary(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Receiving</h1>
        <p className="text-sm text-sm text-slate-500 mt-0.5">
          Receive materials against purchase orders with automated IQC routing
        </p>
      </div>

      {discrepancySummary.withDiscrepancies > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Receiving Discrepancies Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-amber-200 px-4 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total POs Received</p>
                <p className="text-xl font-semibold text-slate-900">{discrepancySummary.totalPOs}</p>
              </div>
              <div className="bg-white rounded-lg border border-amber-200 px-4 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">With Discrepancies</p>
                <p className="text-lg font-bold text-amber-700">{discrepancySummary.withDiscrepancies}</p>
              </div>
              <div className="bg-white rounded-lg border border-red-200 px-4 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Over-Shipped Lines</p>
                <p className="text-lg font-bold text-red-600">{discrepancySummary.overShipped}</p>
              </div>
              <div className="bg-white rounded-lg border border-yellow-200 px-4 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Short-Shipped Lines</p>
                <p className="text-lg font-bold text-yellow-600">{discrepancySummary.shortShipped}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Affected Purchase Orders</h4>
              {discrepancySummary.details.map((po) => (
                <Link
                  key={po.poId}
                  href={`/admin/purchase-orders/${po.poId}`}
                  className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-4 py-3 hover:bg-amber-50 transition-colors"
                >
                  <div>
                    <span className="font-mono font-medium text-slate-900">{po.poNumber}</span>
                    <span className="text-sm text-slate-500 ml-3">{po.supplierName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                      {po.discrepancyCount} discrepanc{po.discrepancyCount === 1 ? 'y' : 'ies'}
                    </Badge>
                    <span className="text-sm text-slate-400">{po.lineCount} line items</span>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ReceivingWorkflow />
      <ReceivingHistory records={history} />
    </div>
  );
}
