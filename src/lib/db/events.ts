import { prisma } from './prisma';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Event types for the MES system
 * Aligned with ISA-95 execution concepts
 */
export type EventType =
  // Work Order Events
  | 'work_order_imported'
  | 'work_order_released'
  | 'work_order_completed'
  | 'work_order_cancelled'
  // Unit Events
  | 'unit_created'
  | 'unit_serial_assigned'
  | 'unit_status_changed'
  // Operation Events
  | 'operation_started'
  | 'operation_completed'
  | 'operation_failed'
  // Quality Events
  | 'quality_check_recorded'
  | 'ncr_created'
  | 'ncr_dispositioned'
  | 'ncr_closed'
  // EOL Testing Events
  | 'eol_test_recorded'
  | 'eol_test_passed'
  | 'eol_test_failed'
  // Rework/Scrap Events
  | 'rework_created'
  | 'rework_completed'
  | 'scrap_recorded'
  // Downtime Events
  | 'downtime_started'
  | 'downtime_reason_selected'
  | 'downtime_ended'
  // Material Events
  | 'material_lot_received'
  | 'material_lot_consumed'
  | 'inventory_transaction_recorded'
  // Inventory Reservation Events
  | 'inventory_reserved'
  | 'inventory_reservation_released'
  // Work Order Status Events
  | 'work_order_drafted'
  | 'work_order_kitting_started'
  | 'work_order_testing_started'
  | 'work_order_shipped'
  | 'work_order_status_changed'
  // Procurement Events
  | 'purchase_order_created'
  | 'purchase_order_submitted'
  | 'purchase_order_cancelled'
  | 'purchase_order_received'
  // IQC Events
  | 'iqc_inspection_created'
  | 'iqc_inspection_started'
  | 'iqc_inspection_completed'
  | 'iqc_disposition_recorded'
  // CTQ / IQC Events
  | 'ctq_measurement_recorded'
  // Step Data Capture Events
  | 'step_data_captured'
  | 'step_data_signed_off'
  // Admin Events
  | 'config_changed'
  | 'user_login'
  | 'user_logout';

export type EventSource = 'ui' | 'edge' | 'integration';

export interface EmitEventParams {
  eventType: EventType;
  siteId: string;
  stationId?: string | null;
  workOrderId?: string | null;
  unitId?: string | null;
  operatorId?: string | null;
  payload: Prisma.InputJsonValue;
  source: EventSource;
  idempotencyKey?: string;
}

/**
 * Emit an event to the events table
 *
 * @param params - Event parameters
 * @returns The created event
 * @throws If idempotency key already exists (duplicate event)
 */
export async function emitEvent(params: EmitEventParams) {
  const {
    eventType,
    siteId,
    stationId,
    workOrderId,
    unitId,
    operatorId,
    payload,
    source,
    idempotencyKey,
  } = params;

  try {
    const event = await prisma.event.create({
      data: {
        eventType,
        siteId,
        stationId: stationId ?? null,
        workOrderId: workOrderId ?? null,
        unitId: unitId ?? null,
        operatorId: operatorId ?? null,
        payload,
        source,
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    return event;
  } catch (error) {
    // Handle duplicate idempotency key (P2002 is Prisma's unique constraint violation)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      // Return existing event for this idempotency key
      if (idempotencyKey) {
        const existingEvent = await prisma.event.findUnique({
          where: { idempotencyKey },
        });
        if (existingEvent) {
          return existingEvent;
        }
      }
    }
    throw error;
  }
}

/**
 * Generate a deterministic idempotency key for an operation
 * Useful for preventing duplicate events on retries
 */
export function generateIdempotencyKey(
  eventType: EventType,
  entityId: string,
  timestamp?: Date
): string {
  const ts = timestamp ?? new Date();
  // Round to nearest minute to allow for slight timing differences
  const roundedTs = new Date(Math.floor(ts.getTime() / 60000) * 60000);
  return `${eventType}:${entityId}:${roundedTs.toISOString()}`;
}

/**
 * Generate a unique idempotency key (for one-time events)
 */
export function generateUniqueIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Query events for a specific unit (for traceability)
 */
export async function getUnitEvents(unitId: string) {
  return prisma.event.findMany({
    where: { unitId },
    orderBy: { timestampUtc: 'asc' },
  });
}

/**
 * Query events for a specific work order
 */
export async function getWorkOrderEvents(workOrderId: string) {
  return prisma.event.findMany({
    where: { workOrderId },
    orderBy: { timestampUtc: 'asc' },
  });
}

/**
 * Query events for a specific station within a time range
 */
export async function getStationEvents(
  stationId: string,
  startTime: Date,
  endTime: Date
) {
  return prisma.event.findMany({
    where: {
      stationId,
      timestampUtc: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { timestampUtc: 'asc' },
  });
}

/**
 * Query recent events by type
 */
export async function getRecentEventsByType(
  eventType: EventType,
  limit: number = 100
) {
  return prisma.event.findMany({
    where: { eventType },
    orderBy: { timestampUtc: 'desc' },
    take: limit,
  });
}
