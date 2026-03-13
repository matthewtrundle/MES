'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

export interface AuditLogFilters {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  timestamp: Date;
  user: {
    name: string;
    email: string;
  };
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogStats {
  totalEntries: number;
  byAction: { action: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
  mostActiveUsers: { userId: string; userName: string; count: number }[];
}

export async function getAuditLogs(filters?: AuditLogFilters): Promise<PaginatedAuditLogs> {
  await requireRole(['admin']);

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters?.entityId) {
    where.entityId = { contains: filters.entityId, mode: 'insensitive' };
  }
  if (filters?.action) {
    where.action = filters.action;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    where.timestamp = {};
    if (filters?.dateFrom) {
      (where.timestamp as Record<string, unknown>).gte = new Date(filters.dateFrom);
    }
    if (filters?.dateTo) {
      // End of day for dateTo
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      (where.timestamp as Record<string, unknown>).lte = endDate;
    }
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: data as AuditLogEntry[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getAuditLogEntry(id: string): Promise<AuditLogEntry | null> {
  await requireRole(['admin']);

  const entry = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return entry as AuditLogEntry | null;
}

export async function getAuditLogStats(): Promise<AuditLogStats> {
  await requireRole(['admin']);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFilter = { timestamp: { gte: thirtyDaysAgo } };

  const [totalEntries, byAction, byEntityType, activeUsers] = await Promise.all([
    prisma.auditLog.count({ where: dateFilter }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: dateFilter,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.auditLog.groupBy({
      by: ['entityType'],
      where: dateFilter,
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: dateFilter,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    }),
  ]);

  // Fetch user names for most active users
  const userIds = activeUsers.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  return {
    totalEntries,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count.action })),
    byEntityType: byEntityType.map((e) => ({
      entityType: e.entityType,
      count: e._count.entityType,
    })),
    mostActiveUsers: activeUsers.map((u) => ({
      userId: u.userId,
      userName: userNameMap.get(u.userId) ?? 'Unknown',
      count: u._count.userId,
    })),
  };
}

export async function getAuditLogFilterOptions(): Promise<{
  entityTypes: string[];
  actions: string[];
  users: { id: string; name: string }[];
}> {
  await requireRole(['admin']);

  const [entityTypes, actions, users] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    entityTypes: entityTypes.map((e) => e.entityType),
    actions: actions.map((a) => a.action),
    users,
  };
}
