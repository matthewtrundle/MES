'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteEolTestSuite, updateEolTestSuite, updateRoutingSerialFormat } from '@/lib/actions/eol-testing';

type EolParameter = {
  id: string;
  name: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  targetValue: number | null;
  sequence: number;
  active: boolean;
};

type EolSuite = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  routingId: string;
  routing: {
    id: string;
    name: string;
    productCode: string;
  };
  parameters: EolParameter[];
  _count: {
    results: number;
  };
  createdAt: Date;
};

type Routing = {
  id: string;
  name: string;
  productCode: string;
  serialFormat: string | null;
};

interface EolTestSuiteTableProps {
  suites: EolSuite[];
  routings: Routing[];
}

export function EolTestSuiteTable({ suites, routings }: EolTestSuiteTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serialFormatDialogOpen, setSerialFormatDialogOpen] = useState(false);
  const [selectedRouting, setSelectedRouting] = useState<Routing | null>(null);
  const [serialFormatValue, setSerialFormatValue] = useState('');
  const [isSavingFormat, setIsSavingFormat] = useState(false);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteEolTestSuite(id);
      setDeleteConfirmId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete EOL test suite');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (suite: EolSuite) => {
    try {
      await updateEolTestSuite({
        id: suite.id,
        active: !suite.active,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update EOL test suite');
    }
  };

  const openSerialFormatDialog = (routing: Routing) => {
    setSelectedRouting(routing);
    setSerialFormatValue(routing.serialFormat ?? '');
    setSerialFormatDialogOpen(true);
  };

  const handleSaveSerialFormat = async () => {
    if (!selectedRouting) return;
    setIsSavingFormat(true);
    try {
      await updateRoutingSerialFormat(
        selectedRouting.id,
        serialFormatValue.trim() || null
      );
      setSerialFormatDialogOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update serial format');
    } finally {
      setIsSavingFormat(false);
    }
  };

  if (suites.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-slate-900">No EOL test suites</h3>
        <p className="mt-1 text-sm text-slate-500">
          Get started by creating an EOL test suite for a product routing.
        </p>
      </div>
    );
  }

  // Group unique routings that have suites
  const routingsWithSuites = routings.filter((r) =>
    suites.some((s) => s.routingId === r.id)
  );

  return (
    <div className="space-y-6">
      {/* Serial Format Configuration */}
      {routingsWithSuites.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Serial Number Formats</h4>
          <p className="text-xs text-blue-700 mb-3">
            Configure the serial number format for each routing. Serials are assigned after EOL tests pass.
            Placeholders: {'{YYYY}'} {'{MM}'} {'{DD}'} {'{SEQ:N}'} (N = digits)
          </p>
          <div className="space-y-2">
            {routingsWithSuites.map((routing) => (
              <div key={routing.id} className="flex items-center justify-between bg-white rounded px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-slate-900">{routing.name}</span>
                  <span className="text-xs text-slate-500 ml-2">({routing.productCode})</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                    {routing.serialFormat ?? 'Not configured'}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSerialFormatDialog(routing)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suites Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Suite Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Routing
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Parameters
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Results
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suites.map((suite) => (
              <>
                <tr key={suite.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{suite.name}</p>
                      {suite.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{suite.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700">{suite.routing.name}</p>
                    <p className="text-xs text-slate-400">{suite.routing.productCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedId(expandedId === suite.id ? null : suite.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {suite.parameters.length} parameter{suite.parameters.length !== 1 ? 's' : ''}
                      <span className="ml-1">{expandedId === suite.id ? '\u25B2' : '\u25BC'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {suite._count.results} recorded
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        suite.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {suite.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(suite)}
                    >
                      {suite.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => setDeleteConfirmId(suite.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
                {expandedId === suite.id && (
                  <tr key={`${suite.id}-params`}>
                    <td colSpan={6} className="px-4 py-3 bg-slate-50">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-slate-500">#</th>
                              <th className="px-3 py-2 text-left font-medium text-slate-500">Name</th>
                              <th className="px-3 py-2 text-left font-medium text-slate-500">Unit</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Min</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Target</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Max</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {suite.parameters.map((param, idx) => (
                              <tr key={param.id}>
                                <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-700">{param.name}</td>
                                <td className="px-3 py-2 text-slate-600">{param.unit}</td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {param.minValue !== null ? param.minValue : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {param.targetValue !== null ? param.targetValue : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">
                                  {param.maxValue !== null ? param.maxValue : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete EOL Test Suite</DialogTitle>
            <DialogDescription>
              {suites.find((s) => s.id === deleteConfirmId)?._count.results
                ? 'This suite has recorded results and will be deactivated instead of deleted.'
                : 'Are you sure you want to delete this EOL test suite? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Serial Format Dialog */}
      <Dialog open={serialFormatDialogOpen} onOpenChange={setSerialFormatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Serial Number Format</DialogTitle>
            <DialogDescription>
              Configure the serial number format for {selectedRouting?.name}.
              Use placeholders: {'{YYYY}'}, {'{MM}'}, {'{DD}'}, {'{SEQ:N}'} where N is the number of digits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serialFormat">Serial Format</Label>
              <Input
                id="serialFormat"
                value={serialFormatValue}
                onChange={(e) => setSerialFormatValue(e.target.value)}
                placeholder="e.g., BLDC-{YYYY}-{SEQ:5}"
              />
            </div>
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Preview:</p>
              <code className="text-sm text-slate-700">
                {serialFormatValue
                  .replace('{YYYY}', new Date().getFullYear().toString())
                  .replace('{MM}', (new Date().getMonth() + 1).toString().padStart(2, '0'))
                  .replace('{DD}', new Date().getDate().toString().padStart(2, '0'))
                  .replace(/\{SEQ:(\d+)\}/g, (_, d) => '1'.padStart(parseInt(d), '0'))
                  || 'Enter a format above'}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSerialFormatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSerialFormat} disabled={isSavingFormat}>
              {isSavingFormat ? 'Saving...' : 'Save Format'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
