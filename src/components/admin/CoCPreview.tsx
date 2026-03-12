'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { generateCertificateOfConformance } from '@/lib/actions/shipping';

type CoCData = Awaited<ReturnType<typeof generateCertificateOfConformance>>;

interface CoCPreviewProps {
  data: CoCData;
  onBack: () => void;
}

export function CoCPreview({ data, onBack }: CoCPreviewProps) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const allPassed = data.units.every((u) => u.eolResult === 'pass');
  const testedCount = data.units.filter((u) => u.eolResult !== 'not_tested').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={onBack}>
          Back to Shipment
        </Button>
        <Button onClick={handlePrint}>
          Print Certificate
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">
              Certificate of Conformance
            </h1>
            <p className="text-lg font-semibold text-slate-700 mt-2">
              {data.companyName}
            </p>
            <p className="text-sm text-slate-500 mt-1 font-mono">
              {data.shipmentNumber}
            </p>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Customer
              </h3>
              <p className="font-semibold text-slate-900">{data.customerName}</p>
              {data.customerOrderRef && (
                <p className="text-sm text-slate-600 mt-1">
                  Customer PO: {data.customerOrderRef}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Product Information
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Work Order:</span>
                  <span className="font-medium">{data.workOrderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Product Code:</span>
                  <span className="font-medium">{data.productCode}</span>
                </div>
                {data.productName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Product Name:</span>
                    <span className="font-medium">{data.productName}</span>
                  </div>
                )}
                {data.shipDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ship Date:</span>
                    <span className="font-medium">
                      {new Date(data.shipDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test Summary */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">EOL Test Summary</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {testedCount} of {data.units.length} units tested
                </p>
              </div>
              <Badge
                variant={allPassed ? 'default' : 'destructive'}
                className={allPassed ? 'bg-green-600' : ''}
              >
                {allPassed ? 'ALL PASSED' : 'REVIEW REQUIRED'}
              </Badge>
            </div>
          </div>

          {/* Units Table */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Certified Units ({data.units.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead className="text-center">EOL Result</TableHead>
                  <TableHead>Test Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.units.map((unit, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-slate-500">{index + 1}</TableCell>
                    <TableCell className="font-mono font-medium">
                      {unit.serialNumber}
                    </TableCell>
                    <TableCell className="text-center">
                      {unit.eolResult === 'pass' ? (
                        <Badge variant="default" className="bg-green-600">
                          PASS
                        </Badge>
                      ) : unit.eolResult === 'fail' ? (
                        <Badge variant="destructive">FAIL</Badge>
                      ) : (
                        <Badge variant="outline">Not Tested</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {unit.testedAt
                        ? new Date(unit.testedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Certification Statement */}
          <div className="border-2 border-slate-300 rounded-lg p-6 mb-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Certification Statement
            </h3>
            <p className="text-sm text-slate-800 leading-relaxed">
              {data.certificationStatement}
            </p>
          </div>

          {/* Signature Area */}
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <div className="border-b border-slate-400 mb-2 h-12" />
              <p className="text-xs text-slate-500">Authorized Signature</p>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-2 h-12" />
              <p className="text-xs text-slate-500">Date</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-xs text-slate-400 text-center">
            Generated by {data.generatedBy} on{' '}
            {new Date(data.generatedAt).toLocaleString()} | {data.companyName}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
