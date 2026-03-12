import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/shipments
 * List shipped work orders (shipments are tracked as work orders with status "shipped")
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['shipments:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const customerName = searchParams.get('customerName');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {
      status: 'shipped',
      shippedAt: { not: null },
    };

    if (customerName) {
      where.customerName = { contains: customerName, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      const shippedAtFilter: Record<string, Date> = {};
      if (dateFrom) shippedAtFilter.gte = new Date(dateFrom);
      if (dateTo) shippedAtFilter.lte = new Date(dateTo);
      where.shippedAt = shippedAtFilter;
    }

    const [shipments, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          productCode: true,
          productName: true,
          qtyOrdered: true,
          qtyCompleted: true,
          qtyScrap: true,
          customerName: true,
          customerOrderRef: true,
          shippedAt: true,
          completedAt: true,
          site: { select: { id: true, name: true } },
          _count: { select: { units: true } },
        },
        orderBy: { shippedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return Response.json({
      data: shipments,
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
