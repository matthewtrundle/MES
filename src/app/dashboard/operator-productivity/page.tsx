import Link from 'next/link';
import { Icons } from '@/components/icons';
import { DashboardTabs } from '@/components/supervisor/DashboardTabs';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { OperatorProductivity } from '@/components/supervisor/OperatorProductivity';
import { getOperatorProductivity } from '@/lib/actions/operator-analytics';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

export default async function OperatorProductivityPage() {
  const initialData = await getOperatorProductivity(30);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="industrial-header">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg">
                <Icons.users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                  Operator Productivity
                </h1>
                <p className="text-sm text-slate-500 font-medium">Performance analytics by operator</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AutoRefresh intervalSeconds={60} />
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Icons.chevronLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <DashboardTabs />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <OperatorProductivity initialData={initialData} />
      </main>
    </div>
  );
}
