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
  const rows = workOrders.map(wo => [
    wo.orderNumber,
    wo.productCode,
    wo.status,
    wo.qtyOrdered,
    wo.qtyCompleted,
    wo.customerName,
    wo.dueDate,
    wo.createdAt,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['serialNumber', 'workOrder', 'status', 'currentStationId', 'createdAt'];
  const rows = units.map(u => [
    u.serialNumber,
    u.workOrder.orderNumber,
    u.status,
    u.currentStationId,
    u.createdAt,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['ncrNumber', 'defectType', 'disposition', 'status', 'source', 'createdAt'];
  const rows = ncrs.map(n => [
    n.ncrNumber,
    n.defectType,
    n.disposition,
    n.status,
    n.source,
    n.createdAt,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['lotNumber', 'materialCode', 'qtyReceived', 'qtyRemaining', 'status', 'supplier', 'receivedAt'];
  const rows = lots.map(l => [
    l.lotNumber,
    l.materialCode,
    l.qtyReceived,
    l.qtyRemaining,
    l.status,
    l.supplier,
    l.receivedAt,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['shipmentNumber', 'workOrderNumber', 'customerName', 'carrier', 'trackingNumber', 'status', 'shipDate'];
  const rows = shipments.map(s => [
    s.shipmentNumber,
    s.workOrder.orderNumber,
    s.customerName,
    s.carrier,
    s.trackingNumber,
    s.status,
    s.shipDate,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['serialNumber', 'station', 'operationSequence', 'operator', 'startedAt', 'completedAt', 'cycleTimeMinutes', 'result'];
  const rows = executions.map(e => [
    e.unit.serialNumber,
    e.station.name,
    e.operation.sequence,
    e.operator.name,
    e.startedAt,
    e.completedAt,
    e.cycleTimeMinutes,
    e.result,
  ]);

  return toCSV(headers, rows);
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

  const headers = ['serialNumber', 'checkName', 'checkType', 'result', 'operator', 'timestamp'];
  const rows = results.map(r => [
    r.unit.serialNumber,
    r.definition.name,
    r.definition.checkType,
    r.result,
    r.operator.name,
    r.timestamp,
  ]);

  return toCSV(headers, rows);
}
