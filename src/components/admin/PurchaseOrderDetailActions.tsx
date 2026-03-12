'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { submitPurchaseOrder, cancelPurchaseOrder } from '@/lib/actions/purchase-orders';

interface PurchaseOrderDetailActionsProps {
  poId: string;
  status: string;
}

export function PurchaseOrderDetailActions({ poId, status }: PurchaseOrderDetailActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!confirm('Submit this purchase order? It will no longer be editable.')) return;
    setLoading(true);
    try {
      await submitPurchaseOrder(poId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit PO');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this purchase order? This action cannot be undone.')) return;
    setLoading(true);
    try {
      await cancelPurchaseOrder(poId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel PO');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'draft' && (
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit PO'}
        </Button>
      )}
      {status !== 'cancelled' && status !== 'closed' && (
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={handleCancel}
          disabled={loading}
        >
          {loading ? 'Cancelling...' : 'Cancel PO'}
        </Button>
      )}
    </div>
  );
}
