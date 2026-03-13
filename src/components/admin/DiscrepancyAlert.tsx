'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDiscrepancies } from '@/lib/actions/receiving';

type DiscrepancyData = Awaited<ReturnType<typeof getDiscrepancies>>;

interface DiscrepancyAlertProps {
  poId: string;
}

function getStatusBadge(item: DiscrepancyData['discrepancies'][number]) {
  if (item.isOverShipped) {
    return (
      <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
        Over
      </Badge>
    );
  }
  if (item.isUnderShipped) {
    return (
      <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
        Short
      </Badge>
    );
  }
  if (item.isComplete) {
    return (
      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
        Complete
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">
      Pending
    </Badge>
  );
}

export function DiscrepancyAlert({ poId }: DiscrepancyAlertProps) {
  const [data, setData] = useState<DiscrepancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getDiscrepancies(poId);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load discrepancies');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [poId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-slate-500 text-center">Loading discrepancy data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const hasDiscrepancies = data.discrepancies.some(
    (d) => d.isOverShipped || d.isUnderShipped
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ordered vs Received Comparison</CardTitle>
        <p className="text-sm text-slate-500">
          {data.poNumber} &middot; {data.supplierName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDiscrepancies && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertDescription className="text-amber-800 flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Receiving discrepancies detected. One or more line items have a quantity mismatch
              between ordered and received amounts.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Qty Received</TableHead>
                <TableHead className="text-right">Qty Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.discrepancies.map((item) => (
                <TableRow
                  key={item.lineNumber}
                  className={
                    item.isOverShipped
                      ? 'bg-red-50/50'
                      : item.isUnderShipped
                        ? 'bg-yellow-50/50'
                        : ''
                  }
                >
                  <TableCell className="font-mono font-medium text-sm">
                    {item.partNumber}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">
                    {item.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.qtyOrdered}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.qtyReceived}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.isOverShipped ? (
                      <span className="text-red-600 font-medium">
                        +{item.qtyReceived - item.qtyOrdered} over
                      </span>
                    ) : (
                      <span className={item.qtyRemaining > 0 ? 'text-yellow-600' : 'text-slate-500'}>
                        {item.qtyRemaining}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
