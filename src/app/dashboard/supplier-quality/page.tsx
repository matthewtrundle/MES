import { SupplierScorecard } from '@/components/supervisor/SupplierScorecard';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default function SupplierQualityPage() {
  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Supplier Quality" subtitle="Scorecard, acceptance rates, and supplier performance trends">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SupplierScorecard />
      </main>
    </div>
  );
}
