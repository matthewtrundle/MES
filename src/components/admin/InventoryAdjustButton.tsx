'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InventoryAdjustmentDialog } from './InventoryAdjustmentDialog';
import { Pencil } from 'lucide-react';

interface InventoryAdjustButtonProps {
  lotId: string;
  currentQty: number;
  materialCode: string;
  lotNumber: string;
}

export function InventoryAdjustButton({
  lotId,
  currentQty,
  materialCode,
  lotNumber,
}: InventoryAdjustButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-10 min-w-[80px]"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5 mr-1" />
        Adjust
      </Button>
      {open && (
        <InventoryAdjustmentDialog
          lotId={lotId}
          currentQty={currentQty}
          materialCode={materialCode}
          lotNumber={lotNumber}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
