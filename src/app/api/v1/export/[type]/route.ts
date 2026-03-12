import { NextRequest, NextResponse } from 'next/server';
import { requireRoleApi, HttpError } from '@/lib/auth/rbac';
import {
  exportWorkOrders,
  exportUnits,
  exportNCRs,
  exportInventory,
  exportShipments,
  exportProductionHistory,
  exportQualityChecks,
  type ExportFilters,
} from '@/lib/actions/data-export';

const EXPORT_MAP: Record<string, (filters?: ExportFilters) => Promise<string>> = {
  'work-orders': exportWorkOrders,
  'units': exportUnits,
  'ncrs': exportNCRs,
  'inventory': exportInventory,
  'shipments': exportShipments,
  'production-history': exportProductionHistory,
  'quality-checks': exportQualityChecks,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    await requireRoleApi(['supervisor', 'admin']);

    const { type } = await params;
    const exportFn = EXPORT_MAP[type];

    if (!exportFn) {
      return NextResponse.json(
        { error: `Unknown export type: ${type}. Valid types: ${Object.keys(EXPORT_MAP).join(', ')}` },
        { status: 400 },
      );
    }

    // Parse optional date filters from query params
    const searchParams = request.nextUrl.searchParams;
    const filters: ExportFilters = {};
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const csv = await exportFn(Object.keys(filters).length > 0 ? filters : undefined);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${type}-export-${timestamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 },
    );
  }
}
