import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { NCRList } from '@/components/supervisor/NCRList';

export const dynamic = 'force-dynamic';

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
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Non-Conformance Records</h1>
          <p className="text-gray-600">Manage open and pending NCRs</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className={counts.open > 0 ? 'border-red-200' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Open NCRs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${counts.open > 0 ? 'text-red-600' : ''}`}
            >
              {counts.open}
            </p>
            <p className="text-sm text-gray-500">Awaiting disposition</p>
          </CardContent>
        </Card>

        <Card className={counts.dispositioned > 0 ? 'border-yellow-200' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Dispositioned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${counts.dispositioned > 0 ? 'text-yellow-600' : ''}`}
            >
              {counts.dispositioned}
            </p>
            <p className="text-sm text-gray-500">Awaiting closure</p>
          </CardContent>
        </Card>
      </div>

      {/* NCR List */}
      <Card>
        <CardHeader>
          <CardTitle>Active NCRs</CardTitle>
        </CardHeader>
        <CardContent>
          <NCRList ncrs={ncrs} />
        </CardContent>
      </Card>
    </div>
  );
}
