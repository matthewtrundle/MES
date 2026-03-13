import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <Icons.chevronLeft className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Icons.clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Supplier Lead Times</h1>
                  <p className="text-sm text-gray-500">Track and analyze supplier delivery performance</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={60} />
          </div>
        </div>
      </header>

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
