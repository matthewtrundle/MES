'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validate, uuid, positiveNumber } from '@/lib/validation/schemas';

const assemblyGroupEnum = z.enum([
  'stator',
  'rotor',
  'wire_harness',
  'base',
  'final_assembly',
]);

const createBomItemSchema = z.object({
  routingId: uuid,
  stationId: uuid,
  materialCode: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  qtyPerUnit: positiveNumber,
  unitOfMeasure: z.string().min(1).max(10).default('EA'),
  assemblyGroup: assemblyGroupEnum.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateBomItemSchema = z.object({
  id: uuid,
  materialCode: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  qtyPerUnit: positiveNumber.optional(),
  unitOfMeasure: z.string().min(1).max(10).optional(),
  assemblyGroup: assemblyGroupEnum.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

/**
 * Get BOM items for a routing
 */
export async function getBomForRouting(routingId: string) {
  await requireRole(['admin', 'supervisor']);

  const items = await prisma.billOfMaterial.findMany({
    where: { routingId },
    include: {
      station: {
        select: { id: true, name: true, sequenceOrder: true },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { station: { sequenceOrder: 'asc' } },
      { materialCode: 'asc' },
    ],
  });

  return items;
}

/**
 * Get BOM items for a routing grouped by assembly group
 */
export async function getBomByGroup(routingId: string) {
  await requireRole(['admin', 'supervisor']);

  const items = await prisma.billOfMaterial.findMany({
    where: { routingId },
    include: {
      station: {
        select: { id: true, name: true, sequenceOrder: true },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { station: { sequenceOrder: 'asc' } },
      { materialCode: 'asc' },
    ],
  });

  // Group by assemblyGroup
  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    const group = item.assemblyGroup || 'ungrouped';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  }

  return grouped;
}

/**
 * Get BOM items needed at a specific station for a routing
 */
export async function getBomForStation(routingId: string, stationId: string) {
  const items = await prisma.billOfMaterial.findMany({
    where: {
      routingId,
      stationId,
      active: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { materialCode: 'asc' },
    ],
  });

  return items;
}

/**
 * Create a BOM item
 */
export async function createBomItem(data: z.infer<typeof createBomItemSchema>) {
  const validated = validate(createBomItemSchema, data);
  const user = await requireRole(['admin']);

  // Verify routing and station exist
  const [routing, station] = await Promise.all([
    prisma.routing.findUnique({ where: { id: validated.routingId } }),
    prisma.station.findUnique({ where: { id: validated.stationId } }),
  ]);

  if (!routing) throw new Error('Routing not found');
  if (!station) throw new Error('Station not found');

  const item = await prisma.billOfMaterial.create({
    data: {
      routingId: validated.routingId,
      stationId: validated.stationId,
      materialCode: validated.materialCode,
      description: validated.description,
      qtyPerUnit: validated.qtyPerUnit,
      unitOfMeasure: validated.unitOfMeasure,
      assemblyGroup: validated.assemblyGroup ?? null,
      sortOrder: validated.sortOrder ?? 0,
    },
  });

  await logAuditTrail(user.id, 'create', 'BillOfMaterial', item.id, null, { materialCode: validated.materialCode, qtyPerUnit: validated.qtyPerUnit, assemblyGroup: validated.assemblyGroup });
  await emitEvent({
    eventType: 'config_changed',
    siteId: station.siteId,
    operatorId: user.id,
    payload: { action: 'bom_item_created', bomId: item.id, materialCode: validated.materialCode, routingId: validated.routingId, assemblyGroup: validated.assemblyGroup },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/bom');
  revalidatePath('/dashboard');
  return item;
}

/**
 * Update a BOM item
 */
export async function updateBomItem(data: z.infer<typeof updateBomItemSchema>) {
  const validated = validate(updateBomItemSchema, data);
  const user = await requireRole(['admin']);

  const existing = await prisma.billOfMaterial.findUnique({
    where: { id: validated.id },
    include: { station: { select: { siteId: true } } },
  });

  if (!existing) throw new Error('BOM item not found');

  const { id, ...updateData } = validated;
  const item = await prisma.billOfMaterial.update({
    where: { id },
    data: updateData,
  });

  await logAuditTrail(user.id, 'update', 'BillOfMaterial', id, { materialCode: existing.materialCode, qtyPerUnit: existing.qtyPerUnit }, updateData);
  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.station.siteId,
    operatorId: user.id,
    payload: { action: 'bom_item_updated', bomId: id, materialCode: item.materialCode },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/bom');
  revalidatePath('/dashboard');
  return item;
}

/**
 * Delete a BOM item
 */
export async function deleteBomItem(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.billOfMaterial.findUnique({
    where: { id },
    include: { station: { select: { siteId: true } } },
  });

  if (!existing) throw new Error('BOM item not found');

  await prisma.billOfMaterial.delete({
    where: { id },
  });

  await logAuditTrail(user.id, 'delete', 'BillOfMaterial', id, { materialCode: existing.materialCode, qtyPerUnit: existing.qtyPerUnit }, null);
  await emitEvent({
    eventType: 'config_changed',
    siteId: existing.station.siteId,
    operatorId: user.id,
    payload: { action: 'bom_item_deleted', bomId: id, materialCode: existing.materialCode },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/bom');
  revalidatePath('/dashboard');
}

/**
 * Get all routings with their BOM item counts (only active, non-superseded)
 */
export async function getRoutingsWithBom() {
  await requireRole(['admin', 'supervisor']);

  const routings = await prisma.routing.findMany({
    where: {
      active: true,
      supersededById: null, // Only show current (non-superseded) routings
    },
    include: {
      _count: {
        select: { bom: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return routings;
}

/**
 * Get routing details including revision info
 */
export async function getRoutingWithRevision(routingId: string) {
  await requireRole(['admin', 'supervisor']);

  const routing = await prisma.routing.findUnique({
    where: { id: routingId },
    include: {
      _count: { select: { bom: true } },
    },
  });

  return routing;
}

/**
 * Increment revision letter: A -> B -> ... -> Z -> AA -> AB ...
 */
function incrementRevision(rev: string): string {
  const chars = rev.split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
  }
  return 'A' + chars.join('');
}

/**
 * Create a new BOM revision by copying all BOM lines to a new routing.
 * The old routing is marked as superseded.
 */
export async function createBomRevision(routingId: string) {
  const user = await requireRole(['admin']);

  const currentRouting = await prisma.routing.findUnique({
    where: { id: routingId },
    include: {
      bom: true,
    },
  });

  if (!currentRouting) throw new Error('Routing not found');
  if (!currentRouting.active) throw new Error('Cannot create revision from inactive routing');

  const nextRevision = incrementRevision(currentRouting.revision);

  // Create new routing with copied data and incremented revision
  const newRouting = await prisma.routing.create({
    data: {
      name: currentRouting.name,
      description: currentRouting.description,
      productCode: currentRouting.productCode,
      operations: currentRouting.operations as object,
      revision: nextRevision,
      effectiveDate: new Date(),
      active: true,
    },
  });

  // Copy all BOM lines to the new routing
  if (currentRouting.bom.length > 0) {
    await prisma.billOfMaterial.createMany({
      data: currentRouting.bom.map((item) => ({
        routingId: newRouting.id,
        stationId: item.stationId,
        materialCode: item.materialCode,
        description: item.description,
        qtyPerUnit: item.qtyPerUnit,
        unitOfMeasure: item.unitOfMeasure,
        assemblyGroup: item.assemblyGroup,
        sortOrder: item.sortOrder,
        active: item.active,
      })),
    });
  }

  // Mark old routing as superseded (but keep it active for existing work orders)
  await prisma.routing.update({
    where: { id: routingId },
    data: {
      supersededById: newRouting.id,
      active: false,
    },
  });

  // Get a siteId for the event from one of the stations in the BOM, or fallback
  let siteId = 'system';
  if (currentRouting.bom.length > 0) {
    const station = await prisma.station.findUnique({
      where: { id: currentRouting.bom[0].stationId },
      select: { siteId: true },
    });
    if (station) siteId = station.siteId;
  }

  await logAuditTrail(user.id, 'create', 'Routing', newRouting.id, null, {
    action: 'bom_revision_created',
    previousRoutingId: routingId,
    previousRevision: currentRouting.revision,
    newRevision: nextRevision,
  });

  await emitEvent({
    eventType: 'config_changed',
    siteId,
    operatorId: user.id,
    payload: {
      action: 'bom_revision_created',
      previousRoutingId: routingId,
      newRoutingId: newRouting.id,
      previousRevision: currentRouting.revision,
      newRevision: nextRevision,
      bomItemsCopied: currentRouting.bom.length,
    },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/bom');
  revalidatePath('/dashboard');
  return newRouting;
}

/**
 * Get revision history for a routing (follow the supersededBy chain both directions)
 */
export async function getBomHistory(routingId: string) {
  await requireRole(['admin', 'supervisor']);

  const routing = await prisma.routing.findUnique({
    where: { id: routingId },
  });

  if (!routing) throw new Error('Routing not found');

  // Collect all revisions by following chains in both directions
  const revisions: Array<{
    id: string;
    revision: string;
    effectiveDate: Date | null;
    active: boolean;
    productCode: string;
    name: string;
    createdAt: Date;
    isCurrent: boolean;
  }> = [];

  // Walk backward: find earlier revisions (those that point to us or our chain)
  // We find all routings with same name+productCode to handle the full chain
  const allVersions = await prisma.routing.findMany({
    where: {
      productCode: routing.productCode,
      name: routing.name,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { bom: true } },
    },
  });

  for (const ver of allVersions) {
    revisions.push({
      id: ver.id,
      revision: ver.revision,
      effectiveDate: ver.effectiveDate,
      active: ver.active,
      productCode: ver.productCode,
      name: ver.name,
      createdAt: ver.createdAt,
      isCurrent: ver.supersededById === null && ver.active,
    });
  }

  return revisions;
}
