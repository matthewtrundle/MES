'use server';

import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { requireRole } from '@/lib/auth/rbac';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import {
  createShipmentSchema,
  type CreateShipmentInput,
  type ShipmentFilterInput,
} from '@/lib/validation/shipping-schemas';

// ── Get next shipment number ────────────────────────────────────
async function getNextShipmentNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SHP-${year}-`;

  const lastShipment = await tx.shipment.findFirst({
    where: {
      shipmentNumber: { startsWith: prefix },
    },
    orderBy: { shipmentNumber: 'desc' },
    select: { shipmentNumber: true },
  });

  let sequence = 1;
  if (lastShipment) {
    const lastSeq = parseInt(lastShipment.shipmentNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// ── Get Shippable Work Orders ───────────────────────────────────

/**
 * Find work orders with status "completed" that have units ready to ship.
 */
export async function getShippableWorkOrders() {
  await requireRole(['admin', 'supervisor']);

  const workOrders = await prisma.workOrder.findMany({
    where: {
      status: 'completed',
    },
    include: {
      site: { select: { id: true, name: true } },
      units: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
        },
      },
      shipments: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          lines: {
            select: { unitId: true },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  // Filter to only WOs that have unshipped completed units
  return workOrders.filter((wo) => {
    const shippedUnitIds = new Set(
      wo.shipments.flatMap((s) => s.lines.map((l) => l.unitId))
    );
    const unshippedUnits = wo.units.filter(
      (u) => u.status === 'completed' && !shippedUnitIds.has(u.id)
    );
    return unshippedUnits.length > 0;
  }).map((wo) => {
    const shippedUnitIds = new Set(
      wo.shipments.flatMap((s) => s.lines.map((l) => l.unitId))
    );
    const unshippedUnits = wo.units.filter(
      (u) => u.status === 'completed' && !shippedUnitIds.has(u.id)
    );
    return {
      ...wo,
      unshippedUnitCount: unshippedUnits.length,
      totalUnitCount: wo.units.length,
      completedUnitCount: wo.units.filter((u) => u.status === 'completed').length,
    };
  });
}

// ── Get Work Order Shipping Details ─────────────────────────────

/**
 * Get detailed WO info with units, serial numbers, customer info, and EOL results.
 */
export async function getWorkOrderShippingDetails(workOrderId: string) {
  await requireRole(['admin', 'supervisor']);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      site: { select: { id: true, name: true } },
      units: {
        include: {
          eolTestResults: {
            select: {
              id: true,
              compositeResult: true,
              testedAt: true,
              notes: true,
            },
            orderBy: { testedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { serialNumber: 'asc' },
      },
      shipments: {
        include: {
          lines: {
            select: { unitId: true, serialNumber: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  // Determine which units are already shipped
  const shippedUnitIds = new Set(
    workOrder.shipments.flatMap((s) => s.lines.map((l) => l.unitId))
  );

  const unitsWithShipStatus = workOrder.units.map((unit) => ({
    ...unit,
    alreadyShipped: shippedUnitIds.has(unit.id),
    eolResult: unit.eolTestResults[0] ?? null,
  }));

  return {
    ...workOrder,
    units: unitsWithShipStatus,
  };
}

// ── Create Shipment ─────────────────────────────────────────────

/**
 * Create a new shipment with lines, validating all units are completed.
 */
export async function createShipment(data: CreateShipmentInput) {
  const user = await requireRole(['admin', 'supervisor']);
  const validated = createShipmentSchema.parse(data);

  const site = await prisma.site.findFirst();
  if (!site) {
    throw new Error('No site configured');
  }

  const result = await prisma.$transaction(async (tx) => {
    const shipmentNumber = await getNextShipmentNumber(tx);
    // Verify work order exists and is completed
    const workOrder = await tx.workOrder.findUnique({
      where: { id: validated.workOrderId },
      select: { id: true, orderNumber: true, status: true, customerName: true },
    });

    if (!workOrder) {
      throw new Error('Work order not found');
    }

    if (workOrder.status !== 'completed' && workOrder.status !== 'shipped') {
      throw new Error(
        `Work order ${workOrder.orderNumber} must be completed before shipping (current status: ${workOrder.status})`
      );
    }

    // Verify all units exist and are in a shippable state
    const unitIds = validated.lines.map((l) => l.unitId);
    const units = await tx.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, serialNumber: true, status: true, workOrderId: true },
    });

    if (units.length !== unitIds.length) {
      const foundIds = new Set(units.map((u) => u.id));
      const missingIds = unitIds.filter((id) => !foundIds.has(id));
      throw new Error(`Units not found: ${missingIds.join(', ')}`);
    }

    // Check all units belong to this work order
    const wrongWoUnits = units.filter((u) => u.workOrderId !== validated.workOrderId);
    if (wrongWoUnits.length > 0) {
      throw new Error(
        `Units ${wrongWoUnits.map((u) => u.serialNumber).join(', ')} do not belong to this work order`
      );
    }

    // Check all units are completed (not already shipped, scrapped, etc.)
    const nonCompletedUnits = units.filter((u) => u.status !== 'completed');
    if (nonCompletedUnits.length > 0) {
      throw new Error(
        `Units ${nonCompletedUnits.map((u) => u.serialNumber).join(', ')} are not in completed status`
      );
    }

    // Check units aren't already in another shipment
    const existingShipmentLines = await tx.shipmentLine.findMany({
      where: { unitId: { in: unitIds } },
      include: {
        shipment: { select: { shipmentNumber: true, status: true } },
      },
    });

    if (existingShipmentLines.length > 0) {
      const alreadyShipped = existingShipmentLines.map(
        (sl) => `${sl.serialNumber} (${sl.shipment.shipmentNumber})`
      );
      throw new Error(
        `Units already in shipments: ${alreadyShipped.join(', ')}`
      );
    }

    // Create the shipment
    const shipment = await tx.shipment.create({
      data: {
        shipmentNumber,
        workOrderId: validated.workOrderId,
        customerName: validated.customerName,
        customerAddress: validated.customerAddress ?? null,
        carrier: validated.carrier ?? null,
        trackingNumber: validated.trackingNumber ?? null,
        totalBoxes: validated.totalBoxes ?? null,
        totalWeight: validated.totalWeight ?? null,
        weightUnit: validated.weightUnit,
        specialNotes: validated.specialNotes ?? null,
        status: 'pending',
        lines: {
          create: validated.lines.map((line) => ({
            unitId: line.unitId,
            serialNumber: line.serialNumber,
            boxNumber: line.boxNumber ?? null,
          })),
        },
      },
      include: {
        lines: true,
        workOrder: { select: { orderNumber: true } },
      },
    });

    return shipment;
  });

  // Emit event
  await emitEvent({
    eventType: 'shipment_created',
    siteId: site.id,
    workOrderId: validated.workOrderId,
    operatorId: user.id,
    payload: {
      shipmentId: result.id,
      shipmentNumber: result.shipmentNumber,
      workOrderNumber: result.workOrder.orderNumber,
      customerName: validated.customerName,
      unitCount: validated.lines.length,
      carrier: validated.carrier ?? null,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  await logAuditTrail(user.id, 'create', 'Shipment', result.id, null, {
    shipmentNumber: result.shipmentNumber,
    workOrderId: validated.workOrderId,
    unitCount: validated.lines.length,
    customerName: validated.customerName,
  });

  revalidatePath('/admin/shipping');
  return result;
}

// ── Ship Shipment ───────────────────────────────────────────────

/**
 * Mark a shipment as shipped, transition units to 'shipped' status,
 * and update WO if all units are shipped.
 */
export async function shipShipment(shipmentId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const site = await prisma.site.findFirst();
  if (!site) {
    throw new Error('No site configured');
  }

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        lines: true,
        workOrder: {
          include: {
            units: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    if (shipment.status === 'shipped' || shipment.status === 'delivered') {
      throw new Error(`Shipment ${shipment.shipmentNumber} has already been shipped`);
    }

    // Update shipment status
    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'shipped',
        shipDate: new Date(),
        shippedById: user.id,
      },
    });

    // Update all units in this shipment to 'shipped'
    const unitIds = shipment.lines.map((l) => l.unitId);
    await tx.unit.updateMany({
      where: { id: { in: unitIds } },
      data: { status: 'shipped' },
    });

    // Check if ALL units in the work order are now shipped
    const allWoUnitIds = shipment.workOrder.units.map((u) => u.id);
    const shippedUnitIds = new Set(unitIds);

    // Get all other shipments for this WO to find other shipped units
    const otherShipments = await tx.shipment.findMany({
      where: {
        workOrderId: shipment.workOrderId,
        id: { not: shipmentId },
        status: { in: ['shipped', 'delivered'] },
      },
      include: { lines: { select: { unitId: true } } },
    });

    for (const s of otherShipments) {
      for (const l of s.lines) {
        shippedUnitIds.add(l.unitId);
      }
    }

    // If all non-scrapped units are shipped, update WO status
    const nonScrappedUnits = shipment.workOrder.units.filter(
      (u) => u.status !== 'scrapped'
    );
    // After our update, the units in this shipment are now 'shipped'
    // Re-check: are all non-scrapped units now shipped?
    const allShipped = nonScrappedUnits.every(
      (u) => shippedUnitIds.has(u.id) || u.status === 'shipped'
    );

    let woUpdated = false;
    if (allShipped) {
      await tx.workOrder.update({
        where: { id: shipment.workOrderId },
        data: {
          status: 'shipped',
          shippedAt: new Date(),
        },
      });
      woUpdated = true;
    }

    return {
      shipment: updatedShipment,
      shipmentNumber: shipment.shipmentNumber,
      workOrderId: shipment.workOrderId,
      workOrderNumber: shipment.workOrder.orderNumber,
      unitCount: unitIds.length,
      woUpdated,
    };
  });

  // Emit event
  await emitEvent({
    eventType: 'shipment_shipped',
    siteId: site.id,
    workOrderId: result.workOrderId,
    operatorId: user.id,
    payload: {
      shipmentId,
      shipmentNumber: result.shipmentNumber,
      workOrderNumber: result.workOrderNumber,
      unitCount: result.unitCount,
      workOrderFullyShipped: result.woUpdated,
      shippedById: user.id,
      shippedByName: user.name,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  if (result.woUpdated) {
    await emitEvent({
      eventType: 'work_order_shipped',
      siteId: site.id,
      workOrderId: result.workOrderId,
      operatorId: user.id,
      payload: {
        workOrderNumber: result.workOrderNumber,
        shipmentNumber: result.shipmentNumber,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  await logAuditTrail(user.id, 'update', 'Shipment', shipmentId, {
    status: 'pending',
  }, {
    status: 'shipped',
    shippedAt: new Date().toISOString(),
  });

  revalidatePath('/admin/shipping');
  return result;
}

// ── Get Shipments ───────────────────────────────────────────────

/**
 * List shipments with optional filtering and pagination.
 */
export async function getShipments(filters?: ShipmentFilterInput) {
  await requireRole(['admin', 'supervisor']);

  const where: Record<string, unknown> = {};
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.workOrderId) {
    where.workOrderId = filters.workOrderId;
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            productCode: true,
            productName: true,
            customerName: true,
          },
        },
        shippedBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    shipments,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── Get Shipment Details ────────────────────────────────────────

/**
 * Get full shipment details with lines, WO info, etc.
 */
export async function getShipmentDetails(shipmentId: string) {
  await requireRole(['admin', 'supervisor']);

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          productCode: true,
          productName: true,
          customerName: true,
          customerOrderRef: true,
          qtyOrdered: true,
          qtyCompleted: true,
        },
      },
      shippedBy: {
        select: { id: true, name: true, email: true },
      },
      lines: {
        orderBy: { boxNumber: 'asc' },
      },
    },
  });

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  return shipment;
}

// ── Generate Packing List ───────────────────────────────────────

/**
 * Generate structured packing list data for a shipment.
 */
export async function generatePackingList(shipmentId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      workOrder: {
        select: {
          orderNumber: true,
          productCode: true,
          productName: true,
          customerOrderRef: true,
        },
      },
      lines: {
        orderBy: [{ boxNumber: 'asc' }, { serialNumber: 'asc' }],
      },
    },
  });

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const site = await prisma.site.findFirst({
    select: { id: true, name: true },
  });

  const packingList = {
    shipmentNumber: shipment.shipmentNumber,
    shipDate: shipment.shipDate?.toISOString() ?? null,
    companyName: site?.name ?? 'MES Manufacturing',
    customerName: shipment.customerName,
    customerAddress: shipment.customerAddress,
    customerOrderRef: shipment.workOrder.customerOrderRef,
    workOrderNumber: shipment.workOrder.orderNumber,
    productCode: shipment.workOrder.productCode,
    productName: shipment.workOrder.productName,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    items: shipment.lines.map((line) => ({
      serialNumber: line.serialNumber,
      boxNumber: line.boxNumber,
    })),
    totalBoxes: shipment.totalBoxes,
    totalWeight: shipment.totalWeight,
    weightUnit: shipment.weightUnit,
    specialNotes: shipment.specialNotes,
    generatedAt: new Date().toISOString(),
  };

  // Emit event
  if (site) {
    await emitEvent({
      eventType: 'packing_list_generated',
      siteId: site.id,
      workOrderId: shipment.workOrderId,
      operatorId: user.id,
      payload: {
        shipmentId,
        shipmentNumber: shipment.shipmentNumber,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  return packingList;
}

// ── Generate Certificate of Conformance ─────────────────────────

/**
 * Generate structured CoC data with motor serials and EOL test results.
 */
export async function generateCertificateOfConformance(shipmentId: string) {
  const user = await requireRole(['admin', 'supervisor']);

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      workOrder: {
        select: {
          orderNumber: true,
          productCode: true,
          productName: true,
          customerOrderRef: true,
        },
      },
      lines: {
        orderBy: { serialNumber: 'asc' },
      },
    },
  });

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  // Get EOL test results for all units in this shipment
  const unitIds = shipment.lines.map((l) => l.unitId);
  const eolResults = await prisma.eolTestResult.findMany({
    where: { unitId: { in: unitIds } },
    select: {
      unitId: true,
      compositeResult: true,
      testedAt: true,
    },
    orderBy: { testedAt: 'desc' },
  });

  // Map to latest result per unit
  const latestEolByUnit = new Map<string, { compositeResult: string; testedAt: Date }>();
  for (const result of eolResults) {
    if (!latestEolByUnit.has(result.unitId)) {
      latestEolByUnit.set(result.unitId, {
        compositeResult: result.compositeResult,
        testedAt: result.testedAt,
      });
    }
  }

  const site = await prisma.site.findFirst({
    select: { id: true, name: true },
  });

  const coc = {
    shipmentNumber: shipment.shipmentNumber,
    shipDate: shipment.shipDate?.toISOString() ?? null,
    companyName: site?.name ?? 'MES Manufacturing',
    customerName: shipment.customerName,
    customerOrderRef: shipment.workOrder.customerOrderRef,
    workOrderNumber: shipment.workOrder.orderNumber,
    productCode: shipment.workOrder.productCode,
    productName: shipment.workOrder.productName,
    units: shipment.lines.map((line) => {
      const eol = latestEolByUnit.get(line.unitId);
      return {
        serialNumber: line.serialNumber,
        eolResult: eol?.compositeResult ?? 'not_tested',
        testedAt: eol?.testedAt?.toISOString() ?? null,
      };
    }),
    certificationStatement:
      'We hereby certify that the products listed above have been manufactured, inspected, and tested in accordance with our quality management system and applicable specifications. All units have passed end-of-line testing and meet the required performance criteria.',
    generatedAt: new Date().toISOString(),
    generatedBy: user.name,
  };

  // Emit event
  if (site) {
    await emitEvent({
      eventType: 'coc_generated',
      siteId: site.id,
      workOrderId: shipment.workOrderId,
      operatorId: user.id,
      payload: {
        shipmentId,
        shipmentNumber: shipment.shipmentNumber,
        unitCount: shipment.lines.length,
      },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  return coc;
}
