'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';

export async function getPartMasters() {
  await requireRole(['admin']);

  const parts = await prisma.partMaster.findMany({
    include: {
      suppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              supplierId: true,
            },
          },
        },
      },
    },
    orderBy: { partNumber: 'asc' },
  });

  return parts;
}

export async function getPartMaster(id: string) {
  await requireRole(['admin']);

  const part = await prisma.partMaster.findUnique({
    where: { id },
    include: {
      suppliers: {
        include: {
          supplier: true,
        },
      },
    },
  });

  if (!part) {
    throw new Error('Part not found');
  }

  return part;
}

export async function createPartMaster(data: {
  partNumber: string;
  name: string;
  description?: string;
  revision?: string;
  category: string;
  unitOfMeasure?: string;
  countryOfOrigin?: string;
  reorderPoint?: number;
  targetStockLevel?: number;
  standardCost?: number;
  serializationType?: string;
  hazardous?: boolean;
  hazardousNotes?: string;
}) {
  const user = await requireRole(['admin']);

  const part = await prisma.partMaster.create({
    data: {
      partNumber: data.partNumber,
      name: data.name,
      description: data.description ?? null,
      revision: data.revision ?? 'A',
      category: data.category,
      unitOfMeasure: data.unitOfMeasure ?? 'EA',
      countryOfOrigin: data.countryOfOrigin ?? null,
      reorderPoint: data.reorderPoint ?? null,
      targetStockLevel: data.targetStockLevel ?? null,
      standardCost: data.standardCost ?? null,
      serializationType: data.serializationType ?? 'none',
      hazardous: data.hazardous ?? false,
      hazardousNotes: data.hazardousNotes ?? null,
      status: 'active',
    },
  });

  await logAuditTrail(user.id, 'create', 'PartMaster', part.id, null, {
    partNumber: data.partNumber,
    name: data.name,
    category: data.category,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'part_master_created', partId: part.id, partNumber: data.partNumber },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/parts');
  revalidatePath('/dashboard');

  return part;
}

export async function updatePartMaster(
  id: string,
  data: {
    partNumber?: string;
    name?: string;
    description?: string;
    revision?: string;
    category?: string;
    unitOfMeasure?: string;
    countryOfOrigin?: string;
    reorderPoint?: number | null;
    targetStockLevel?: number | null;
    standardCost?: number | null;
    serializationType?: string;
    hazardous?: boolean;
    hazardousNotes?: string;
    status?: string;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.partMaster.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Part not found');
  }

  const part = await prisma.partMaster.update({
    where: { id },
    data,
  });

  await logAuditTrail(user.id, 'update', 'PartMaster', id, {
    partNumber: existing.partNumber,
    name: existing.name,
    category: existing.category,
    status: existing.status,
  }, data);

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'part_master_updated', partId: id, changes: JSON.parse(JSON.stringify(data)) },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/parts');
  revalidatePath('/dashboard');

  return part;
}

export async function searchParts(query: string) {
  await requireRole(['admin']);

  if (!query || query.trim().length === 0) {
    return getPartMasters();
  }

  const parts = await prisma.partMaster.findMany({
    where: {
      OR: [
        { partNumber: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      suppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              supplierId: true,
            },
          },
        },
      },
    },
    orderBy: { partNumber: 'asc' },
  });

  return parts;
}

export async function linkPartSupplier(data: {
  partId: string;
  supplierId: string;
  supplierPartNumber?: string;
  isPreferred?: boolean;
  unitCost?: number;
  leadTimeDays?: number;
}) {
  const user = await requireRole(['admin']);

  const partSupplier = await prisma.partSupplier.create({
    data: {
      partId: data.partId,
      supplierId: data.supplierId,
      supplierPartNumber: data.supplierPartNumber ?? null,
      isPreferred: data.isPreferred ?? false,
      unitCost: data.unitCost ?? null,
      leadTimeDays: data.leadTimeDays ?? null,
    },
  });

  await logAuditTrail(user.id, 'create', 'PartSupplier', partSupplier.id, null, {
    partId: data.partId,
    supplierId: data.supplierId,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'part_supplier_linked', partId: data.partId, supplierId: data.supplierId },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/parts');
  revalidatePath('/dashboard');

  return partSupplier;
}

export async function unlinkPartSupplier(partId: string, supplierId: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.partSupplier.findUnique({
    where: { partId_supplierId: { partId, supplierId } },
  });

  if (!existing) {
    throw new Error('Part-Supplier link not found');
  }

  await prisma.partSupplier.delete({
    where: { partId_supplierId: { partId, supplierId } },
  });

  await logAuditTrail(user.id, 'delete', 'PartSupplier', existing.id, {
    partId,
    supplierId,
  }, null);

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'part_supplier_unlinked', partId, supplierId },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/parts');
  revalidatePath('/dashboard');
}
