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
  const workOrder = await prisma.workOrder.findFirst({
    where: { status: { in: ['released', 'in_progress'] } }
  });
  if (!workOrder) throw new Error('No active work order found');

  const operations = await prisma.workOrderOperation.findMany({
    where: { workOrderId: workOrder.id },
    orderBy: { sequence: 'asc' },
  });

  const operators = await prisma.user.findMany({ where: { role: 'operator' } });
  const downtimeReasons = await prisma.downtimeReason.findMany();
  const qualityChecks = await prisma.qualityCheckDefinition.findMany();

  // Get existing unit count for serial numbering
  const existingUnits = await prisma.unit.count({ where: { workOrderId: workOrder.id } });
  unitCounter = existingUnits + 1;

  log('🟢 Simulation started - creating live production activity');
  log(`📋 Work Order: ${workOrder.orderNumber} (${workOrder.qtyCompleted}/${workOrder.qtyOrdered} completed)`);
  console.log('');

  // Track active units in progress
  const activeUnits: { id: string; serial: string; stationIndex: number }[] = [];

  while (running) {
    const action = Math.random();

    // 40% chance: Create new unit (if capacity allows)
    if (action < 0.4 && activeUnits.length < 3 && unitCounter <= workOrder.qtyOrdered) {
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

      log(`📦 NEW UNIT: ${serial} started at ${stations[0].name}`);
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

          await prisma.workOrder.update({
            where: { id: workOrder.id },
            data: { qtyCompleted: { increment: 1 } },
          });

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

    // 10% chance: Trigger downtime event
    else if (activeUnits.length > 0 && downtimeReasons.length > 0) {
      const station = await getRandomElement(stations);
      const reason = await getRandomElement(downtimeReasons);
      const operator = await getRandomElement(operators);

      // Check if station already has active downtime
      const existingDowntime = await prisma.downtimeInterval.findFirst({
        where: { stationId: station.id, endedAt: null },
      });

      if (!existingDowntime) {
        const downtime = await prisma.downtimeInterval.create({
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

        log(`⚠️  DOWNTIME: ${station.name} - ${reason.description}`);

        // End downtime after 10-30 seconds
        setTimeout(async () => {
          await prisma.downtimeInterval.update({
            where: { id: downtime.id },
            data: { endedAt: new Date() },
          });
          await prisma.event.create({
            data: {
              eventType: 'downtime_ended',
              siteId: site.id,
              stationId: station.id,
              operatorId: operator.id,
              payload: { reason: reason.description },
              source: 'ui',
            },
          });
          log(`🟢 RESUMED: ${station.name} back online`);
        }, 10000 + Math.random() * 20000);
      }
    }

    // Wait 5-15 seconds before next action
    const waitTime = 5000 + Math.random() * 10000;
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
