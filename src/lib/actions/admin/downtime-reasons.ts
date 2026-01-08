'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import type { LossType } from '@/lib/types/downtime-reasons';

export async function getDowntimeReasonsForAdmin(siteId?: string) {
  await requireRole(['admin']);

  const reasons = await prisma.downtimeReason.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          downtimeIntervals: true,
        },
      },
    },
    orderBy: [{ siteId: 'asc' }, { code: 'asc' }],
  });

  return reasons;
}

export async function createDowntimeReason(data: {
  siteId: string;
  code: string;
  description: string;
  lossType: LossType;
  isPlanned: boolean;
}) {
  const user = await requireRole(['admin']);

  // Check for duplicate code in same site
  const existing = await prisma.downtimeReason.findUnique({
    where: {
      siteId_code: {
        siteId: data.siteId,
        code: data.code,
      },
    },
  });

  if (existing) {
    throw new Error(`A downtime reason with code "${data.code}" already exists for this site`);
  }

  const reason = await prisma.downtimeReason.create({
    data: {
      siteId: data.siteId,
      code: data.code,
      description: data.description,
      lossType: data.lossType,
      isPlanned: data.isPlanned,
      active: true,
    },
  });

  revalidatePath('/admin/downtime-reasons');
  revalidatePath('/station');

  return reason;
}

export async function updateDowntimeReason(
  id: string,
  data: {
    code?: string;
    description?: string;
    lossType?: LossType;
    isPlanned?: boolean;
    active?: boolean;
  }
) {
  const user = await requireRole(['admin']);

  const existing = await prisma.downtimeReason.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Downtime reason not found');
  }

  // If changing code, check for duplicates
  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.downtimeReason.findUnique({
      where: {
        siteId_code: {
          siteId: existing.siteId,
          code: data.code,
        },
      },
    });

    if (duplicate) {
      throw new Error(`A downtime reason with code "${data.code}" already exists for this site`);
    }
  }

  const reason = await prisma.downtimeReason.update({
    where: { id },
    data,
  });

  revalidatePath('/admin/downtime-reasons');
  revalidatePath('/station');

  return reason;
}

export async function deleteDowntimeReason(id: string) {
  const user = await requireRole(['admin']);

  const existing = await prisma.downtimeReason.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          downtimeIntervals: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Downtime reason not found');
  }

  // If reason has been used, soft delete (deactivate) instead of hard delete
  if (existing._count.downtimeIntervals > 0) {
    await prisma.downtimeReason.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.downtimeReason.delete({
      where: { id },
    });
  }

  revalidatePath('/admin/downtime-reasons');
  revalidatePath('/station');
}

export async function getSites() {
  await requireRole(['admin']);

  return prisma.site.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });
}
