import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/units
 * List units with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['units:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const workOrderId = searchParams.get('workOrderId');
    const status = searchParams.get('status');
    const serialNumber = searchParams.get('serialNumber');

    const where: Record<string, unknown> = {};

    if (workOrderId) {
      where.workOrderId = workOrderId;
    }

    if (status) {
      where.status = status;
    }

    if (serialNumber) {
      where.serialNumber = { contains: serialNumber, mode: 'insensitive' };
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: {
          workOrder: {
            select: {
              id: true,
              orderNumber: true,
              productCode: true,
              productName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.unit.count({ where }),
    ]);

    return Response.json({
      data: units,
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
