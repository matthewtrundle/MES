'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { generatePackingList } from '@/lib/actions/shipping';

type PackingListData = Awaited<ReturnType<typeof generatePackingList>>;

interface PackingListPreviewProps {
  data: PackingListData;
  onBack: () => void;
}

export function PackingListPreview({ data, onBack }: PackingListPreviewProps) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={onBack}>
          Back to Shipment
        </Button>
        <Button onClick={handlePrint}>
          Print Packing List
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">PACKING LIST</h1>
                <p className="text-lg font-semibold text-slate-700 mt-1">
                  {data.companyName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Shipment Number</p>
                <p className="text-lg font-mono font-bold">{data.shipmentNumber}</p>
                {data.shipDate && (
                  <>
                    <p className="text-sm text-slate-500 mt-2">Ship Date</p>
                    <p className="font-medium">
                      {new Date(data.shipDate).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Order Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Ship To
              </h3>
              <p className="font-semibold text-slate-900">{data.customerName}</p>
              {data.customerAddress && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
                  {data.customerAddress}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Order Details
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Work Order:</span>
                  <span className="font-medium">{data.workOrderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Product:</span>
                  <span className="font-medium">
                    {data.productCode}
                    {data.productName ? ` - ${data.productName}` : ''}
                  </span>
                </div>
                {data.customerOrderRef && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer PO:</span>
                    <span className="font-medium">{data.customerOrderRef}</span>
                  </div>
                )}
                {data.carrier && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Carrier:</span>
                    <span className="font-medium">{data.carrier}</span>
                  </div>
                )}
                {data.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tracking #:</span>
                    <span className="font-mono">{data.trackingNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Items ({data.items.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead className="text-center">Box Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-slate-500">{index + 1}</TableCell>
                    <TableCell className="font-mono font-medium">
                      {item.serialNumber}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.boxNumber ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="border-t pt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Total Items:</span>{' '}
              <span className="font-semibold">{data.items.length}</span>
            </div>
            {data.totalBoxes && (
              <div>
                <span className="text-slate-500">Total Boxes:</span>{' '}
                <span className="font-semibold">{data.totalBoxes}</span>
              </div>
            )}
            {data.totalWeight && (
              <div>
                <span className="text-slate-500">Total Weight:</span>{' '}
                <span className="font-semibold">
                  {data.totalWeight} {data.weightUnit}
                </span>
              </div>
            )}
          </div>

          {/* Special Notes */}
          {data.specialNotes && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-1">
                Special Notes
              </h4>
              <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                {data.specialNotes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-xs text-slate-400 text-center">
            Generated on {new Date(data.generatedAt).toLocaleString()} | {data.companyName}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
