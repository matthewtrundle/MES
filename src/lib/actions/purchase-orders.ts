'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import {
  createPurchaseOrderSchema,
  addLineItemSchema,
  type CreatePurchaseOrderInput,
  type LineItemInput,
} from '@/lib/validation/po-schemas';
import { validate } from '@/lib/validation/schemas';

// ── Get next PO number ────────────────────────────────────────────
export async function getNextPoNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  const lastPo = await tx.purchaseOrder.findFirst({
    where: {
      poNumber: { startsWith: prefix },
    },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });

  let sequence = 1;
  if (lastPo) {
    const lastSeq = parseInt(lastPo.poNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// ── Create Purchase Order ─────────────────────────────────────────
export async function createPurchaseOrder(data: CreatePurchaseOrderInput) {
  const user = await requireRole(['admin', 'supervisor']);
  const validated = validate(createPurchaseOrderSchema, data);

  const poNumber = await getNextPoNumber();

  // Calculate total value from line items
  const totalValue = validated.lineItems.reduce((sum, item) => {
    const itemTotal = (item.unitCost ?? 0) * item.qtyOrdered;
    return sum + itemTotal;
  }, 0);

  const purchaseOrder = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: validated.supplierId,
        buyerName: validated.buyerName,
        orderDate: validated.orderDate,
        expectedDate: validated.expectedDate ?? null,
        status: 'draft',
        currency: validated.currency,
        paymentTerms: validated.paymentTerms ?? null,
        shippingMethod: validated.shippingMethod ?? null,
        totalValue,
        notes: validated.notes ?? null,
        lineItems: {
          create: validated.lineItems.map((item) => ({
            lineNumber: item.lineNumber,
            partNumber: item.partNumber,
            partRevision: item.partRevision ?? 'A',
            supplierPartNumber: item.supplierPartNumber ?? null,
            description: item.description ?? null,
            qtyOrdered: item.qtyOrdered,
            qtyReceived: 0,
            unitOfMeasure: item.unitOfMeasure,
            unitCost: item.unitCost ?? null,
            totalCost: item.unitCost ? item.unitCost * item.qtyOrdered : null,
            countryOfOrigin: item.countryOfOrigin ?? null,
            expectedLeadTimeDays: item.expectedLeadTimeDays ?? null,
            drawingUrl: item.drawingUrl || null,
            notes: item.notes ?? null,
          })),
        },
      },
      include: {
        supplier: true,
        lineItems: true,
      },
    });

    return po;
  });

  await logAuditTrail(user.id, 'create', 'PurchaseOrder', purchaseOrder.id, null, {
    poNumber,
    supplierId: validated.supplierId,
    lineItemCount: validated.lineItems.length,
    totalValue,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'purchase_order_created',
        purchaseOrderId: purchaseOrder.id,
        poNumber,
        supplierId: validated.supplierId,
        totalValue,
        lineItemCount: validated.lineItems.length,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/purchase-orders');
  revalidatePath('/dashboard');
  return purchaseOrder;
}

// ── Get Purchase Orders (list) ────────────────────────────────────
export async function getPurchaseOrders(filters?: {
  status?: string;
  supplierId?: string;
}) {
  await requireRole(['admin', 'supervisor']);

  const where: Record<string, unknown> = {};
  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status;
  }
  if (filters?.supplierId && filters.supplierId !== 'all') {
    where.supplierId = filters.supplierId;
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          supplierId: true,
        },
      },
      _count: {
        select: {
          lineItems: true,
        },
      },
    },
    orderBy: { orderDate: 'desc' },
  });

  return purchaseOrders;
}

// ── Get Single Purchase Order (detail) ────────────────────────────
export async function getPurchaseOrder(id: string) {
  await requireRole(['admin', 'supervisor']);

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lineItems: {
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  if (!purchaseOrder) {
    throw new Error('Purchase order not found');
  }

  return purchaseOrder;
}

// ── Update Purchase Order Status ──────────────────────────────────
export async function updatePurchaseOrderStatus(id: string, newStatus: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, poNumber: true, status: true },
  });

  if (!existing) {
    throw new Error('Purchase order not found');
  }

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: newStatus },
  });

  await logAuditTrail(user.id, 'update', 'PurchaseOrder', id, {
    status: existing.status,
  }, {
    status: newStatus,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'purchase_order_status_changed',
        purchaseOrderId: id,
        poNumber: existing.poNumber,
        previousStatus: existing.status,
        newStatus,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/purchase-orders');
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath('/dashboard');
  return po;
}

// ── Submit Purchase Order ─────────────────────────────────────────
export async function submitPurchaseOrder(id: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { _count: { select: { lineItems: true } } },
  });

  if (!existing) {
    throw new Error('Purchase order not found');
  }

  if (existing.status !== 'draft') {
    throw new Error(`Cannot submit a PO with status "${existing.status}". Only draft POs can be submitted.`);
  }

  if (existing._count.lineItems === 0) {
    throw new Error('Cannot submit a PO with no line items');
  }

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'submitted' },
  });

  await logAuditTrail(user.id, 'update', 'PurchaseOrder', id, {
    status: 'draft',
  }, {
    status: 'submitted',
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'purchase_order_submitted',
        purchaseOrderId: id,
        poNumber: existing.poNumber,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/purchase-orders');
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath('/dashboard');
  return po;
}

// ── Cancel Purchase Order ─────────────────────────────────────────
export async function cancelPurchaseOrder(id: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, poNumber: true, status: true },
  });

  if (!existing) {
    throw new Error('Purchase order not found');
  }

  if (existing.status === 'cancelled') {
    throw new Error('Purchase order is already cancelled');
  }

  if (existing.status === 'closed') {
    throw new Error('Cannot cancel a closed purchase order');
  }

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  await logAuditTrail(user.id, 'update', 'PurchaseOrder', id, {
    status: existing.status,
  }, {
    status: 'cancelled',
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: {
        action: 'purchase_order_cancelled',
        purchaseOrderId: id,
        poNumber: existing.poNumber,
        previousStatus: existing.status,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/purchase-orders');
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath('/dashboard');
  return po;
}

// ── Add Line Item to Draft PO ─────────────────────────────────────
export async function addLineItem(poId: string, data: LineItemInput) {
  const user = await requireRole(['admin', 'supervisor']);
  const validated = validate(addLineItemSchema, data);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, poNumber: true, status: true },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  if (po.status !== 'draft') {
    throw new Error('Can only add line items to draft purchase orders');
  }

  const lineItem = await prisma.purchaseOrderLineItem.create({
    data: {
      purchaseOrderId: poId,
      lineNumber: validated.lineNumber,
      partNumber: validated.partNumber,
      partRevision: validated.partRevision ?? 'A',
      supplierPartNumber: validated.supplierPartNumber ?? null,
      description: validated.description ?? null,
      qtyOrdered: validated.qtyOrdered,
      qtyReceived: 0,
      unitOfMeasure: validated.unitOfMeasure,
      unitCost: validated.unitCost ?? null,
      totalCost: validated.unitCost ? validated.unitCost * validated.qtyOrdered : null,
      countryOfOrigin: validated.countryOfOrigin ?? null,
      expectedLeadTimeDays: validated.expectedLeadTimeDays ?? null,
      drawingUrl: validated.drawingUrl || null,
      notes: validated.notes ?? null,
    },
  });

  // Recalculate PO total
  const allItems = await prisma.purchaseOrderLineItem.findMany({
    where: { purchaseOrderId: poId },
    select: { totalCost: true },
  });
  const totalValue = allItems.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { totalValue },
  });

  await logAuditTrail(user.id, 'update', 'PurchaseOrder', poId, null, {
    action: 'line_item_added',
    lineNumber: validated.lineNumber,
    partNumber: validated.partNumber,
    qtyOrdered: validated.qtyOrdered,
  });

  revalidatePath('/admin/purchase-orders');
  revalidatePath(`/admin/purchase-orders/${poId}`);
  return lineItem;
}

// ── Remove Line Item from Draft PO ────────────────────────────────
export async function removeLineItem(lineItemId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const lineItem = await prisma.purchaseOrderLineItem.findUnique({
    where: { id: lineItemId },
    include: {
      purchaseOrder: {
        select: { id: true, poNumber: true, status: true },
      },
    },
  });

  if (!lineItem) {
    throw new Error('Line item not found');
  }

  if (lineItem.purchaseOrder.status !== 'draft') {
    throw new Error('Can only remove line items from draft purchase orders');
  }

  await prisma.purchaseOrderLineItem.delete({
    where: { id: lineItemId },
  });

  // Recalculate PO total
  const remainingItems = await prisma.purchaseOrderLineItem.findMany({
    where: { purchaseOrderId: lineItem.purchaseOrderId },
    select: { totalCost: true },
  });
  const totalValue = remainingItems.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);

  await prisma.purchaseOrder.update({
    where: { id: lineItem.purchaseOrderId },
    data: { totalValue },
  });

  await logAuditTrail(user.id, 'update', 'PurchaseOrder', lineItem.purchaseOrderId, {
    action: 'line_item_removed',
    lineNumber: lineItem.lineNumber,
    partNumber: lineItem.partNumber,
  }, null);

  revalidatePath('/admin/purchase-orders');
  revalidatePath(`/admin/purchase-orders/${lineItem.purchaseOrderId}`);
}

// ── Search Parts (for line item creation) ─────────────────────────
export async function searchParts(query: string) {
  await requireRole(['admin', 'supervisor']);

  if (!query || query.length < 1) {
    return [];
  }

  const parts = await prisma.partMaster.findMany({
    where: {
      AND: [
        { status: 'active' },
        {
          OR: [
            { partNumber: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      partNumber: true,
      name: true,
      revision: true,
      unitOfMeasure: true,
      standardCost: true,
    },
    take: 20,
    orderBy: { partNumber: 'asc' },
  });

  return parts;
}
