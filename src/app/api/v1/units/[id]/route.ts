import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/units/:id
 * Get a single unit with full traceability
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(request, ['units:read']);

    const { id } = await params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            productCode: true,
            productName: true,
            status: true,
            siteId: true,
          },
        },
        executions: {
          include: {
            operation: { select: { id: true, stationId: true, sequence: true } },
            station: { select: { id: true, name: true } },
            operator: { select: { id: true, name: true } },
          },
          orderBy: { startedAt: 'asc' },
        },
        materialConsumptions: {
          include: {
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
          orderBy: { timestamp: 'asc' },
        },
        qualityResults: {
          include: {
            definition: {
              select: { id: true, name: true, checkType: true },
            },
            operator: { select: { id: true, name: true } },
          },
          orderBy: { timestamp: 'asc' },
        },
        eolTestResults: {
          orderBy: { testedAt: 'asc' },
        },
        ncrs: {
          select: {
            id: true,
            ncrNumber: true,
            defectType: true,
            description: true,
            disposition: true,
            status: true,
            source: true,
            createdAt: true,
            closedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!unit) {
      return Response.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    return Response.json({ data: unit });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
