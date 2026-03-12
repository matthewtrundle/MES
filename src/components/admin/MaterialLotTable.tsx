'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type MaterialLot = {
  id: string;
  lotNumber: string;
  materialCode: string;
  description: string | null;
  qtyReceived: number;
  qtyRemaining: number;
  unitOfMeasure: string;
  status: string;
  supplier: string | null;
  purchaseOrderNumber: string | null;
  expiresAt: Date | string | null;
  receivedAt: Date | string;
  receivedBy: { name: string | null } | null;
  _count: { consumptions: number };
};

interface MaterialLotTableProps {
  lots: MaterialLot[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'available':
      return <Badge className="bg-green-500 hover:bg-green-600">Available</Badge>;
    case 'quarantine':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Quarantine</Badge>;
    case 'expired':
      return <Badge className="bg-red-500 hover:bg-red-600">Expired</Badge>;
    case 'depleted':
      return <Badge variant="secondary">Depleted</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isExpiringSoon(date: Date | string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return d.getTime() - now.getTime() <= sevenDays && d.getTime() > now.getTime();
}

export function MaterialLotTable({ lots }: MaterialLotTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Material Lots</CardTitle>
        <CardDescription>
          {lots.length} lot{lots.length !== 1 ? 's' : ''} in inventory
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty Received</TableHead>
                <TableHead className="text-right">Qty Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead>Received At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-500 py-8">
                    No lots found
                  </TableCell>
                </TableRow>
              ) : (
                lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-mono font-medium">{lot.lotNumber}</TableCell>
                    <TableCell className="font-mono text-sm">{lot.materialCode}</TableCell>
                    <TableCell className="text-slate-500">{lot.description || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {lot.qtyReceived} {lot.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {lot.qtyRemaining} {lot.unitOfMeasure}
                    </TableCell>
                    <TableCell>{getStatusBadge(lot.status)}</TableCell>
                    <TableCell>
                      <span className={isExpiringSoon(lot.expiresAt) ? 'text-orange-600 font-medium' : ''}>
                        {formatDate(lot.expiresAt)}
                        {isExpiringSoon(lot.expiresAt) && (
                          <span className="block text-xs text-orange-500">Expiring soon</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{lot.supplier || '-'}</TableCell>
                    <TableCell className="text-slate-500">{lot.receivedBy?.name || '-'}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{formatDate(lot.receivedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
