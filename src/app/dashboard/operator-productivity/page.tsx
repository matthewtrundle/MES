import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { OperatorProductivity } from '@/components/supervisor/OperatorProductivity';
import { getOperatorProductivity } from '@/lib/actions/operator-analytics';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default async function OperatorProductivityPage() {
  const initialData = await getOperatorProductivity(30);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Operator Productivity" subtitle="Performance analytics by operator">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <OperatorProductivity initialData={initialData} />
      </main>
    </div>
  );
}
