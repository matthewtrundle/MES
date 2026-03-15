import { NCRAnalyticsDashboard } from '@/components/supervisor/NCRAnalyticsDashboard';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 60;

export default function NCRAnalyticsPage() {
  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="NCR Analytics" subtitle="Non-conformance aging, severity, and trend analysis">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <NCRAnalyticsDashboard />
      </main>
    </div>
  );
}
