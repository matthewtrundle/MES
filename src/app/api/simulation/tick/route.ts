/**
 * Simulation Tick API
 *
 * Each call creates a random production event:
 * - Create new unit
 * - Advance unit to next station
 * - Complete unit
 * - Start/end downtime
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    // Get speed parameter (run multiple ticks at once for faster simulation)
    const { searchParams } = new URL(request.url);
    const speed = Math.min(parseInt(searchParams.get('speed') || '1', 10), 5);

    const site = await prisma.site.findFirst();
    if (!site) {
      return NextResponse.json({ error: 'No site found' }, { status: 400 });
    }

    const stations = await prisma.station.findMany({ orderBy: { sequenceOrder: 'asc' } });

    // Get stations with active downtime - these should block production
    const activeDowntimes = await prisma.downtimeInterval.findMany({
      where: { endedAt: null },
      select: { stationId: true },
    });
    const downtimeStationIds = new Set(activeDowntimes.map(d => d.stationId));

    // Find work order with remaining capacity
    const availableWorkOrders = await prisma.workOrder.findMany({
      where: { status: { in: ['released', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
    });

    const workOrder = availableWorkOrders.find(wo => wo.qtyCompleted < wo.qtyOrdered) || availableWorkOrders[0];

    if (!workOrder) {
      return NextResponse.json({ error: 'No active work order' }, { status: 400 });
    }

    const operations = await prisma.workOrderOperation.findMany({
      where: { workOrderId: workOrder.id },
      orderBy: { sequence: 'asc' },
    });

    const operators = await prisma.user.findMany({ where: { role: 'operator' } });
    const operator = operators[Math.floor(Math.random() * operators.length)];

    // Get current state
    const activeUnits = await prisma.unit.findMany({
      where: { status: 'in_progress', workOrderId: workOrder.id },
      include: { executions: { where: { completedAt: null } } },
    });

    // Fix orphaned units (have currentStationId but no active execution)
    const orphanedUnits = activeUnits.filter(
      (u) => u.currentStationId && u.executions.length === 0
    );
    for (const orphan of orphanedUnits) {
      // Mark orphaned units as completed to clear them from the line
      await prisma.unit.update({
        where: { id: orphan.id },
        data: { status: 'completed', currentStationId: null },
      });
      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { qtyCompleted: { increment: 1 } },
      });
      await prisma.event.create({
        data: {
          eventType: 'unit_completed',
          siteId: site.id,
          workOrderId: workOrder.id,
          unitId: orphan.id,
          payload: { serialNumber: orphan.serialNumber, reason: 'orphan_cleanup' },
          source: 'ui',
        },
      });
      console.log(`Fixed orphaned unit: ${orphan.serialNumber}`);
    }

    const completedCount = await prisma.unit.count({
      where: { status: 'completed', workOrderId: workOrder.id },
    });

    const totalUnits = await prisma.unit.count({ where: { workOrderId: workOrder.id } });

    // Decide action
    const action = Math.random();
    let result: { action: string; detail: string };

    // Get global unit count for unique serial numbers
    const globalUnitCount = await prisma.unit.count();

    // Check if first station is blocked by downtime
    const firstStationBlocked = downtimeStationIds.has(stations[0].id);

    // 35% - Create new unit (if room, work order has capacity, AND first station not in downtime)
    if (action < 0.35 && activeUnits.length < 3 && totalUnits < workOrder.qtyOrdered && !firstStationBlocked) {
      const serial = `MTR-${String(globalUnitCount + 1).padStart(5, '0')}`;

      const unit = await prisma.unit.create({
        data: {
          workOrderId: workOrder.id,
          serialNumber: serial,
          status: 'in_progress',
          currentStationId: stations[0].id,
        },
      });

      await prisma.event.create({
        data: {
          eventType: 'unit_created',
          siteId: site.id,
          workOrderId: workOrder.id,
          unitId: unit.id,
          stationId: stations[0].id,
          operatorId: operator.id,
          payload: { serialNumber: serial },
          source: 'ui',
        },
      });

      await prisma.unitOperationExecution.create({
        data: {
          unitId: unit.id,
          operationId: operations[0].id,
          stationId: stations[0].id,
          operatorId: operator.id,
          startedAt: new Date(),
        },
      });

      // Consume material for first station (simulate material usage)
      const availableLot = await prisma.materialLot.findFirst({
        where: { qtyRemaining: { gt: 0 } },
        orderBy: { receivedAt: 'asc' }, // FIFO
      });

      if (availableLot) {
        const consumeQty = Math.min(1, availableLot.qtyRemaining);
        await prisma.$transaction([
          prisma.unitMaterialConsumption.create({
            data: {
              unitId: unit.id,
              materialLotId: availableLot.id,
              qtyConsumed: consumeQty,
              stationId: stations[0].id,
              operatorId: operator.id,
            },
          }),
          prisma.materialLot.update({
            where: { id: availableLot.id },
            data: { qtyRemaining: { decrement: consumeQty } },
          }),
        ]);
      }

      result = { action: 'unit_created', detail: `New unit ${serial} started at ${stations[0].name}` };
    }
    // 55% - Advance a unit
    else if (action < 0.9 && activeUnits.length > 0) {
      // Filter out units at stations with downtime - they can't progress
      const unitsNotInDowntime = activeUnits.filter(u => !downtimeStationIds.has(u.currentStationId || ''));

      if (unitsNotInDowntime.length === 0) {
        // All units are blocked by downtime
        result = { action: 'blocked', detail: 'All units blocked by downtime' };
      } else {
        const unit = unitsNotInDowntime[Math.floor(Math.random() * unitsNotInDowntime.length)];
        const currentStationIndex = stations.findIndex(s => s.id === unit.currentStationId);
        const currentStation = stations[currentStationIndex];

        // Check if next station is in downtime (would block movement)
        const nextStationIndex = currentStationIndex + 1;
        const nextStationBlocked = nextStationIndex < stations.length && downtimeStationIds.has(stations[nextStationIndex].id);

        if (nextStationBlocked) {
          // Can't move to next station - it's in downtime
          result = { action: 'blocked', detail: `${unit.serialNumber} waiting - next station (${stations[nextStationIndex].name}) is down` };
        } else {
          // Complete current operation
          const exec = unit.executions[0];
          if (exec) {
        await prisma.unitOperationExecution.update({
          where: { id: exec.id },
          data: { completedAt: new Date(), result: 'pass' },
        });

        await prisma.event.create({
          data: {
            eventType: 'operation_completed',
            siteId: site.id,
            stationId: currentStation.id,
            workOrderId: workOrder.id,
            unitId: unit.id,
            operatorId: operator.id,
            payload: { station: currentStation.name, result: 'pass' },
            source: 'ui',
          },
        });

        // Move to next station or complete
        if (currentStationIndex < stations.length - 1) {
          const nextStation = stations[currentStationIndex + 1];

          await prisma.unit.update({
            where: { id: unit.id },
            data: { currentStationId: nextStation.id },
          });

          await prisma.unitOperationExecution.create({
            data: {
              unitId: unit.id,
              operationId: operations[currentStationIndex + 1].id,
              stationId: nextStation.id,
              operatorId: operator.id,
              startedAt: new Date(),
            },
          });

          // Consume material at new station (simulate material usage)
          const nextStationLot = await prisma.materialLot.findFirst({
            where: { qtyRemaining: { gt: 0 } },
            orderBy: { receivedAt: 'asc' }, // FIFO
          });

          if (nextStationLot) {
            const consumeQty = Math.min(1, nextStationLot.qtyRemaining);
            await prisma.$transaction([
              prisma.unitMaterialConsumption.create({
                data: {
                  unitId: unit.id,
                  materialLotId: nextStationLot.id,
                  qtyConsumed: consumeQty,
                  stationId: nextStation.id,
                  operatorId: operator.id,
                },
              }),
              prisma.materialLot.update({
                where: { id: nextStationLot.id },
                data: { qtyRemaining: { decrement: consumeQty } },
              }),
            ]);
          }

          result = { action: 'unit_moved', detail: `${unit.serialNumber} moved to ${nextStation.name}` };
        } else {
          // Complete the unit
          await prisma.unit.update({
            where: { id: unit.id },
            data: { status: 'completed', currentStationId: null },
          });

          await prisma.workOrder.update({
            where: { id: workOrder.id },
            data: { qtyCompleted: { increment: 1 } },
          });

          // Record quality pass
          const qualityChecks = await prisma.qualityCheckDefinition.findMany({ take: 1 });
          if (qualityChecks.length > 0) {
            await prisma.qualityCheckResult.create({
              data: {
                unitId: unit.id,
                definitionId: qualityChecks[0].id,
                operatorId: operator.id,
                result: 'pass',
                valuesJson: { measured: 2900 + Math.random() * 200 },
                timestamp: new Date(),
              },
            });
          }

          result = { action: 'unit_completed', detail: `${unit.serialNumber} COMPLETED!` };
        }
      } else {
        result = { action: 'no_op', detail: 'No active execution found' };
      }
        }
      }
    }
    // 10% - Idle tick
    else {
      result = { action: 'idle', detail: 'Waiting for capacity...' };
    }

    // Get fresh work order data for response
    const freshWorkOrder = await prisma.workOrder.findUnique({
      where: { id: workOrder.id },
    });

    // Get fresh counts
    const freshActiveUnits = await prisma.unit.count({
      where: { status: 'in_progress', workOrderId: workOrder.id },
    });
    const freshCompletedCount = await prisma.unit.count({
      where: { status: 'completed', workOrderId: workOrder.id },
    });

    return NextResponse.json({
      success: true,
      ...result,
      stats: {
        activeUnits: freshActiveUnits,
        completed: freshCompletedCount,
        total: totalUnits,
        target: workOrder.qtyOrdered,
      },
      workOrder: freshWorkOrder ? {
        orderNumber: freshWorkOrder.orderNumber,
        productCode: freshWorkOrder.productCode,
        qtyCompleted: freshWorkOrder.qtyCompleted,
        qtyOrdered: freshWorkOrder.qtyOrdered,
      } : null,
    });
  } catch (error) {
    console.error('Simulation tick error:', error);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
