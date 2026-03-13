import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { TraceabilitySearch } from '@/components/supervisor/TraceabilitySearch';

export const dynamic = 'force-dynamic';

export const revalidate = 60;

export default function TraceabilityPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Traceability Search</h1>
          <p className="text-gray-600">
            Search by serial number or lot number to view complete history
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <TraceabilitySearch />
      </Suspense>
    </div>
  );
}
