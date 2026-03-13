'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { toCSV } from '@/lib/utils/csv';

// ── Shared filter type ──────────────────────────────────────────────

export interface ExportFilters {
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
}

function dateRange(filters?: ExportFilters) {
  const range: { gte?: Date; lte?: Date } = {};
  if (filters?.dateFrom) {
    range.gte = new Date(filters.dateFrom);
  }
  if (filters?.dateTo) {
    // Include the entire end day
    const d = new Date(filters.dateTo);
    d.setHours(23, 59, 59, 999);
    range.lte = d;
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

// ── Work Orders ─────────────────────────────────────────────────────

export async function exportWorkOrders(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const createdAtRange = dateRange(filters);

  const workOrders = await prisma.workOrder.findMany({
    where: createdAtRange ? { createdAt: createdAtRange } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      productCode: true,
      status: true,
      qtyOrdered: true,
      qtyCompleted: true,
      customerName: true,
      dueDate: true,
      createdAt: true,
    },
  });

  const headers = ['orderNumber', 'productCode', 'status', 'qtyOrdered', 'qtyCompleted', 'customerName', 'dueDate', 'createdAt'];
  return toCSV(workOrders as unknown as Record<string, unknown>[], headers);
}

// ── Units ───────────────────────────────────────────────────────────

export async function exportUnits(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const createdAtRange = dateRange(filters);

  const units = await prisma.unit.findMany({
    where: createdAtRange ? { createdAt: createdAtRange } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      workOrder: { select: { orderNumber: true } },
    },
  });

  const rows = units.map(u => ({
    serialNumber: u.serialNumber,
    workOrder: u.workOrder.orderNumber,
    status: u.status,
    currentStationId: u.currentStationId,
    createdAt: u.createdAt,
  }));

  return toCSV(rows, ['serialNumber', 'workOrder', 'status', 'currentStationId', 'createdAt']);
}

// ── NCRs ────────────────────────────────────────────────────────────

export async function exportNCRs(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const createdAtRange = dateRange(filters);

  const ncrs = await prisma.nonconformanceRecord.findMany({
    where: createdAtRange ? { createdAt: createdAtRange } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      ncrNumber: true,
      defectType: true,
      disposition: true,
      status: true,
      source: true,
      createdAt: true,
    },
  });

  return toCSV(ncrs as unknown as Record<string, unknown>[], ['ncrNumber', 'defectType', 'disposition', 'status', 'source', 'createdAt']);
}

// ── Inventory (Material Lots) ───────────────────────────────────────

export async function exportInventory(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const receivedAtRange = dateRange(filters);

  const lots = await prisma.materialLot.findMany({
    where: receivedAtRange ? { receivedAt: receivedAtRange } : undefined,
    orderBy: { receivedAt: 'desc' },
    select: {
      lotNumber: true,
      materialCode: true,
      qtyReceived: true,
      qtyRemaining: true,
      status: true,
      supplier: true,
      receivedAt: true,
    },
  });

  return toCSV(lots as unknown as Record<string, unknown>[], ['lotNumber', 'materialCode', 'qtyReceived', 'qtyRemaining', 'status', 'supplier', 'receivedAt']);
}

// ── Shipments ───────────────────────────────────────────────────────

export async function exportShipments(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const shipDateRange = dateRange(filters);

  const shipments = await prisma.shipment.findMany({
    where: {
      ...(shipDateRange ? { shipDate: shipDateRange } : {}),
    },
    include: {
      workOrder: { select: { orderNumber: true, productCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = shipments.map(s => ({
    shipmentNumber: s.shipmentNumber,
    workOrderNumber: s.workOrder.orderNumber,
    customerName: s.customerName,
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    status: s.status,
    shipDate: s.shipDate,
  }));

  return toCSV(rows, ['shipmentNumber', 'workOrderNumber', 'customerName', 'carrier', 'trackingNumber', 'status', 'shipDate']);
}

// ── Production History (unit operation executions) ──────────────────

export async function exportProductionHistory(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const startedAtRange = dateRange(filters);

  const executions = await prisma.unitOperationExecution.findMany({
    where: startedAtRange ? { startedAt: startedAtRange } : undefined,
    orderBy: { startedAt: 'desc' },
    include: {
      unit: { select: { serialNumber: true } },
      station: { select: { name: true } },
      operation: { select: { sequence: true } },
      operator: { select: { name: true } },
    },
  });

  const rows = executions.map(e => ({
    serialNumber: e.unit.serialNumber,
    station: e.station.name,
    operationSequence: e.operation.sequence,
    operator: e.operator.name,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    cycleTimeMinutes: e.cycleTimeMinutes,
    result: e.result,
  }));

  return toCSV(rows, ['serialNumber', 'station', 'operationSequence', 'operator', 'startedAt', 'completedAt', 'cycleTimeMinutes', 'result']);
}

// ── Quality Checks ──────────────────────────────────────────────────

export async function exportQualityChecks(filters?: ExportFilters): Promise<string> {
  await requireRole(['supervisor', 'admin']);

  const timestampRange = dateRange(filters);

  const results = await prisma.qualityCheckResult.findMany({
    where: timestampRange ? { timestamp: timestampRange } : undefined,
    orderBy: { timestamp: 'desc' },
    include: {
      unit: { select: { serialNumber: true } },
      definition: { select: { name: true, checkType: true } },
      operator: { select: { name: true } },
    },
  });

  const rows = results.map(r => ({
    serialNumber: r.unit.serialNumber,
    checkName: r.definition.name,
    checkType: r.definition.checkType,
    result: r.result,
    operator: r.operator.name,
    timestamp: r.timestamp,
  }));

  return toCSV(rows, ['serialNumber', 'checkName', 'checkType', 'result', 'operator', 'timestamp']);
}
