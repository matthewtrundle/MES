/**
 * MES MVP - Production Simulation Script
 *
 * This script simulates a realistic production day with:
 * - Units progressing through stations
 * - Downtime events (planned and unplanned)
 * - Quality check failures and NCRs
 * - Material consumption
 * - Bottlenecks and issues
 *
 * Run after seed: npx tsx prisma/simulate.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================================================================
// DETERMINISTIC SIMULATION - Same results every run
// ============================================================================
// Use a fixed date for reproducible demo results
const SIMULATION_START = new Date('2024-01-15T06:00:00Z'); // Fixed date: 6 AM Jan 15, 2024

// Seeded random number generator for deterministic "randomness"
function createSeededRandom(seed: number) {
  let state = seed;
  return function(): number {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Use seed based on work order to ensure same results every run
const seededRandom = createSeededRandom(12345);

function simTime(minutesFromStart: number): Date {
  return new Date(SIMULATION_START.getTime() + minutesFromStart * 60 * 1000);
}

function log(time: Date, message: string) {
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  console.log(`[${timeStr}] ${message}`);
}

async function simulate() {
  console.log('🏭 MES Production Simulation');
  console.log('═'.repeat(50));
  console.log(`📅 Simulating production day: ${SIMULATION_START.toLocaleDateString()}`);
  console.log('');

  // Get existing data
  const site = await prisma.site.findFirst();
  if (!site) throw new Error('Run seed first: npx prisma db seed');

  const stations = await prisma.station.findMany({ orderBy: { sequenceOrder: 'asc' } });
  const [stationA, stationB, stationC] = stations;

  const workOrder = await prisma.workOrder.findFirst({ where: { orderNumber: 'WO-1001' } });
  if (!workOrder) throw new Error('Work order not found');

  const operations = await prisma.workOrderOperation.findMany({
    where: { workOrderId: workOrder.id },
    orderBy: { sequence: 'asc' },
  });

  const operators = await prisma.user.findMany({
    where: { role: 'operator' },
  });
  const [operator1, operator2] = operators;

  const supervisor = await prisma.user.findFirst({ where: { role: 'supervisor' } });

  const downtimeReasons = await prisma.downtimeReason.findMany();
  const equipFailReason = downtimeReasons.find(r => r.code === 'EQUIP_FAIL');
  const materialWaitReason = downtimeReasons.find(r => r.code === 'MATERIAL_WAIT');
  const breakReason = downtimeReasons.find(r => r.code === 'BREAK');

  const qualityChecks = await prisma.qualityCheckDefinition.findMany();
  const materialLots = await prisma.materialLot.findMany();

  console.log('📊 Scenario Overview:');
  console.log('   - 5 units to produce');
  console.log('   - 3 stations: Winding → Magnet Install → Final Test');
  console.log('   - Includes: downtime, quality failure, rework');
  console.log('');
  console.log('🎬 Starting Simulation...');
  console.log('─'.repeat(50));

  // Track units
  const units: { id: string; serial: string }[] = [];

  // ═══════════════════════════════════════════════════════
  // PHASE 1: Morning Startup (6:00 - 6:30)
  // ═══════════════════════════════════════════════════════

  log(simTime(0), '🌅 Shift start - Operators arrive');

  // Create Unit 1
  const unit1 = await prisma.unit.create({
    data: {
      workOrderId: workOrder.id,
      serialNumber: 'MTR-00001',
      status: 'in_progress',
      currentStationId: stationA.id,
    },
  });
  units.push({ id: unit1.id, serial: unit1.serialNumber });
  log(simTime(5), `📦 Unit ${unit1.serialNumber} created, starting at Station A`);

  await prisma.event.create({
    data: {
      eventType: 'unit_created',
      siteId: site.id,
      workOrderId: workOrder.id,
      unitId: unit1.id,
      operatorId: operator1.id,
      payload: { serialNumber: unit1.serialNumber },
      source: 'ui',
      timestampUtc: simTime(5),
    },
  });

  // Start operation for Unit 1
  const exec1 = await prisma.unitOperationExecution.create({
    data: {
      unitId: unit1.id,
      operationId: operations[0].id,
      stationId: stationA.id,
      operatorId: operator1.id,
      startedAt: simTime(5),
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'operation_started',
      siteId: site.id,
      stationId: stationA.id,
      workOrderId: workOrder.id,
      unitId: unit1.id,
      operatorId: operator1.id,
      payload: { station: stationA.name, sequence: 1 },
      source: 'ui',
      timestampUtc: simTime(5),
    },
  });

  // ═══════════════════════════════════════════════════════
  // PHASE 2: Equipment Issue (6:30 - 7:00)
  // ═══════════════════════════════════════════════════════

  log(simTime(30), '⚠️ EQUIPMENT FAILURE at Station A!');

  const downtime1 = await prisma.downtimeInterval.create({
    data: {
      stationId: stationA.id,
      operatorId: operator1.id,
      startedAt: simTime(30),
      reasonId: equipFailReason?.id,
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'downtime_started',
      siteId: site.id,
      stationId: stationA.id,
      operatorId: operator1.id,
      payload: { reason: 'Equipment Failure' },
      source: 'ui',
      timestampUtc: simTime(30),
    },
  });

  log(simTime(45), '🔧 Equipment repaired, resuming production');

  await prisma.downtimeInterval.update({
    where: { id: downtime1.id },
    data: { endedAt: simTime(45) },
  });

  await prisma.event.create({
    data: {
      eventType: 'downtime_ended',
      siteId: site.id,
      stationId: stationA.id,
      operatorId: operator1.id,
      payload: { durationMinutes: 15 },
      source: 'ui',
      timestampUtc: simTime(45),
    },
  });

  // ═══════════════════════════════════════════════════════
  // PHASE 3: Normal Production (7:00 - 9:00)
  // ═══════════════════════════════════════════════════════

  // Complete Unit 1 at Station A
  log(simTime(60), `✅ Unit ${unit1.serialNumber} completed at Station A`);

  await prisma.unitOperationExecution.update({
    where: { id: exec1.id },
    data: { completedAt: simTime(60), result: 'pass' },
  });

  // Record material consumption
  await prisma.unitMaterialConsumption.create({
    data: {
      unitId: unit1.id,
      materialLotId: materialLots[0].id, // Wire
      qtyConsumed: 2.5,
      stationId: stationA.id,
      operatorId: operator1.id,
      timestamp: simTime(55),
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'material_lot_consumed',
      siteId: site.id,
      stationId: stationA.id,
      unitId: unit1.id,
      operatorId: operator1.id,
      payload: { lotNumber: materialLots[0].lotNumber, qty: 2.5 },
      source: 'ui',
      timestampUtc: simTime(55),
    },
  });

  // Record quality check pass
  await prisma.qualityCheckResult.create({
    data: {
      unitId: unit1.id,
      definitionId: qualityChecks[0].id,
      operatorId: operator1.id,
      result: 'pass',
      valuesJson: { measured: 1.05, unit: 'ohms' },
      timestamp: simTime(58),
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'quality_check_recorded',
      siteId: site.id,
      stationId: stationA.id,
      unitId: unit1.id,
      operatorId: operator1.id,
      payload: { checkName: 'Winding Resistance Check', result: 'pass', value: 1.05 },
      source: 'ui',
      timestampUtc: simTime(58),
    },
  });

  // Move Unit 1 to Station B
  await prisma.unit.update({
    where: { id: unit1.id },
    data: { currentStationId: stationB.id },
  });

  // Create and process Units 2, 3
  for (let i = 2; i <= 3; i++) {
    const serial = `MTR-0000${i}`;
    const unit = await prisma.unit.create({
      data: {
        workOrderId: workOrder.id,
        serialNumber: serial,
        status: 'in_progress',
        currentStationId: stationA.id,
      },
    });
    units.push({ id: unit.id, serial });

    const startTime = 60 + (i - 2) * 20;
    log(simTime(startTime), `📦 Unit ${serial} started at Station A`);

    await prisma.unitOperationExecution.create({
      data: {
        unitId: unit.id,
        operationId: operations[0].id,
        stationId: stationA.id,
        operatorId: operator1.id,
        startedAt: simTime(startTime),
        completedAt: simTime(startTime + 18),
        result: 'pass',
      },
    });

    await prisma.unitMaterialConsumption.create({
      data: {
        unitId: unit.id,
        materialLotId: materialLots[0].id,
        qtyConsumed: 2.5,
        stationId: stationA.id,
        operatorId: operator1.id,
        timestamp: simTime(startTime + 15),
      },
    });

    log(simTime(startTime + 18), `✅ Unit ${serial} completed at Station A`);

    await prisma.unit.update({
      where: { id: unit.id },
      data: { currentStationId: stationB.id },
    });
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 4: Station B Processing + Break (9:00 - 10:00)
  // ═══════════════════════════════════════════════════════

  log(simTime(120), '☕ Scheduled break - all stations paused');

  const breakDowntime = await prisma.downtimeInterval.create({
    data: {
      stationId: stationB.id,
      operatorId: operator2.id,
      startedAt: simTime(120),
      reasonId: breakReason?.id,
      endedAt: simTime(135),
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'downtime_started',
      siteId: site.id,
      stationId: stationB.id,
      operatorId: operator2.id,
      payload: { reason: 'Scheduled Break', planned: true },
      source: 'ui',
      timestampUtc: simTime(120),
    },
  });

  log(simTime(135), '🔄 Break ended, resuming production');

  // Process units at Station B
  for (let i = 0; i < 3; i++) {
    const unit = units[i];
    const startTime = 140 + i * 12;

    log(simTime(startTime), `🔧 Unit ${unit.serial} processing at Station B`);

    await prisma.unitOperationExecution.create({
      data: {
        unitId: unit.id,
        operationId: operations[1].id,
        stationId: stationB.id,
        operatorId: operator2.id,
        startedAt: simTime(startTime),
        completedAt: simTime(startTime + 10),
        result: 'pass',
      },
    });

    await prisma.unitMaterialConsumption.create({
      data: {
        unitId: unit.id,
        materialLotId: materialLots[1].id, // Magnets
        qtyConsumed: 4,
        stationId: stationB.id,
        operatorId: operator2.id,
        timestamp: simTime(startTime + 8),
      },
    });

    log(simTime(startTime + 10), `✅ Unit ${unit.serial} completed at Station B`);

    await prisma.unit.update({
      where: { id: unit.id },
      data: { currentStationId: stationC.id },
    });
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 5: Quality Failure at Final Test (10:30 - 11:30)
  // ═══════════════════════════════════════════════════════

  // Unit 1 passes final test
  log(simTime(180), `🔬 Unit ${units[0].serial} - Final Test starting`);

  await prisma.unitOperationExecution.create({
    data: {
      unitId: units[0].id,
      operationId: operations[2].id,
      stationId: stationC.id,
      operatorId: operator1.id,
      startedAt: simTime(180),
      completedAt: simTime(185),
      result: 'pass',
    },
  });

  await prisma.qualityCheckResult.create({
    data: {
      unitId: units[0].id,
      definitionId: qualityChecks[2].id, // RPM check
      operatorId: operator1.id,
      result: 'pass',
      valuesJson: { measured: 3010, unit: 'rpm' },
      timestamp: simTime(184),
    },
  });

  log(simTime(185), `✅ Unit ${units[0].serial} PASSED Final Test - COMPLETED!`);

  await prisma.unit.update({
    where: { id: units[0].id },
    data: { status: 'completed', currentStationId: null },
  });

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { qtyCompleted: { increment: 1 }, status: 'in_progress' },
  });

  // Unit 2 FAILS final test!
  log(simTime(190), `🔬 Unit ${units[1].serial} - Final Test starting`);

  await prisma.unitOperationExecution.create({
    data: {
      unitId: units[1].id,
      operationId: operations[2].id,
      stationId: stationC.id,
      operatorId: operator1.id,
      startedAt: simTime(190),
      completedAt: simTime(195),
      result: 'fail',
    },
  });

  await prisma.qualityCheckResult.create({
    data: {
      unitId: units[1].id,
      definitionId: qualityChecks[2].id,
      operatorId: operator1.id,
      result: 'fail',
      valuesJson: { measured: 2650, unit: 'rpm', note: 'Below minimum spec' },
      timestamp: simTime(194),
    },
  });

  log(simTime(195), `❌ Unit ${units[1].serial} FAILED Final Test - RPM too low!`);

  // Create NCR
  const ncr = await prisma.nonconformanceRecord.create({
    data: {
      unitId: units[1].id,
      stationId: stationC.id,
      defectType: 'RPM Below Spec',
      description: 'Final test RPM measured at 2650, minimum spec is 2800. Suspected winding issue.',
      status: 'open',
      createdAt: simTime(195),
    },
  });

  await prisma.unit.update({
    where: { id: units[1].id },
    data: { status: 'rework' },
  });

  await prisma.event.create({
    data: {
      eventType: 'ncr_created',
      siteId: site.id,
      stationId: stationC.id,
      unitId: units[1].id,
      operatorId: operator1.id,
      payload: { defectType: 'RPM Below Spec', ncrId: ncr.id },
      source: 'ui',
      timestampUtc: simTime(195),
    },
  });

  log(simTime(200), `📋 NCR created for ${units[1].serial} - awaiting disposition`);

  // ═══════════════════════════════════════════════════════
  // PHASE 6: NCR Disposition & Rework (11:30 - 12:30)
  // ═══════════════════════════════════════════════════════

  log(simTime(210), `👔 Supervisor reviewing NCR for ${units[1].serial}`);

  await prisma.nonconformanceRecord.update({
    where: { id: ncr.id },
    data: {
      disposition: 'rework',
      status: 'dispositioned',
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'ncr_dispositioned',
      siteId: site.id,
      unitId: units[1].id,
      operatorId: supervisor?.id,
      payload: { disposition: 'rework' },
      source: 'ui',
      timestampUtc: simTime(210),
    },
  });

  log(simTime(210), `🔄 NCR dispositioned as REWORK - unit returning to Station A`);

  // Return unit to Station A for rework
  await prisma.unit.update({
    where: { id: units[1].id },
    data: { currentStationId: stationA.id },
  });

  await prisma.event.create({
    data: {
      eventType: 'rework_created',
      siteId: site.id,
      stationId: stationA.id,
      unitId: units[1].id,
      operatorId: supervisor?.id,
      payload: { reason: 'RPM Below Spec', returnStation: stationA.name },
      source: 'ui',
      timestampUtc: simTime(210),
    },
  });

  // Continue with Unit 3 at final test
  log(simTime(215), `🔬 Unit ${units[2].serial} - Final Test`);

  await prisma.unitOperationExecution.create({
    data: {
      unitId: units[2].id,
      operationId: operations[2].id,
      stationId: stationC.id,
      operatorId: operator1.id,
      startedAt: simTime(215),
      completedAt: simTime(220),
      result: 'pass',
    },
  });

  await prisma.qualityCheckResult.create({
    data: {
      unitId: units[2].id,
      definitionId: qualityChecks[2].id,
      operatorId: operator1.id,
      result: 'pass',
      valuesJson: { measured: 2980, unit: 'rpm' },
      timestamp: simTime(219),
    },
  });

  log(simTime(220), `✅ Unit ${units[2].serial} PASSED - COMPLETED!`);

  await prisma.unit.update({
    where: { id: units[2].id },
    data: { status: 'completed', currentStationId: null },
  });

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { qtyCompleted: { increment: 1 } },
  });

  // ═══════════════════════════════════════════════════════
  // PHASE 7: Material Shortage Bottleneck (12:30 - 13:30)
  // ═══════════════════════════════════════════════════════

  // Create Units 4 and 5
  for (let i = 4; i <= 5; i++) {
    const serial = `MTR-0000${i}`;
    const unit = await prisma.unit.create({
      data: {
        workOrderId: workOrder.id,
        serialNumber: serial,
        status: 'in_progress',
        currentStationId: stationA.id,
      },
    });
    units.push({ id: unit.id, serial });
    log(simTime(230 + (i - 4) * 5), `📦 Unit ${serial} started`);
  }

  log(simTime(250), '⚠️ MATERIAL SHORTAGE - Waiting for magnets at Station B');

  const materialDowntime = await prisma.downtimeInterval.create({
    data: {
      stationId: stationB.id,
      operatorId: operator2.id,
      startedAt: simTime(250),
      reasonId: materialWaitReason?.id,
    },
  });

  await prisma.event.create({
    data: {
      eventType: 'downtime_started',
      siteId: site.id,
      stationId: stationB.id,
      operatorId: operator2.id,
      payload: { reason: 'Waiting for Material', material: 'MAG-NEOD-10MM' },
      source: 'ui',
      timestampUtc: simTime(250),
    },
  });

  log(simTime(280), '📦 Material received, resuming production');

  await prisma.downtimeInterval.update({
    where: { id: materialDowntime.id },
    data: { endedAt: simTime(280) },
  });

  // ═══════════════════════════════════════════════════════
  // PHASE 8: Rework Completion & Final Units (13:30 - 15:00)
  // ═══════════════════════════════════════════════════════

  // Complete rework on Unit 2
  log(simTime(290), `🔧 Unit ${units[1].serial} - Rework at Station A`);

  await prisma.unitOperationExecution.create({
    data: {
      unitId: units[1].id,
      operationId: operations[0].id,
      stationId: stationA.id,
      operatorId: operator1.id,
      startedAt: simTime(290),
      completedAt: simTime(310),
      result: 'pass',
      notes: 'Rework - rewound coil',
    },
  });

  log(simTime(310), `✅ Unit ${units[1].serial} - Rework completed, moving forward`);

  // Process through remaining stations
  for (const station of [stationB, stationC]) {
    const opIndex = station.sequenceOrder - 1;
    const startTime = 310 + opIndex * 15;

    await prisma.unit.update({
      where: { id: units[1].id },
      data: { currentStationId: station.id },
    });

    await prisma.unitOperationExecution.create({
      data: {
        unitId: units[1].id,
        operationId: operations[opIndex].id,
        stationId: station.id,
        operatorId: operator2.id,
        startedAt: simTime(startTime),
        completedAt: simTime(startTime + 10),
        result: 'pass',
      },
    });
  }

  // Final test pass for reworked unit
  await prisma.qualityCheckResult.create({
    data: {
      unitId: units[1].id,
      definitionId: qualityChecks[2].id,
      operatorId: operator1.id,
      result: 'pass',
      valuesJson: { measured: 3050, unit: 'rpm', note: 'After rework' },
      timestamp: simTime(340),
    },
  });

  log(simTime(340), `✅ Unit ${units[1].serial} - PASSED after rework - COMPLETED!`);

  // Close the NCR
  await prisma.nonconformanceRecord.update({
    where: { id: ncr.id },
    data: {
      status: 'closed',
      closedAt: simTime(340),
    },
  });

  await prisma.unit.update({
    where: { id: units[1].id },
    data: { status: 'completed', currentStationId: null },
  });

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { qtyCompleted: { increment: 1 } },
  });

  await prisma.event.create({
    data: {
      eventType: 'rework_completed',
      siteId: site.id,
      unitId: units[1].id,
      operatorId: operator1.id,
      payload: { serialNumber: units[1].serial },
      source: 'ui',
      timestampUtc: simTime(340),
    },
  });

  // Process remaining Units 4 and 5 through all stations
  for (let i = 3; i < 5; i++) {
    const unit = units[i];
    let currentTime = 300 + (i - 3) * 40;

    for (const station of [stationA, stationB, stationC]) {
      const opIndex = station.sequenceOrder - 1;

      await prisma.unit.update({
        where: { id: unit.id },
        data: { currentStationId: station.id },
      });

      await prisma.unitOperationExecution.create({
        data: {
          unitId: unit.id,
          operationId: operations[opIndex].id,
          stationId: station.id,
          operatorId: i % 2 === 0 ? operator1.id : operator2.id,
          startedAt: simTime(currentTime),
          completedAt: simTime(currentTime + 10),
          result: 'pass',
        },
      });

      currentTime += 12;
    }

    log(simTime(currentTime), `✅ Unit ${unit.serial} - COMPLETED!`);

    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: 'completed', currentStationId: null },
    });

    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { qtyCompleted: { increment: 1 } },
    });
  }

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════

  console.log('');
  console.log('═'.repeat(50));
  console.log('📊 SIMULATION SUMMARY');
  console.log('═'.repeat(50));

  const finalWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
  const downtimeIntervals = await prisma.downtimeInterval.findMany({
    where: { stationId: { in: stations.map(s => s.id) } },
  });
  const totalDowntimeMinutes = downtimeIntervals.reduce((sum, dt) => {
    if (dt.endedAt) {
      return sum + Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000);
    }
    return sum;
  }, 0);

  const ncrs = await prisma.nonconformanceRecord.findMany();
  const qualityResults = await prisma.qualityCheckResult.findMany();

  console.log('');
  console.log('Production Results:');
  console.log(`   ✅ Units Completed: ${finalWO?.qtyCompleted}/${finalWO?.qtyOrdered}`);
  console.log(`   📦 Units Created: ${units.length}`);
  console.log('');
  console.log('Downtime Analysis:');
  console.log(`   ⏱️  Total Downtime: ${totalDowntimeMinutes} minutes`);
  console.log(`   📉 Downtime Events: ${downtimeIntervals.length}`);
  downtimeIntervals.forEach(async (dt) => {
    const reason = await prisma.downtimeReason.findUnique({ where: { id: dt.reasonId ?? '' } });
    const duration = dt.endedAt
      ? Math.round((dt.endedAt.getTime() - dt.startedAt.getTime()) / 60000)
      : 'ongoing';
    console.log(`      - ${reason?.code ?? 'Unknown'}: ${duration} min`);
  });
  console.log('');
  console.log('Quality Metrics:');
  console.log(`   🔍 Quality Checks: ${qualityResults.length}`);
  console.log(`   ✅ Passed: ${qualityResults.filter(q => q.result === 'pass').length}`);
  console.log(`   ❌ Failed: ${qualityResults.filter(q => q.result === 'fail').length}`);
  console.log(`   📋 NCRs Created: ${ncrs.length}`);
  console.log(`   🔄 NCRs Closed: ${ncrs.filter(n => n.status === 'closed').length}`);
  console.log('');
  console.log('Key Events:');
  console.log('   1. Equipment failure at Station A (15 min)');
  console.log('   2. Scheduled break (15 min)');
  console.log('   3. Quality failure → NCR → Rework cycle');
  console.log('   4. Material shortage bottleneck (30 min)');
  console.log('');
  console.log('🎉 Simulation Complete!');
  console.log('   View dashboards at: http://localhost:3000/dashboard');
}

simulate()
  .catch((e) => {
    console.error('❌ Simulation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
