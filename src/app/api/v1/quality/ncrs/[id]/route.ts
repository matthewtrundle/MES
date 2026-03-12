import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/quality/ncrs/:id
 * Get a single NCR with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(request, ['quality:read']);

    const { id } = await params;

    const ncr = await prisma.nonconformanceRecord.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            workOrder: {
              select: {
                id: true,
                orderNumber: true,
                productCode: true,
                productName: true,
              },
            },
          },
        },
        station: { select: { id: true, name: true } },
        materialLot: {
          select: {
            id: true,
            lotNumber: true,
            materialCode: true,
            description: true,
            supplier: true,
          },
        },
      },
    });

    if (!ncr) {
      return Response.json(
        { error: 'NCR not found' },
        { status: 404 }
      );
    }

    return Response.json({ data: ncr });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
