import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const workOrderId = searchParams.get('workOrderId');

  if (!workOrderId) {
    return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
  }

  // Get the station to find its sequence
  const station = await prisma.station.findUnique({
    where: { id: stationId },
  });

  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  }

  // Find the operation for this work order at this station's sequence
  const operation = await prisma.workOrderOperation.findFirst({
    where: {
      workOrderId,
      sequence: station.sequenceOrder,
    },
  });

  if (!operation) {
    // If no operation exists at this sequence, return null
    return NextResponse.json({ operationId: null });
  }

  return NextResponse.json({ operationId: operation.id });
}
