import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/inventory
 * List material lots with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['inventory:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const materialCode = searchParams.get('materialCode');
    const status = searchParams.get('status');
    const supplier = searchParams.get('supplier');
    const lotNumber = searchParams.get('lotNumber');

    const where: Record<string, unknown> = {};

    if (materialCode) {
      where.materialCode = { contains: materialCode, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (supplier) {
      where.supplier = { contains: supplier, mode: 'insensitive' };
    }

    if (lotNumber) {
      where.lotNumber = { contains: lotNumber, mode: 'insensitive' };
    }

    const [lots, total] = await Promise.all([
      prisma.materialLot.findMany({
        where,
        select: {
          id: true,
          lotNumber: true,
          materialCode: true,
          description: true,
          qtyReceived: true,
          qtyRemaining: true,
          qtyReserved: true,
          unitOfMeasure: true,
          supplier: true,
          purchaseOrderNumber: true,
          status: true,
          receivedAt: true,
          expiresAt: true,
          createdAt: true,
          supplierRef: {
            select: { id: true, name: true, supplierId: true },
          },
        },
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.materialLot.count({ where }),
    ]);

    return Response.json({
      data: lots,
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
