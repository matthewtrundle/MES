import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/shipments/:id
 * Get shipment details (a shipped work order with its units)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(request, ['shipments:read']);

    const { id } = await params;

    const shipment = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        units: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            createdAt: true,
            eolTestResults: {
              select: {
                id: true,
                compositeResult: true,
                testedAt: true,
              },
              orderBy: { testedAt: 'desc' },
            },
          },
          orderBy: { serialNumber: 'asc' },
        },
      },
    });

    if (!shipment) {
      return Response.json(
        { error: 'Shipment not found' },
        { status: 404 }
      );
    }

    if (shipment.status !== 'shipped') {
      return Response.json(
        { error: 'Work order has not been shipped' },
        { status: 404 }
      );
    }

    return Response.json({
      data: {
        id: shipment.id,
        orderNumber: shipment.orderNumber,
        productCode: shipment.productCode,
        productName: shipment.productName,
        qtyOrdered: shipment.qtyOrdered,
        qtyCompleted: shipment.qtyCompleted,
        qtyScrap: shipment.qtyScrap,
        customerName: shipment.customerName,
        customerOrderRef: shipment.customerOrderRef,
        shippedAt: shipment.shippedAt,
        completedAt: shipment.completedAt,
        site: shipment.site,
        units: shipment.units,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
