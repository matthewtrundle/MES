'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { uuid, positiveNumber } from '@/lib/validation/schemas';

const createBomItemSchema = z.object({
  routingId: uuid,
  stationId: uuid,
  materialCode: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  qtyPerUnit: positiveNumber,
  unitOfMeasure: z.string().min(1).max(10).default('EA'),
});

const updateBomItemSchema = z.object({
  id: uuid,
  materialCode: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  qtyPerUnit: positiveNumber.optional(),
  unitOfMeasure: z.string().min(1).max(10).optional(),
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
      { station: { sequenceOrder: 'asc' } },
      { materialCode: 'asc' },
    ],
  });

  return items;
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
    orderBy: { materialCode: 'asc' },
  });

  return items;
}

/**
 * Create a BOM item
 */
export async function createBomItem(data: z.infer<typeof createBomItemSchema>) {
  const validated = createBomItemSchema.parse(data);
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
    },
  });

  await logAuditTrail(user.id, 'create', 'BillOfMaterial', item.id, null, { materialCode: validated.materialCode, qtyPerUnit: validated.qtyPerUnit });
  await emitEvent({
    eventType: 'config_changed',
    siteId: station.siteId,
    operatorId: user.id,
    payload: { action: 'bom_item_created', bomId: item.id, materialCode: validated.materialCode, routingId: validated.routingId },
    source: 'ui',
    idempotencyKey: generateUniqueIdempotencyKey(),
  });

  revalidatePath('/admin/bom');
  return item;
}

/**
 * Update a BOM item
 */
export async function updateBomItem(data: z.infer<typeof updateBomItemSchema>) {
  const validated = updateBomItemSchema.parse(data);
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
}

/**
 * Get all routings with their BOM item counts
 */
export async function getRoutingsWithBom() {
  await requireRole(['admin', 'supervisor']);

  const routings = await prisma.routing.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { bom: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return routings;
}
