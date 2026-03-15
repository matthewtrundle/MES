import { prisma } from '@/lib/db/prisma';

export async function WorkOrderBar() {
  const currentWorkOrder = await prisma.workOrder.findFirst({
    where: { status: { in: ['released', 'in_progress'] } },
    orderBy: { createdAt: 'desc' },
  });

  if (!currentWorkOrder) return null;

  const progress = Math.round(
    (currentWorkOrder.qtyCompleted / currentWorkOrder.qtyOrdered) * 100
  );

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Active WO
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {currentWorkOrder.orderNumber}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-sm text-slate-600">
              {currentWorkOrder.productCode}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm">
              <span className="font-semibold text-slate-900">
                {currentWorkOrder.qtyCompleted}
              </span>
              <span className="text-slate-400">
                {' '}
                / {currentWorkOrder.qtyOrdered}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {progress}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
