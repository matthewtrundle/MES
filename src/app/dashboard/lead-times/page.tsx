import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { LeadTimeDashboard } from '@/components/supervisor/LeadTimeDashboard';
import {
  getLeadTimeAnalytics,
  getLeadTimeByPart,
  getLeadTimeTrend,
} from '@/lib/actions/lead-time-analytics';

export const revalidate = 60;

export default async function LeadTimesPage() {
  const [supplierData, partData, trendData] = await Promise.all([
    getLeadTimeAnalytics(),
    getLeadTimeByPart(),
    getLeadTimeTrend(6),
  ]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Supplier Lead Times" subtitle="Track and analyze supplier delivery performance">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <LeadTimeDashboard
          supplierData={supplierData}
          partData={partData}
          trendData={trendData}
        />
      </main>
    </div>
  );
}
