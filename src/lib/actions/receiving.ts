'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

// ── Types ────────────────────────────────────────────────────────

interface ReceiveLineItem {
  lineItemId: string;
  qtyReceived: number;
  carrier?: string;
  trackingNumber?: string;
  conditionNotes?: string;
}

// ── Search POs ───────────────────────────────────────────────────

/**
 * Search purchase orders by PO number, supplier name, or part number.
 * Only returns submitted or partially_received POs.
 */
export async function searchPurchaseOrders(query: string) {
  await requireRole(['admin', 'supervisor']);

  if (!query || query.trim().length < 2) {
    return [];
  }

  const trimmed = query.trim();

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ['submitted', 'partially_received'] },
      OR: [
        { poNumber: { contains: trimmed, mode: 'insensitive' } },
        { supplier: { name: { contains: trimmed, mode: 'insensitive' } } },
        {
          lineItems: {
            some: {
              partNumber: { contains: trimmed, mode: 'insensitive' },
            },
          },
        },
      ],
    },
    include: {
      supplier: { select: { id: true, name: true, supplierId: true } },
      lineItems: {
        select: {
          id: true,
          lineNumber: true,
          partNumber: true,
          description: true,
          qtyOrdered: true,
          qtyReceived: true,
          unitOfMeasure: true,
        },
        orderBy: { lineNumber: 'asc' },
      },
    },
    orderBy: { orderDate: 'desc' },
    take: 20,
  });

  return pos;
}

// ── Get PO for Receiving ─────────────────────────────────────────

/**
 * Get a single PO with full line item details and remaining quantities.
 */
export async function getPurchaseOrderForReceiving(poId: string) {
  await requireRole(['admin', 'supervisor']);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      lineItems: {
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  if (!['submitted', 'partially_received'].includes(po.status)) {
    throw new Error(`PO ${po.poNumber} is not in a receivable status (current: ${po.status})`);
  }

  return po;
}

// ── Receive Against PO ───────────────────────────────────────────

/**
 * Generate a lot number in format LOT-YYYYMMDD-NNNN
 */
async function generateLotNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LOT-${dateStr}-`;

  // Find the highest lot number for today
  const lastLot = await tx.materialLot.findFirst({
    where: { lotNumber: { startsWith: prefix } },
    orderBy: { lotNumber: 'desc' },
    select: { lotNumber: true },
  });

  let nextSeq = 1;
  if (lastLot) {
    const seqStr = lastLot.lotNumber.replace(prefix, '');
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Receive material against a purchase order.
 * Creates MaterialLots, updates PO line item quantities, manages IQC auto-creation.
 */
export async function receiveAgainstPO(
  poId: string,
  lineItems: ReceiveLineItem[]
) {
  const user = await requireRole(['admin', 'supervisor']);

  if (!lineItems || lineItems.length === 0) {
    throw new Error('No line items to receive');
  }

  // Filter out zero-qty items
  const itemsToReceive = lineItems.filter((li) => li.qtyReceived > 0);
  if (itemsToReceive.length === 0) {
    throw new Error('All quantities are zero - nothing to receive');
  }

  const site = await prisma.site.findFirst();
  if (!site) {
    throw new Error('No site configured');
  }

  // Run in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        lineItems: true,
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    if (!['submitted', 'partially_received'].includes(po.status)) {
      throw new Error(`PO ${po.poNumber} is not in a receivable status`);
    }

    const createdLots: Array<{
      id: string;
      lotNumber: string;
      materialCode: string;
      qtyReceived: number;
      status: string;
      inspectionCreated: boolean;
    }> = [];

    for (const item of itemsToReceive) {
      // Find the PO line item
      const poLineItem = po.lineItems.find((li) => li.id === item.lineItemId);
      if (!poLineItem) {
        throw new Error(`Line item ${item.lineItemId} not found on PO ${po.poNumber}`);
      }

      if (item.qtyReceived <= 0) {
        continue;
      }

      // Generate lot number
      const lotNumber = await generateLotNumber(tx);

      // Check if CTQ definitions exist for this part number
      const ctqDefs = await tx.cTQDefinition.findMany({
        where: {
          partNumber: poLineItem.partNumber,
          active: true,
        },
      });

      const hasCTQ = ctqDefs.length > 0;
      const lotStatus = hasCTQ ? 'pending_iqc' : 'available';

      // Create MaterialLot
      const lot = await tx.materialLot.create({
        data: {
          lotNumber,
          materialCode: poLineItem.partNumber,
          description: poLineItem.description,
          qtyReceived: item.qtyReceived,
          qtyRemaining: item.qtyReceived,
          unitOfMeasure: poLineItem.unitOfMeasure,
          supplier: po.supplier.name,
          purchaseOrderNumber: po.poNumber,
          status: lotStatus,
          receivedById: user.id,
          supplierId: po.supplierId,
          poLineItemId: poLineItem.id,
          carrier: item.carrier || null,
          trackingNumber: item.trackingNumber || null,
          conditionNotes: item.conditionNotes || null,
        },
      });

      // Record inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          materialLotId: lot.id,
          transactionType: 'receive',
          quantity: item.qtyReceived,
          previousQty: 0,
          newQty: item.qtyReceived,
          referenceType: 'purchase_order',
          referenceId: po.id,
          reason: `Received against PO ${po.poNumber}, line ${poLineItem.lineNumber}`,
          operatorId: user.id,
        },
      });

      // Update PO line item qtyReceived
      await tx.purchaseOrderLineItem.update({
        where: { id: poLineItem.id },
        data: {
          qtyReceived: { increment: item.qtyReceived },
        },
      });

      // Auto-create IncomingInspection if CTQ definitions exist
      let inspectionCreated = false;
      if (hasCTQ) {
        await tx.incomingInspection.create({
          data: {
            materialLotId: lot.id,
            status: 'pending',
          },
        });
        inspectionCreated = true;
      }

      createdLots.push({
        id: lot.id,
        lotNumber: lot.lotNumber,
        materialCode: lot.materialCode,
        qtyReceived: item.qtyReceived,
        status: lotStatus,
        inspectionCreated,
      });
    }

    // Reload line items to check if all are fully received
    const updatedLineItems = await tx.purchaseOrderLineItem.findMany({
      where: { purchaseOrderId: po.id },
    });

    const allFullyReceived = updatedLineItems.every(
      (li) => li.qtyReceived >= li.qtyOrdered
    );

    const newPOStatus = allFullyReceived ? 'fully_received' : 'partially_received';

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: newPOStatus },
    });

    return {
      po: { id: po.id, poNumber: po.poNumber, newStatus: newPOStatus },
      createdLots,
    };
  });

  // Emit events outside the transaction
  for (const lot of result.createdLots) {
    await emitEvent({
      eventType: 'material_lot_received',
      siteId: site.id,
      operatorId: user.id,
      payload: {
        lotNumber: lot.lotNumber,
        materialCode: lot.materialCode,
        qtyReceived: lot.qtyReceived,
        status: lot.status,
        purchaseOrderNumber: result.po.poNumber,
        purchaseOrderId: result.po.id,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });

    if (lot.inspectionCreated) {
      await emitEvent({
        eventType: 'iqc_inspection_created',
        siteId: site.id,
        operatorId: user.id,
        payload: {
          materialLotId: lot.id,
          lotNumber: lot.lotNumber,
          materialCode: lot.materialCode,
          reason: 'CTQ definitions found - auto-created on receiving',
        },
        source: 'ui',
        idempotencyKey: generateUniqueIdempotencyKey(),
      });
    }
  }

  await emitEvent({
    eventType: 'purchase_order_received',
    siteId: site.id,
    operatorId: user.id,
    payload: {
      purchaseOrderId: result.po.id,
      poNumber: result.po.poNumber,
      newStatus: result.po.newStatus,
      lotsCreated: result.createdLots.map((l) => l.lotNumber),
      totalQtyReceived: result.createdLots.reduce((sum, l) => sum + l.qtyReceived, 0),
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/receiving');
  revalidatePath('/admin/materials');
  revalidatePath('/dashboard/inventory');

  return result;
}

// ── Receiving History ────────────────────────────────────────────

/**
 * Get recent material lots received, with PO info.
 */
export async function getReceivingHistory(days: number = 30) {
  await requireRole(['admin', 'supervisor']);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const lots = await prisma.materialLot.findMany({
    where: {
      receivedAt: { gte: since },
      purchaseOrderNumber: { not: null },
    },
    include: {
      receivedBy: { select: { id: true, name: true } },
      supplierRef: { select: { id: true, name: true, supplierId: true } },
      incomingInspections: {
        select: { id: true, status: true, overallResult: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { receivedAt: 'desc' },
    take: 100,
  });

  return lots;
}

// ── Discrepancies ────────────────────────────────────────────────

/**
 * Compare ordered vs received quantities for a PO.
 */
export async function getDiscrepancies(poId: string) {
  await requireRole(['admin', 'supervisor']);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: { select: { name: true } },
      lineItems: {
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  const discrepancies = po.lineItems.map((li) => {
    const remaining = li.qtyOrdered - li.qtyReceived;
    const isOverShipped = li.qtyReceived > li.qtyOrdered;
    const isUnderShipped = li.qtyReceived < li.qtyOrdered && li.qtyReceived > 0;
    const isComplete = li.qtyReceived >= li.qtyOrdered;

    return {
      lineNumber: li.lineNumber,
      partNumber: li.partNumber,
      description: li.description,
      qtyOrdered: li.qtyOrdered,
      qtyReceived: li.qtyReceived,
      qtyRemaining: Math.max(0, remaining),
      isOverShipped,
      isUnderShipped,
      isComplete,
      unitOfMeasure: li.unitOfMeasure,
    };
  });

  return {
    poNumber: po.poNumber,
    supplierName: po.supplier.name,
    status: po.status,
    discrepancies,
  };
}
