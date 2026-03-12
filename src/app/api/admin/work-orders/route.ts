import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRoleApi, HttpError } from '@/lib/auth/rbac';

export async function GET() {
  try {
    await requireRoleApi(['admin', 'supervisor']);

    const [workOrders, sites, routings] = await Promise.all([
      prisma.workOrder.findMany({
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          site: { select: { name: true } },
          routing: { select: { name: true } },
          _count: { select: { units: true } },
        },
      }),
      prisma.site.findMany({
        select: { id: true, name: true },
      }),
      prisma.routing.findMany({
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({ workOrders, sites, routings });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Failed to fetch work orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch work orders' },
      { status: 500 }
    );
  }
}
