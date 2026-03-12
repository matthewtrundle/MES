'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createPurchaseOrder, searchParts } from '@/lib/actions/purchase-orders';

type Supplier = {
  id: string;
  name: string;
  supplierId: string;
  active: boolean;
};

type PartResult = {
  id: string;
  partNumber: string;
  name: string;
  revision: string;
  unitOfMeasure: string;
  standardCost: number | null;
};

type LineItemDraft = {
  key: string;
  lineNumber: number;
  partNumber: string;
  partRevision: string;
  supplierPartNumber: string;
  description: string;
  qtyOrdered: number;
  unitOfMeasure: string;
  unitCost: number;
  countryOfOrigin: string;
  expectedLeadTimeDays: string;
  notes: string;
};

function createEmptyLineItem(lineNumber: number): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    lineNumber,
    partNumber: '',
    partRevision: 'A',
    supplierPartNumber: '',
    description: '',
    qtyOrdered: 1,
    unitOfMeasure: 'EA',
    unitCost: 0,
    countryOfOrigin: '',
    expectedLeadTimeDays: '',
    notes: '',
  };
}

interface PurchaseOrderFormProps {
  suppliers: Supplier[];
}

export function PurchaseOrderForm({ suppliers }: PurchaseOrderFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([createEmptyLineItem(1)]);

  // Part search state
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<PartResult[]>([]);
  const [searchingParts, setSearchingParts] = useState(false);
  const [activeLineKey, setActiveLineKey] = useState<string | null>(null);

  const activeSuppliers = suppliers.filter((s) => s.active);

  const handlePartSearch = useCallback(async (query: string, lineKey: string) => {
    setPartSearchQuery(query);
    setActiveLineKey(lineKey);
    if (query.length < 1) {
      setPartSearchResults([]);
      return;
    }
    setSearchingParts(true);
    try {
      const results = await searchParts(query);
      setPartSearchResults(results);
    } catch {
      setPartSearchResults([]);
    } finally {
      setSearchingParts(false);
    }
  }, []);

  const handleSelectPart = (part: PartResult, lineKey: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.key === lineKey
          ? {
              ...item,
              partNumber: part.partNumber,
              partRevision: part.revision,
              description: part.name,
              unitOfMeasure: part.unitOfMeasure,
              unitCost: part.standardCost ?? 0,
            }
          : item
      )
    );
    setPartSearchResults([]);
    setPartSearchQuery('');
    setActiveLineKey(null);
  };

  const updateLineItem = (key: string, field: keyof LineItemDraft, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    const nextLineNumber = lineItems.length > 0
      ? Math.max(...lineItems.map((i) => i.lineNumber)) + 1
      : 1;
    setLineItems((prev) => [...prev, createEmptyLineItem(nextLineNumber)]);
  };

  const removeLineItem = (key: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.key !== key));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.unitCost * item.qtyOrdered, 0);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      await createPurchaseOrder({
        supplierId,
        buyerName: formData.get('buyerName') as string,
        orderDate: new Date(formData.get('orderDate') as string),
        expectedDate: formData.get('expectedDate')
          ? new Date(formData.get('expectedDate') as string)
          : undefined,
        currency,
        paymentTerms: (formData.get('paymentTerms') as string) || undefined,
        shippingMethod: (formData.get('shippingMethod') as string) || undefined,
        notes: (formData.get('notes') as string) || undefined,
        lineItems: lineItems.map((item) => ({
          lineNumber: item.lineNumber,
          partNumber: item.partNumber,
          partRevision: item.partRevision,
          supplierPartNumber: item.supplierPartNumber || undefined,
          description: item.description || undefined,
          qtyOrdered: item.qtyOrdered,
          unitOfMeasure: item.unitOfMeasure,
          unitCost: item.unitCost || undefined,
          countryOfOrigin: item.countryOfOrigin || undefined,
          expectedLeadTimeDays: item.expectedLeadTimeDays
            ? parseInt(item.expectedLeadTimeDays, 10)
            : undefined,
          notes: item.notes || undefined,
        })),
      });
      setOpen(false);
      resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierId('');
    setCurrency('USD');
    setLineItems([createEmptyLineItem(1)]);
    setPartSearchQuery('');
    setPartSearchResults([]);
    setActiveLineKey(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create PO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order with line items. PO number will be auto-generated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* PO Header */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Order Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.supplierId} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buyerName">Buyer Name</Label>
                  <Input id="buyerName" name="buyerName" placeholder="e.g., John Smith" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderDate">Order Date</Label>
                  <Input
                    id="orderDate"
                    name="orderDate"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedDate">Expected Date</Label>
                  <Input id="expectedDate" name="expectedDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="CNY">CNY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input id="paymentTerms" name="paymentTerms" placeholder="e.g., Net 30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingMethod">Shipping Method</Label>
                  <Input id="shippingMethod" name="shippingMethod" placeholder="e.g., Ground, Air" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Additional notes..." />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Line Items
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Line
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={item.key} className="border rounded-lg p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">
                      Line {item.lineNumber}
                    </span>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        onClick={() => removeLineItem(item.key)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1 relative col-span-2">
                      <Label className="text-xs">Part Number</Label>
                      <Input
                        value={item.partNumber}
                        onChange={(e) => {
                          updateLineItem(item.key, 'partNumber', e.target.value);
                          handlePartSearch(e.target.value, item.key);
                        }}
                        onFocus={() => {
                          if (item.partNumber) {
                            handlePartSearch(item.partNumber, item.key);
                          }
                        }}
                        placeholder="Search by part number or name..."
                        required
                        className="text-sm"
                      />
                      {activeLineKey === item.key && partSearchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {partSearchResults.map((part) => (
                            <button
                              key={part.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                              onClick={() => handleSelectPart(part, item.key)}
                            >
                              <span className="font-mono font-medium">{part.partNumber}</span>
                              <span className="text-slate-400 ml-1">Rev {part.revision}</span>
                              <br />
                              <span className="text-slate-500 text-xs">{part.name}</span>
                              {part.standardCost != null && (
                                <span className="text-slate-400 text-xs ml-2">
                                  ${part.standardCost.toFixed(2)}/{part.unitOfMeasure}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {activeLineKey === item.key && searchingParts && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-3 text-sm text-slate-500">
                          Searching...
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Revision</Label>
                      <Input
                        value={item.partRevision}
                        onChange={(e) => updateLineItem(item.key, 'partRevision', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.key, 'description', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Qty Ordered</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.qtyOrdered}
                        onChange={(e) => updateLineItem(item.key, 'qtyOrdered', parseInt(e.target.value, 10) || 1)}
                        required
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UoM</Label>
                      <Input
                        value={item.unitOfMeasure}
                        onChange={(e) => updateLineItem(item.key, 'unitOfMeasure', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateLineItem(item.key, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Country</Label>
                      <Input
                        value={item.countryOfOrigin}
                        onChange={(e) => updateLineItem(item.key, 'countryOfOrigin', e.target.value)}
                        placeholder="e.g., US"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lead Time (days)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.expectedLeadTimeDays}
                        onChange={(e) => updateLineItem(item.key, 'expectedLeadTimeDays', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {item.unitCost > 0 && item.qtyOrdered > 0 && (
                    <div className="text-right text-xs text-slate-500">
                      Line total: ${(item.unitCost * item.qtyOrdered).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-end border-t pt-3">
                <div className="text-right">
                  <span className="text-sm text-slate-500 mr-3">Estimated Total:</span>
                  <span className="text-lg font-bold text-slate-900">
                    ${calculateTotal().toFixed(2)} {currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !supplierId}>
              {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
