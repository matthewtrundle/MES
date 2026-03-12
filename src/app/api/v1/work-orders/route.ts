import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireApiAuth, apiErrorResponse } from '@/lib/auth/api-auth';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';

/**
 * GET /api/v1/work-orders
 * List work orders with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request, ['work_orders:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          routing: { select: { id: true, name: true } },
          _count: { select: { units: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return Response.json({
      data: workOrders,
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

/**
 * POST /api/v1/work-orders
 * Create a new work order
 */
export async function POST(request: NextRequest) {
  try {
    const { user, apiKey } = await requireApiAuth(request, ['work_orders:write']);

    const body = await request.json();
    const { siteId, routingId, orderNumber, productCode, productName, qtyOrdered, priority, dueDate, customerName, customerOrderRef, notes } = body;

    if (!siteId || !orderNumber || !productCode || !qtyOrdered) {
      return Response.json(
        { error: 'Missing required fields: siteId, orderNumber, productCode, qtyOrdered' },
        { status: 400 }
      );
    }

    // Check for duplicate order number
    const existing = await prisma.workOrder.findUnique({
      where: { orderNumber },
    });
    if (existing) {
      return Response.json(
        { error: `Work order with order number "${orderNumber}" already exists` },
        { status: 409 }
      );
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        siteId,
        routingId: routingId ?? null,
        orderNumber,
        productCode,
        productName: productName ?? null,
        qtyOrdered,
        priority: priority ?? 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        customerName: customerName ?? null,
        customerOrderRef: customerOrderRef ?? null,
        notes: notes ?? null,
        status: 'draft',
      },
      include: {
        site: { select: { id: true, name: true } },
        routing: { select: { id: true, name: true } },
      },
    });

    await emitEvent({
      eventType: 'work_order_imported',
      siteId,
      workOrderId: workOrder.id,
      operatorId: user?.id ?? null,
      payload: {
        orderNumber,
        productCode,
        qtyOrdered,
        source: apiKey ? 'api_key' : 'api_session',
      },
      source: 'integration',
      idempotencyKey: generateUniqueIdempotencyKey(),
    });

    return Response.json({ data: workOrder }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
