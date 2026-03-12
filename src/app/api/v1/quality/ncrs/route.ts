import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/quality/ncrs
 * List NCRs with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['quality:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const status = searchParams.get('status');
    const disposition = searchParams.get('disposition');
    const source = searchParams.get('source');
    const defectType = searchParams.get('defectType');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (disposition) {
      where.disposition = disposition;
    }

    if (source) {
      where.source = source;
    }

    if (defectType) {
      where.defectType = { contains: defectType, mode: 'insensitive' };
    }

    const [ncrs, total] = await Promise.all([
      prisma.nonconformanceRecord.findMany({
        where,
        include: {
          unit: {
            select: {
              id: true,
              serialNumber: true,
              workOrder: {
                select: { id: true, orderNumber: true },
              },
            },
          },
          station: { select: { id: true, name: true } },
          materialLot: {
            select: { id: true, lotNumber: true, materialCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.nonconformanceRecord.count({ where }),
    ]);

    return Response.json({
      data: ncrs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
