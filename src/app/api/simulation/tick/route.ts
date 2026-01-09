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

export async function POST() {
  try {
    const site = await prisma.site.findFirst();
    if (!site) {
      return NextResponse.json({ error: 'No site found' }, { status: 400 });
    }

    const stations = await prisma.station.findMany({ orderBy: { sequenceOrder: 'asc' } });
    const workOrder = await prisma.workOrder.findFirst({
      where: { status: { in: ['released', 'in_progress'] } },
    });

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

    const completedCount = await prisma.unit.count({
      where: { status: 'completed', workOrderId: workOrder.id },
    });

    const totalUnits = await prisma.unit.count({ where: { workOrderId: workOrder.id } });

    // Decide action
    const action = Math.random();
    let result: { action: string; detail: string };

    // 35% - Create new unit (if room)
    if (action < 0.35 && activeUnits.length < 3 && totalUnits < workOrder.qtyOrdered) {
      const serial = `MTR-${String(totalUnits + 1).padStart(5, '0')}`;

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

      result = { action: 'unit_created', detail: `New unit ${serial} started at ${stations[0].name}` };
    }
    // 55% - Advance a unit
    else if (action < 0.9 && activeUnits.length > 0) {
      const unit = activeUnits[Math.floor(Math.random() * activeUnits.length)];
      const currentStationIndex = stations.findIndex(s => s.id === unit.currentStationId);
      const currentStation = stations[currentStationIndex];

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
    // 10% - Downtime event
    else {
      const downtimeReasons = await prisma.downtimeReason.findMany();
      const station = stations[Math.floor(Math.random() * stations.length)];

      // Check for existing downtime
      const existingDowntime = await prisma.downtimeInterval.findFirst({
        where: { stationId: station.id, endedAt: null },
      });

      if (existingDowntime) {
        // End the downtime
        await prisma.downtimeInterval.update({
          where: { id: existingDowntime.id },
          data: { endedAt: new Date() },
        });

        await prisma.event.create({
          data: {
            eventType: 'downtime_ended',
            siteId: site.id,
            stationId: station.id,
            operatorId: operator.id,
            payload: { stationName: station.name },
            source: 'ui',
          },
        });

        result = { action: 'downtime_ended', detail: `${station.name} back online` };
      } else if (downtimeReasons.length > 0) {
        // Start new downtime
        const reason = downtimeReasons[Math.floor(Math.random() * downtimeReasons.length)];

        await prisma.downtimeInterval.create({
          data: {
            stationId: station.id,
            operatorId: operator.id,
            reasonId: reason.id,
            startedAt: new Date(),
          },
        });

        await prisma.event.create({
          data: {
            eventType: 'downtime_started',
            siteId: site.id,
            stationId: station.id,
            operatorId: operator.id,
            payload: { reason: reason.description },
            source: 'ui',
          },
        });

        result = { action: 'downtime_started', detail: `${station.name}: ${reason.description}` };
      } else {
        result = { action: 'no_op', detail: 'No downtime reasons configured' };
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      stats: {
        activeUnits: activeUnits.length,
        completed: completedCount,
        total: totalUnits,
        target: workOrder.qtyOrdered,
      },
    });
  } catch (error) {
    console.error('Simulation tick error:', error);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
