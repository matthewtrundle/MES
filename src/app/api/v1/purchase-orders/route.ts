import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/purchase-orders
 * List purchase orders with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['purchase_orders:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const poNumber = searchParams.get('poNumber');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (poNumber) {
      where.poNumber = { contains: poNumber, mode: 'insensitive' };
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, supplierId: true },
          },
          _count: { select: { lineItems: true } },
        },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return Response.json({
      data: purchaseOrders,
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
