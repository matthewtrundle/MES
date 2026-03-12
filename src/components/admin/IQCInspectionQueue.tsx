'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IQCInspectionDialog } from './IQCInspectionDialog';
import { IQCDispositionDialog } from './IQCDispositionDialog';
import { startInspection } from '@/lib/actions/iqc';

type InspectionQueueItem = {
  id: string;
  status: string;
  overallResult: string | null;
  startedAt: Date | null;
  createdAt: Date;
  materialLot: {
    id: string;
    lotNumber: string;
    materialCode: string;
    description: string | null;
    qtyReceived: number;
    qtyRemaining: number;
    unitOfMeasure: string;
    supplier: string | null;
    purchaseOrderNumber: string | null;
    supplierRef: {
      id: string;
      name: string;
    } | null;
  };
  inspector: {
    id: string;
    name: string;
  } | null;
  results: Array<{
    id: string;
    result: string;
    ctqDefinition: {
      id: string;
      dimensionName: string;
    };
  }>;
};

export function IQCInspectionQueue({
  inspections,
}: {
  inspections: InspectionQueueItem[];
}) {
  const [selectedInspection, setSelectedInspection] = useState<InspectionQueueItem | null>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const handleStartInspection = async (inspection: InspectionQueueItem) => {
    setStarting(inspection.id);
    try {
      await startInspection(inspection.id);
      setSelectedInspection(inspection);
      setShowInspectionDialog(true);
    } catch (err) {
      console.error('Failed to start inspection:', err);
    } finally {
      setStarting(null);
    }
  };

  const handleContinueInspection = (inspection: InspectionQueueItem) => {
    setSelectedInspection(inspection);
    // If UAI pending approval, show disposition dialog
    if (inspection.overallResult === 'nonconforming_uai') {
      setShowDispositionDialog(true);
    } else {
      setShowInspectionDialog(true);
    }
  };

  const handleInspectionComplete = (inspection: InspectionQueueItem) => {
    setShowInspectionDialog(false);
    setSelectedInspection(inspection);
    setShowDispositionDialog(true);
  };

  const pendingCount = inspections.filter((i) => i.status === 'pending').length;
  const inProgressCount = inspections.filter((i) => i.status === 'in_progress').length;

  if (inspections.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium">No pending inspections</p>
        <p className="text-sm mt-1">All incoming material has been inspected.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
          {pendingCount} pending
        </Badge>
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          {inProgressCount} in progress
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Lot Number</TableHead>
            <TableHead>Material Code</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>PO Number</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Inspector</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspections.map((inspection) => (
            <TableRow key={inspection.id}>
              <TableCell>
                <StatusBadge status={inspection.status} overallResult={inspection.overallResult} />
              </TableCell>
              <TableCell className="font-mono text-sm font-medium">
                {inspection.materialLot.lotNumber}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {inspection.materialLot.materialCode}
              </TableCell>
              <TableCell>
                {inspection.materialLot.supplierRef?.name ?? inspection.materialLot.supplier ?? '-'}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {inspection.materialLot.purchaseOrderNumber ?? '-'}
              </TableCell>
              <TableCell className="text-right">
                {inspection.materialLot.qtyReceived} {inspection.materialLot.unitOfMeasure}
              </TableCell>
              <TableCell>
                {inspection.inspector?.name ?? '-'}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {new Date(inspection.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                {inspection.status === 'pending' ? (
                  <Button
                    size="sm"
                    onClick={() => handleStartInspection(inspection)}
                    disabled={starting === inspection.id}
                  >
                    {starting === inspection.id ? 'Starting...' : 'Start Inspection'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleContinueInspection(inspection)}
                  >
                    {inspection.overallResult === 'nonconforming_uai'
                      ? 'Approve UAI'
                      : 'Continue'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedInspection && showInspectionDialog && (
        <IQCInspectionDialog
          inspectionId={selectedInspection.id}
          materialLot={selectedInspection.materialLot}
          open={showInspectionDialog}
          onOpenChange={(open) => {
            setShowInspectionDialog(open);
            if (!open) setSelectedInspection(null);
          }}
          onComplete={() => handleInspectionComplete(selectedInspection)}
        />
      )}

      {selectedInspection && showDispositionDialog && (
        <IQCDispositionDialog
          inspectionId={selectedInspection.id}
          materialLot={selectedInspection.materialLot}
          overallResult={selectedInspection.overallResult}
          open={showDispositionDialog}
          onOpenChange={(open) => {
            setShowDispositionDialog(open);
            if (!open) setSelectedInspection(null);
          }}
        />
      )}
    </>
  );
}

function StatusBadge({ status, overallResult }: { status: string; overallResult: string | null }) {
  if (overallResult === 'nonconforming_uai') {
    return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Awaiting UAI Approval</Badge>;
  }

  switch (status) {
    case 'pending':
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Pending</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
