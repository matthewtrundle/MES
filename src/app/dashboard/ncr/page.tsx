import { prisma } from '@/lib/db/prisma';
import { NCRList } from '@/components/supervisor/NCRList';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export const revalidate = 30;

async function getNCRData() {
  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: {
      status: { in: ['open', 'dispositioned'] },
    },
    include: {
      unit: {
        include: {
          workOrder: true,
        },
      },
      station: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const counts = {
    open: ncrs.filter((n) => n.status === 'open').length,
    dispositioned: ncrs.filter((n) => n.status === 'dispositioned').length,
  };

  return { ncrs, counts };
}

export default async function NCRPage() {
  const { ncrs, counts } = await getNCRData();

  return (
    <div className="min-h-screen bg-slate-50/80">
      <DashboardPageHeader title="Non-Conformance Records" subtitle="Manage open and pending NCRs" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className={`rounded-lg border bg-white p-4 ${counts.open > 0 ? 'border-red-200' : 'border-slate-200'}`}>
            <p className="text-sm text-slate-500">Open NCRs</p>
            <p className={`text-2xl font-semibold mt-1 ${counts.open > 0 ? 'text-red-600' : 'text-slate-900'}`}>{counts.open}</p>
            <p className="text-sm text-slate-500">Awaiting disposition</p>
          </div>
          <div className={`rounded-lg border bg-white p-4 ${counts.dispositioned > 0 ? 'border-yellow-200' : 'border-slate-200'}`}>
            <p className="text-sm text-slate-500">Dispositioned</p>
            <p className={`text-2xl font-semibold mt-1 ${counts.dispositioned > 0 ? 'text-yellow-600' : 'text-slate-900'}`}>{counts.dispositioned}</p>
            <p className="text-sm text-slate-500">Awaiting closure</p>
          </div>
        </div>

        {/* NCR List */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Active NCRs</h3>
          </div>
          <div className="p-4">
            <NCRList ncrs={ncrs} />
          </div>
        </div>
      </main>
    </div>
  );
}
