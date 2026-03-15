import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { InventoryReports } from '@/components/supervisor/InventoryReports';
import { getStockVsReorder } from '@/lib/actions/inventory-reports';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default async function InventoryReportsPage() {
  const initialStockData = await getStockVsReorder();

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Inventory Reports" subtitle="Stock levels, valuation, turnover, and expiry">
        <AutoRefresh intervalSeconds={120} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <InventoryReports initialStockData={initialStockData} />
      </main>
    </div>
  );
}
