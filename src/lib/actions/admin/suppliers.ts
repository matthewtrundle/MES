'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { revalidatePath } from 'next/cache';

export async function getSuppliers() {
  await requireRole(['admin']);

  const suppliers = await prisma.supplier.findMany({
    include: {
      _count: {
        select: {
          parts: true,
          materialLots: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return suppliers;
}

export async function getSupplier(id: string) {
  await requireRole(['admin']);

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      parts: {
        include: {
          part: {
            select: {
              id: true,
              partNumber: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          materialLots: true,
        },
      },
    },
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  return supplier;
}

export async function createSupplier(data: {
  name: string;
  supplierId: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  countryOfOrigin?: string;
  qualificationStatus?: string;
  notes?: string;
}) {
  const user = await requireRole(['admin']);

  const supplier = await prisma.supplier.create({
    data: {
      name: data.name,
      supplierId: data.supplierId,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      address: data.address ?? null,
      countryOfOrigin: data.countryOfOrigin ?? null,
      qualificationStatus: data.qualificationStatus ?? 'pending',
      notes: data.notes ?? null,
      active: true,
    },
  });

  await logAuditTrail(user.id, 'create', 'Supplier', supplier.id, null, {
    name: data.name,
    supplierId: data.supplierId,
  });

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'supplier_created', supplierId: supplier.id, name: data.name },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/suppliers');

  return supplier;
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    supplierId?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    countryOfOrigin?: string;
    qualificationStatus?: string;
    notes?: string;
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.supplier.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Supplier not found');
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data,
  });

  await logAuditTrail(user.id, 'update', 'Supplier', id, {
    name: existing.name,
    supplierId: existing.supplierId,
    qualificationStatus: existing.qualificationStatus,
    active: existing.active,
  }, data);

  const siteId = user.sites[0]?.id;
  if (siteId) {
    await emitEvent({
      eventType: 'config_changed',
      siteId,
      operatorId: user.id,
      payload: { action: 'supplier_updated', supplierId: id, changes: JSON.parse(JSON.stringify(data)) },
      source: 'ui',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });
  }

  revalidatePath('/admin/suppliers');

  return supplier;
}
