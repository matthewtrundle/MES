import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateIdempotencyKey } from '@/lib/db/events';
import { requireRoleApi, HttpError } from '@/lib/auth/rbac';

/**
 * POST /api/ncr/[id]/disposition
 *
 * Disposition an NCR (Non-Conformance Record)
 *
 * RBAC: Only supervisors and admins can disposition NCRs
 * Operators will receive a 403 Forbidden response
 *
 * Request body:
 * {
 *   "disposition": "rework" | "scrap" | "use_as_is" | "defer"
 * }
 *
 * Response:
 * - 200: Success with updated NCR
 * - 400: Invalid request (bad disposition value)
 * - 401: Not authenticated
 * - 403: Forbidden (role not allowed)
 * - 404: NCR not found
 * - 409: NCR already dispositioned
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC check - throws HttpError with proper status code
    const user = await requireRoleApi(['supervisor', 'admin']);

    const { id: ncrId } = await params;

    // Parse request body
    const body = await request.json();
    const { disposition } = body;

    // Validate disposition value
    const validDispositions = ['rework', 'scrap', 'use_as_is', 'defer'];
    if (!disposition || !validDispositions.includes(disposition)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: `Invalid disposition. Must be one of: ${validDispositions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Find NCR with related data
    const ncr = await prisma.nonconformanceRecord.findUnique({
      where: { id: ncrId },
      include: {
        unit: {
          include: {
            workOrder: true,
          },
        },
        station: true,
      },
    });

    if (!ncr) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'NCR not found',
        },
        { status: 404 }
      );
    }

    if (ncr.status !== 'open') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'NCR has already been dispositioned',
        },
        { status: 409 }
      );
    }

    // Update NCR
    const updatedNCR = await prisma.nonconformanceRecord.update({
      where: { id: ncrId },
      data: {
        disposition,
        status: 'dispositioned',
      },
    });

    // Update unit status based on disposition
    let unitStatus = 'rework';
    if (disposition === 'scrap') {
      unitStatus = 'scrapped';
      await prisma.workOrder.update({
        where: { id: ncr.unit.workOrderId },
        data: {
          qtyScrap: { increment: 1 },
        },
      });
    } else if (disposition === 'use_as_is') {
      unitStatus = 'in_progress';
    }

    await prisma.unit.update({
      where: { id: ncr.unitId },
      data: { status: unitStatus },
    });

    // Emit NCR disposition event
    await emitEvent({
      eventType: 'ncr_dispositioned',
      siteId: ncr.unit.workOrder.siteId,
      stationId: ncr.stationId,
      workOrderId: ncr.unit.workOrderId,
      unitId: ncr.unitId,
      operatorId: user.id,
      payload: {
        serialNumber: ncr.unit.serialNumber,
        defectType: ncr.defectType,
        disposition,
      },
      source: 'ui',
      idempotencyKey: generateIdempotencyKey('ncr_dispositioned', ncrId),
    });

    // Emit additional events based on disposition
    if (disposition === 'scrap') {
      await emitEvent({
        eventType: 'scrap_recorded',
        siteId: ncr.unit.workOrder.siteId,
        stationId: ncr.stationId,
        workOrderId: ncr.unit.workOrderId,
        unitId: ncr.unitId,
        operatorId: user.id,
        payload: {
          serialNumber: ncr.unit.serialNumber,
          reason: ncr.defectType,
          ncrId: ncr.id,
        },
        source: 'ui',
        idempotencyKey: generateIdempotencyKey('scrap_recorded', `${ncr.unitId}:${ncrId}`),
      });
    }

    if (disposition === 'rework') {
      await emitEvent({
        eventType: 'rework_created',
        siteId: ncr.unit.workOrder.siteId,
        stationId: ncr.stationId,
        workOrderId: ncr.unit.workOrderId,
        unitId: ncr.unitId,
        operatorId: user.id,
        payload: {
          serialNumber: ncr.unit.serialNumber,
          reason: ncr.defectType,
          ncrId: ncr.id,
        },
        source: 'ui',
        idempotencyKey: generateIdempotencyKey('rework_created', `${ncr.unitId}:${ncrId}`),
      });
    }

    return NextResponse.json({
      success: true,
      ncr: updatedNCR,
      unitStatus,
    });

  } catch (error) {
    // Handle HttpError (RBAC errors)
    if (error instanceof HttpError) {
      return NextResponse.json(
        {
          error: error.statusCode === 403 ? 'Forbidden' : 'Unauthorized',
          message: error.message,
        },
        { status: error.statusCode }
      );
    }

    // Handle other errors
    console.error('NCR disposition error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ncr/[id]/disposition
 *
 * Get disposition status for an NCR
 * Any authenticated user can view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only require authentication, not specific role
    await requireRoleApi(['operator', 'supervisor', 'admin']);

    const { id: ncrId } = await params;

    const ncr = await prisma.nonconformanceRecord.findUnique({
      where: { id: ncrId },
      include: {
        unit: {
          select: {
            serialNumber: true,
            status: true,
          },
        },
        station: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!ncr) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'NCR not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: ncr.id,
      status: ncr.status,
      disposition: ncr.disposition,
      defectType: ncr.defectType,
      description: ncr.description,
      unit: ncr.unit,
      station: ncr.station,
      createdAt: ncr.createdAt,
      closedAt: ncr.closedAt,
    });

  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        {
          error: error.statusCode === 403 ? 'Forbidden' : 'Unauthorized',
          message: error.message,
        },
        { status: error.statusCode }
      );
    }

    console.error('NCR GET error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
