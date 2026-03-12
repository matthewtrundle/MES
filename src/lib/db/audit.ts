import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

/**
 * Log an audit trail entry for admin CRUD operations
 */
export async function logAuditTrail(
  userId: string,
  action: 'create' | 'update' | 'delete' | 'config_change',
  entityType: string,
  entityId: string,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      beforeJson: (before ?? null) as Prisma.InputJsonValue,
      afterJson: (after ?? null) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get audit log entries for an entity
 */
export async function getAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { timestamp: 'desc' },
  });
}
