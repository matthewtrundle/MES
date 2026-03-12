'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  searchPurchaseOrders,
  getPurchaseOrderForReceiving,
  receiveAgainstPO,
} from '@/lib/actions/receiving';

type SearchResult = Awaited<ReturnType<typeof searchPurchaseOrders>>[number];
type PODetail = Awaited<ReturnType<typeof getPurchaseOrderForReceiving>>;

interface LineItemInput {
  lineItemId: string;
  qtyReceived: number;
  carrier: string;
  trackingNumber: string;
  conditionNotes: string;
}

export function ReceivingWorkflow() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PODetail | null>(null);
  const [lineInputs, setLineInputs] = useState<LineItemInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<Awaited<ReturnType<typeof receiveAgainstPO>> | null>(null);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const results = await searchPurchaseOrders(searchQuery);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSelectPO = useCallback(async (poId: string) => {
    setError(null);
    try {
      const po = await getPurchaseOrderForReceiving(poId);
      setSelectedPO(po);
      setSearchResults([]);
      setSearchQuery('');
      // Initialize line item inputs
      setLineInputs(
        po.lineItems.map((li) => ({
          lineItemId: li.id,
          qtyReceived: 0,
          carrier: '',
          trackingNumber: '',
          conditionNotes: '',
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PO');
    }
  }, []);

  const updateLineInput = useCallback(
    (index: number, field: keyof LineItemInput, value: string | number) => {
      setLineInputs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedPO) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await receiveAgainstPO(selectedPO.id, lineInputs);
      setSuccessResult(result);
      setSelectedPO(null);
      setLineInputs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receiving failed');
    } finally {
      setSubmitting(false);
    }
  }, [selectedPO, lineInputs]);

  const handleReset = useCallback(() => {
    setSelectedPO(null);
    setLineInputs([]);
    setSearchResults([]);
    setSearchQuery('');
    setError(null);
    setSuccessResult(null);
  }, []);

  // ── Success Summary ──────────────────────────────────────────
  if (successResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700 flex items-center gap-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Receiving Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800">
              PO {successResult.po.poNumber} - Status: <Badge variant="outline">{successResult.po.newStatus.replace(/_/g, ' ')}</Badge>
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Lots Created:</h4>
            {successResult.createdLots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-mono text-sm font-medium">{lot.lotNumber}</span>
                  <span className="text-sm text-slate-500 ml-3">{lot.materialCode}</span>
                  <span className="text-sm text-slate-500 ml-2">Qty: {lot.qtyReceived}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      lot.status === 'pending_iqc'
                        ? 'border-orange-300 text-orange-700 bg-orange-50'
                        : 'border-green-300 text-green-700 bg-green-50'
                    }
                  >
                    {lot.status === 'pending_iqc' ? 'Pending IQC' : 'Available'}
                  </Badge>
                  {lot.inspectionCreated && (
                    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                      Inspection Created
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleReset} className="mt-4">
            Receive More
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── PO Selected: Show Line Items ─────────────────────────────
  if (selectedPO) {
    const hasItems = lineInputs.some((li) => li.qtyReceived > 0);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Receive Against PO {selectedPO.poNumber}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Supplier: {selectedPO.supplier.name} | Status:{' '}
                <Badge variant="outline">{selectedPO.status.replace(/_/g, ' ')}</Badge>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {selectedPO.lineItems.map((li, index) => {
            const remaining = li.qtyOrdered - li.qtyReceived;
            const input = lineInputs[index];
            const isOverShip = input && input.qtyReceived > remaining;

            return (
              <div
                key={li.id}
                className="border border-slate-200 rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">
                      Line {li.lineNumber}: {li.partNumber}
                    </h4>
                    {li.description && (
                      <p className="text-sm text-slate-500">{li.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-600">
                      Ordered: <span className="font-medium">{li.qtyOrdered}</span> {li.unitOfMeasure}
                    </p>
                    <p className="text-slate-600">
                      Previously Received: <span className="font-medium">{li.qtyReceived}</span>
                    </p>
                    <p className={remaining > 0 ? 'text-blue-600 font-medium' : 'text-green-600 font-medium'}>
                      Remaining: {Math.max(0, remaining)}
                    </p>
                  </div>
                </div>

                {remaining <= 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-700">
                    Fully received
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`qty-${li.id}`}>Qty Received</Label>
                      <Input
                        id={`qty-${li.id}`}
                        type="number"
                        min={0}
                        step="any"
                        value={input?.qtyReceived || ''}
                        onChange={(e) =>
                          updateLineInput(index, 'qtyReceived', parseFloat(e.target.value) || 0)
                        }
                        className={isOverShip ? 'border-amber-400 bg-amber-50' : ''}
                      />
                      {isOverShip && (
                        <p className="text-xs text-amber-600 mt-1">
                          Over-shipment: {input.qtyReceived - remaining} over ordered qty
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`carrier-${li.id}`}>Carrier</Label>
                      <Input
                        id={`carrier-${li.id}`}
                        value={input?.carrier || ''}
                        onChange={(e) => updateLineInput(index, 'carrier', e.target.value)}
                        placeholder="e.g., FedEx"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`tracking-${li.id}`}>Tracking #</Label>
                      <Input
                        id={`tracking-${li.id}`}
                        value={input?.trackingNumber || ''}
                        onChange={(e) => updateLineInput(index, 'trackingNumber', e.target.value)}
                        placeholder="Tracking number"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`notes-${li.id}`}>Condition Notes</Label>
                      <Textarea
                        id={`notes-${li.id}`}
                        value={input?.conditionNotes || ''}
                        onChange={(e) => updateLineInput(index, 'conditionNotes', e.target.value)}
                        placeholder="Package condition, damage, etc."
                        rows={1}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Discrepancy warnings */}
          {lineInputs.some((li) => {
            const poLine = selectedPO.lineItems.find((p) => p.id === li.lineItemId);
            if (!poLine) return false;
            return li.qtyReceived > poLine.qtyOrdered - poLine.qtyReceived;
          }) && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertDescription className="text-amber-800">
                One or more line items have an over-shipment. The receiving quantity exceeds the remaining ordered quantity. Review before submitting.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={!hasItems || submitting}
            >
              {submitting ? 'Receiving...' : 'Confirm Receiving'}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={submitting}>
              Cancel
            </Button>
            {hasItems && (
              <span className="text-sm text-slate-500">
                {lineInputs.filter((li) => li.qtyReceived > 0).length} line item(s) to receive
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Search View ──────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive Against Purchase Order</CardTitle>
        <p className="text-sm text-slate-500">
          Search for a PO by number, supplier name, or part number
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Search PO number, supplier, or part number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching || searchQuery.trim().length < 2}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">
              {searchResults.length} PO(s) found
            </h4>
            {searchResults.map((po) => {
              const totalOrdered = po.lineItems.reduce((s, li) => s + li.qtyOrdered, 0);
              const totalReceived = po.lineItems.reduce((s, li) => s + li.qtyReceived, 0);
              return (
                <button
                  key={po.id}
                  onClick={() => handleSelectPO(po.id)}
                  className="w-full text-left border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-medium text-slate-900">{po.poNumber}</span>
                      <span className="text-sm text-slate-500 ml-3">{po.supplier.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        po.status === 'partially_received'
                          ? 'border-orange-300 text-orange-700 bg-orange-50'
                          : 'border-blue-300 text-blue-700 bg-blue-50'
                      }
                    >
                      {po.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {po.lineItems.length} line item(s) | {totalReceived}/{totalOrdered} received
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Parts: {po.lineItems.map((li) => li.partNumber).join(', ')}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
          <p className="text-sm text-slate-500 text-center py-4">
            No matching purchase orders found. Only submitted or partially received POs are shown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
