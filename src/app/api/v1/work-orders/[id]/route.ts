import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/work-orders/:id
 * Get a single work order with units and operations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(request, ['work_orders:read']);

    const { id } = await params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        routing: {
          select: {
            id: true,
            name: true,
            operations: true,
          },
        },
        units: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            executions: {
              select: {
                id: true,
                operationId: true,
                stationId: true,
                startedAt: true,
                completedAt: true,
                cycleTimeMinutes: true,
                result: true,
              },
              orderBy: { startedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        operations: {
          include: {
            station: { select: { id: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
        _count: { select: { units: true } },
      },
    });

    if (!workOrder) {
      return Response.json(
        { error: 'Work order not found' },
        { status: 404 }
      );
    }

    return Response.json({ data: workOrder });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
