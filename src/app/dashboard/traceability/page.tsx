import { prisma } from '@/lib/db/prisma';
import { TraceabilitySearch } from '@/components/supervisor/TraceabilitySearch';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default async function TraceabilityPage() {
  const [recentUnits, activeLots, partsWithUnits] = await Promise.all([
    prisma.unit.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, serialNumber: true, status: true, workOrder: { select: { orderNumber: true } } },
    }),
    prisma.materialLot.findMany({
      where: { qtyRemaining: { gt: 0 } },
      take: 10,
      orderBy: { receivedAt: 'desc' },
      select: { id: true, lotNumber: true, materialCode: true, qtyRemaining: true },
    }),
    prisma.workOrder.findMany({
      where: { status: { in: ['released', 'in_progress'] } },
      select: { id: true, productCode: true, productName: true, orderNumber: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Traceability Search" subtitle="Search by serial number or lot number to view complete history" />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TraceabilitySearch
          recentUnits={recentUnits}
          activeLots={activeLots}
          partsWithUnits={partsWithUnits}
        />
      </main>
    </div>
  );
}
