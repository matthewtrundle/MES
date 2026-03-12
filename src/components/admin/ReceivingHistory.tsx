'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { getReceivingHistory } from '@/lib/actions/receiving';

type ReceivingRecord = Awaited<ReturnType<typeof getReceivingHistory>>[number];

interface ReceivingHistoryProps {
  records: ReceivingRecord[];
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending_iqc':
      return (
        <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
          Pending IQC
        </Badge>
      );
    case 'available':
      return (
        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
          Available
        </Badge>
      );
    case 'quarantine':
      return (
        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
          Quarantine
        </Badge>
      );
    case 'depleted':
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">
          Depleted
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-500 bg-slate-50">
          Expired
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function inspectionBadge(inspection: { status: string; overallResult: string | null } | undefined) {
  if (!inspection) return <span className="text-sm text-slate-400">--</span>;

  switch (inspection.status) {
    case 'pending':
      return (
        <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
          Pending
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
          In Progress
        </Badge>
      );
    case 'completed':
      return (
        <Badge
          variant="outline"
          className={
            inspection.overallResult === 'conforming'
              ? 'border-green-300 text-green-700 bg-green-50'
              : 'border-red-300 text-red-700 bg-red-50'
          }
        >
          {inspection.overallResult === 'conforming' ? 'Conforming' : 'Nonconforming'}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{inspection.status}</Badge>;
  }
}

export function ReceivingHistory({ records }: ReceivingHistoryProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Receiving</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-8">
            No receiving records in the last 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Receiving ({records.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot Number</TableHead>
              <TableHead>Material Code</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Qty Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IQC</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const inspection = record.incomingInspections[0] || undefined;
              return (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm">{record.lotNumber}</TableCell>
                  <TableCell className="font-medium">{record.materialCode}</TableCell>
                  <TableCell className="font-mono text-sm">{record.purchaseOrderNumber || '--'}</TableCell>
                  <TableCell>{record.supplierRef?.name || record.supplier || '--'}</TableCell>
                  <TableCell className="text-right">
                    {record.qtyReceived} {record.unitOfMeasure}
                  </TableCell>
                  <TableCell>{statusBadge(record.status)}</TableCell>
                  <TableCell>{inspectionBadge(inspection)}</TableCell>
                  <TableCell>{record.receivedBy?.name || '--'}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(record.receivedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
