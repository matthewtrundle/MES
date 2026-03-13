import Link from 'next/link';
import { Icons } from '@/components/icons';
import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { SPCDashboard } from '@/components/supervisor/SPCDashboard';
import { getSPCData } from '@/lib/actions/spc-analytics';

export const revalidate = 60;

async function getSPCSummary() {
  try {
    const data = await getSPCData({ days: 30 });
    const capable = data.filter((d) => d.cpk !== null && d.cpk >= 1.33).length;
    const marginal = data.filter((d) => d.cpk !== null && d.cpk >= 1.0 && d.cpk < 1.33).length;
    const notCapable = data.filter((d) => d.cpk !== null && d.cpk < 1.0).length;
    const noData = data.filter((d) => d.cpk === null).length;
    return { total: data.length, capable, marginal, notCapable, noData };
  } catch {
    return { total: 0, capable: 0, marginal: 0, notCapable: 0, noData: 0 };
  }
}

export default async function SPCPage() {
  const summary = await getSPCSummary();

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
                <div className="rounded-lg bg-indigo-100 p-2">
                  <Icons.chart className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">SPC Analytics</h1>
                  <p className="text-sm text-gray-500">Statistical Process Control and capability analysis</p>
                </div>
              </div>
            </div>
            <AutoRefresh intervalSeconds={60} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Checks</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</p>
            <p className="text-xs text-gray-400 mt-1">With measurement data</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Capable (Cpk &gt; 1.33)</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{summary.capable}</p>
            <p className="text-xs text-green-500 mt-1">Process under control</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">Marginal (Cpk 1.0-1.33)</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{summary.marginal}</p>
            <p className="text-xs text-yellow-500 mt-1">Needs improvement</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">Not Capable (Cpk &lt; 1.0)</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{summary.notCapable}</p>
            <p className="text-xs text-red-500 mt-1">Action required</p>
          </div>
        </div>

        {/* Interactive SPC Dashboard */}
        <SPCDashboard />
      </main>
    </div>
  );
}
