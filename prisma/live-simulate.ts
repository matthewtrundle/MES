/**
 * MES MVP - LIVE Production Simulation
 *
 * Runs continuously, creating real-time production activity.
 * Watch the dashboard auto-refresh to see live updates!
 *
 * Usage: npx tsx prisma/live-simulate.ts
 * Stop with: Ctrl+C
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

let unitCounter = 1;
let running = true;

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping simulation...');
  running = false;
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}

async function getRandomElement<T>(array: T[]): Promise<T> {
  return array[Math.floor(Math.random() * array.length)];
}

async function simulate() {
  console.log('');
  console.log('🏭 MES LIVE PRODUCTION SIMULATION');
  console.log('═'.repeat(50));
  console.log('📺 Watch your dashboard at: http://localhost:3001/dashboard');
  console.log('🛑 Press Ctrl+C to stop');
  console.log('═'.repeat(50));
  console.log('');

  // Get reference data
  const site = await prisma.site.findFirst();
  if (!site) throw new Error('Run seed first: npx prisma db seed');

  const stations = await prisma.station.findMany({ orderBy: { sequenceOrder: 'asc' } });

  // Find work orders with remaining capacity (qtyCompleted < qtyOrdered)
  const availableWorkOrders = await prisma.workOrder.findMany({
    where: {
      status: { in: ['released', 'in_progress'] },
    },
    orderBy: { createdAt: 'desc' }, // Prefer newer work orders
  });

  // Filter to work orders that still have units to produce
  const workOrdersWithCapacity = availableWorkOrders.filter(wo => wo.qtyCompleted < wo.qtyOrdered);

  // Mark fully completed work orders as 'completed'
  for (const wo of availableWorkOrders) {
    if (wo.qtyCompleted >= wo.qtyOrdered && wo.status !== 'completed') {
      await prisma.workOrder.update({
        where: { id: wo.id },
        data: { status: 'completed' },
      });
      log(`📋 AUTO-COMPLETE: Work order ${wo.orderNumber} marked as completed (${wo.qtyCompleted}/${wo.qtyOrdered})`);
    }
  }

  const workOrder = workOrdersWithCapacity[0];
  if (!workOrder) throw new Error('No active work order with remaining capacity found. Create and release a new work order.');

  const operations = await prisma.workOrderOperation.findMany({
    where: { workOrderId: workOrder.id },
    orderBy: { sequence: 'asc' },
  });

  const operators = await prisma.user.findMany({ where: { role: 'operator' } });
  const downtimeReasons = await prisma.downtimeReason.findMany();
  const qualityChecks = await prisma.qualityCheckDefinition.findMany();

  // Get existing unit count for serial numbering (global, not per work order)
  const allUnitsCount = await prisma.unit.count();
  unitCounter = allUnitsCount + 1;

  // Track units created for this specific work order
  const workOrderUnitsCount = await prisma.unit.count({ where: { workOrderId: workOrder.id } });
  let workOrderUnitsCreated = workOrderUnitsCount;

  log('🟢 Simulation started - creating live production activity');
  log(`📋 Work Order: ${workOrder.orderNumber} (${workOrder.qtyCompleted}/${workOrder.qtyOrdered} completed)`);
  log(`📊 Starting serial: MTR-${String(unitCounter).padStart(5, '0')}, WO units: ${workOrderUnitsCreated}/${workOrder.qtyOrdered}`);
  console.log('');

  // Track active units in progress
  const activeUnits: { id: string; serial: string; stationIndex: number }[] = [];

  while (running) {
    const action = Math.random();

    // 40% chance: Create new unit (if capacity allows for this work order)
    if (action < 0.4 && activeUnits.length < 3 && workOrderUnitsCreated < workOrder.qtyOrdered) {
      const serial = `MTR-${String(unitCounter).padStart(5, '0')}`;
      const operator = await getRandomElement(operators);

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

      activeUnits.push({ id: unit.id, serial, stationIndex: 0 });
      unitCounter++;
      workOrderUnitsCreated++;

      log(`📦 NEW UNIT: ${serial} started at ${stations[0].name} (${workOrderUnitsCreated}/${workOrder.qtyOrdered})`);
    }

    // 50% chance: Advance a unit to next station
    else if (action < 0.9 && activeUnits.length > 0) {
      const unitData = await getRandomElement(activeUnits);
      const operator = await getRandomElement(operators);
      const currentStation = stations[unitData.stationIndex];

      // Complete current operation
      const exec = await prisma.unitOperationExecution.findFirst({
        where: { unitId: unitData.id, completedAt: null },
      });

      if (exec) {
        const passed = Math.random() > 0.1; // 90% pass rate

        await prisma.unitOperationExecution.update({
          where: { id: exec.id },
          data: { completedAt: new Date(), result: passed ? 'pass' : 'fail' },
        });

        await prisma.event.create({
          data: {
            eventType: 'operation_completed',
            siteId: site.id,
            stationId: currentStation.id,
            workOrderId: workOrder.id,
            unitId: unitData.id,
            operatorId: operator.id,
            payload: { station: currentStation.name, result: passed ? 'pass' : 'fail' },
            source: 'ui',
          },
        });

        if (!passed) {
          // Create NCR for failure
          await prisma.nonconformanceRecord.create({
            data: {
              unitId: unitData.id,
              stationId: currentStation.id,
              defectType: 'Quality Check Failed',
              description: `Failed at ${currentStation.name}`,
              status: 'open',
            },
          });
          log(`❌ FAIL: ${unitData.serial} failed at ${currentStation.name} - NCR created`);
        }

        // Move to next station or complete
        if (unitData.stationIndex < stations.length - 1 && passed) {
          const nextStation = stations[unitData.stationIndex + 1];

          await prisma.unit.update({
            where: { id: unitData.id },
            data: { currentStationId: nextStation.id },
          });

          await prisma.unitOperationExecution.create({
            data: {
              unitId: unitData.id,
              operationId: operations[unitData.stationIndex + 1].id,
              stationId: nextStation.id,
              operatorId: operator.id,
              startedAt: new Date(),
            },
          });

          unitData.stationIndex++;
          log(`➡️  MOVE: ${unitData.serial} moved to ${nextStation.name}`);
        } else if (passed) {
          // Unit completed!
          await prisma.unit.update({
            where: { id: unitData.id },
            data: { status: 'completed', currentStationId: null },
          });

          const updatedWO = await prisma.workOrder.update({
            where: { id: workOrder.id },
            data: { qtyCompleted: { increment: 1 } },
          });

          // Check if work order is now complete
          if (updatedWO.qtyCompleted >= updatedWO.qtyOrdered) {
            await prisma.workOrder.update({
              where: { id: workOrder.id },
              data: { status: 'completed' },
            });
            log(`🎉 WORK ORDER COMPLETE: ${workOrder.orderNumber} - all ${updatedWO.qtyOrdered} units finished!`);
          }

          // Record quality check pass
          if (qualityChecks.length > 0) {
            await prisma.qualityCheckResult.create({
              data: {
                unitId: unitData.id,
                definitionId: qualityChecks[0].id,
                operatorId: operator.id,
                result: 'pass',
                valuesJson: { measured: 3000 + Math.random() * 100, unit: 'rpm' },
                timestamp: new Date(),
              },
            });
          }

          activeUnits.splice(activeUnits.indexOf(unitData), 1);
          log(`✅ COMPLETE: ${unitData.serial} finished all stations!`);
        }
      }
    }

    // Downtime is now triggered manually via UI button (removed from auto-simulation)

    // Wait 3-8 seconds before next action (faster without downtime interruptions)
    const waitTime = 3000 + Math.random() * 5000;
    await sleep(waitTime);
  }

  console.log('\n✅ Simulation stopped gracefully');
}

simulate()
  .catch((e) => {
    console.error('❌ Simulation error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
