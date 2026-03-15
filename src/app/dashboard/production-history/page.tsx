import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { ProductionHistoryBrowser } from '@/components/supervisor/ProductionHistoryBrowser';
import { searchProductionHistory, getProductionSummary } from '@/lib/actions/production-history';
import { prisma } from '@/lib/db/prisma';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default async function ProductionHistoryPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [initialData, initialSummary, stations] = await Promise.all([
    searchProductionHistory({ page: 1, pageSize: 20, sortBy: 'date', sortDir: 'desc' }),
    getProductionSummary(thirtyDaysAgo, now),
    prisma.station.findMany({
      select: { id: true, name: true },
      orderBy: { sequenceOrder: 'asc' },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Production History" subtitle="Browse and search production records">
        <AutoRefresh intervalSeconds={120} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ProductionHistoryBrowser
          initialData={initialData}
          initialSummary={initialSummary}
          stations={stations}
        />
      </main>
    </div>
  );
}
