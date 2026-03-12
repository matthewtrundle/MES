'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { uuid, nonNegativeNumber } from '@/lib/validation/schemas';

const adjustInventorySchema = z.object({
  lotId: uuid,
  newQty: nonNegativeNumber,
  reason: z.string().min(1, 'Reason is required').max(500),
});

/**
 * Adjust inventory quantity for a material lot (with audit trail)
 */
export async function adjustInventory(data: z.infer<typeof adjustInventorySchema>) {
  const validated = adjustInventorySchema.parse(data);
  const user = await requireRole(['admin']);

  const lot = await prisma.materialLot.findUnique({
    where: { id: validated.lotId },
  });

  if (!lot) {
    throw new Error('Material lot not found');
  }

  const previousQty = lot.qtyRemaining;
  const adjustment = validated.newQty - previousQty;

  // Update lot quantity and status
  const newStatus = validated.newQty === 0 ? 'depleted' : lot.status;

  const updatedLot = await prisma.materialLot.update({
    where: { id: validated.lotId },
    data: {
      qtyRemaining: validated.newQty,
      status: newStatus,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'inventory_adjustment',
      entityType: 'MaterialLot',
      entityId: validated.lotId,
      beforeJson: { qtyRemaining: previousQty, status: lot.status },
      afterJson: { qtyRemaining: validated.newQty, status: newStatus, reason: validated.reason },
    },
  });

  // Emit event
  const site = await prisma.site.findFirst();
  if (site) {
    await emitEvent({
      eventType: 'config_changed',
      siteId: site.id,
      operatorId: user.id,
      payload: {
        action: 'inventory_adjustment',
        lotNumber: lot.lotNumber,
        materialCode: lot.materialCode,
        previousQty,
        newQty: validated.newQty,
        adjustment,
        reason: validated.reason,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/materials');
  revalidatePath('/dashboard/inventory');

  return updatedLot;
}
