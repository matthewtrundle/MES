import { AutoRefresh } from '@/components/supervisor/AutoRefresh';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
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
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="SPC Analytics" subtitle="Statistical Process Control and capability analysis">
        <AutoRefresh intervalSeconds={60} />
      </DashboardPageHeader>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Checks</p>
            <p className="text-xl font-semibold text-slate-900 mt-1">{summary.total}</p>
            <p className="text-xs text-slate-400 mt-1">With measurement data</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Capable (Cpk &gt; 1.33)</p>
            <p className="text-xl font-semibold text-green-600 mt-1">{summary.capable}</p>
            <p className="text-xs text-slate-400 mt-1">Process under control</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Marginal (Cpk 1.0-1.33)</p>
            <p className="text-xl font-semibold text-yellow-600 mt-1">{summary.marginal}</p>
            <p className="text-xs text-slate-400 mt-1">Needs improvement</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Not Capable (Cpk &lt; 1.0)</p>
            <p className="text-xl font-semibold text-red-600 mt-1">{summary.notCapable}</p>
            <p className="text-xs text-slate-400 mt-1">Action required</p>
          </div>
        </div>

        {/* Interactive SPC Dashboard */}
        <SPCDashboard />
      </main>
    </div>
  );
}
