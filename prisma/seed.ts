import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================================================================
// DETERMINISTIC IDs - Same values every run for reproducible demos
// ============================================================================
const FIXED_IDS = {
  site: '11111111-1111-1111-1111-111111111111',
  stations: {
    a_winding: '22222222-1111-1111-1111-111111111111',
    b_magnet: '22222222-2222-2222-2222-222222222222',
    c_housing: '22222222-3333-3333-3333-333333333333',
    d_inspection: '22222222-4444-4444-4444-444444444444',
    e_electrical: '22222222-5555-5555-5555-555555555555',
    f_final: '22222222-6666-6666-6666-666666666666',
  },
  users: {
    admin: '33333333-1111-1111-1111-111111111111',
    supervisor: '33333333-2222-2222-2222-222222222222',
    operator1: '33333333-3333-3333-3333-333333333333',
    operator2: '33333333-4444-4444-4444-444444444444',
  },
  routing: '44444444-1111-1111-1111-111111111111',
  workOrder: '55555555-1111-1111-1111-111111111111',
};

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (in reverse dependency order)
  console.log('Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.qualityCheckResult.deleteMany();
  await prisma.unitMaterialConsumption.deleteMany();
  await prisma.downtimeInterval.deleteMany();
  await prisma.nonconformanceRecord.deleteMany();
  await prisma.unitOperationExecution.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.workOrderOperation.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.qualityCheckDefinition.deleteMany();
  await prisma.routing.deleteMany();
  await prisma.downtimeReason.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();
  await prisma.event.deleteMany();

  // Create Site
  console.log('Creating site...');
  const site = await prisma.site.create({
    data: {
      id: FIXED_IDS.site,
      name: 'Motor Assembly Plant',
      timezone: 'America/Los_Angeles',
      config: {
        serialPrefix: 'MTR',
        serialLength: 8,
      },
    },
  });

  // Create Stations (6-station motor assembly line)
  console.log('Creating stations...');
  const stationA = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.a_winding,
      name: 'Winding',
      stationType: 'winding',
      sequenceOrder: 1,
      siteId: site.id,
      config: {},
    },
  });

  const stationB = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.b_magnet,
      name: 'Magnet Install',
      stationType: 'assembly',
      sequenceOrder: 2,
      siteId: site.id,
      config: {},
    },
  });

  const stationC = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.c_housing,
      name: 'Housing Assembly',
      stationType: 'assembly',
      sequenceOrder: 3,
      siteId: site.id,
      config: {},
    },
  });

  const stationD = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.d_inspection,
      name: 'Quality Inspection',
      stationType: 'inspection',
      sequenceOrder: 4,
      siteId: site.id,
      config: {},
    },
  });

  const stationE = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.e_electrical,
      name: 'Electrical Test',
      stationType: 'test',
      sequenceOrder: 5,
      siteId: site.id,
      config: {},
    },
  });

  const stationF = await prisma.station.create({
    data: {
      id: FIXED_IDS.stations.f_final,
      name: 'Final Test',
      stationType: 'test',
      sequenceOrder: 6,
      siteId: site.id,
      config: {},
    },
  });

  const stations = [stationA, stationB, stationC, stationD, stationE, stationF];

  // Create Downtime Reasons
  console.log('Creating downtime reasons...');
  const downtimeReasons = await Promise.all([
    prisma.downtimeReason.create({
      data: {
        siteId: site.id,
        code: 'EQUIP_FAIL',
        description: 'Equipment Failure',
        lossType: 'equipment',
        isPlanned: false,
      },
    }),
    prisma.downtimeReason.create({
      data: {
        siteId: site.id,
        code: 'CHANGEOVER',
        description: 'Product Changeover',
        lossType: 'changeover',
        isPlanned: true,
      },
    }),
    prisma.downtimeReason.create({
      data: {
        siteId: site.id,
        code: 'MATERIAL_WAIT',
        description: 'Waiting for Material',
        lossType: 'material',
        isPlanned: false,
      },
    }),
    prisma.downtimeReason.create({
      data: {
        siteId: site.id,
        code: 'BREAK',
        description: 'Scheduled Break',
        lossType: 'planned',
        isPlanned: true,
      },
    }),
    prisma.downtimeReason.create({
      data: {
        siteId: site.id,
        code: 'QUALITY_HOLD',
        description: 'Quality Hold',
        lossType: 'quality',
        isPlanned: false,
      },
    }),
  ]);

  // Create Quality Check Definitions
  console.log('Creating quality check definitions...');
  const qualityChecks = await Promise.all([
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Winding Resistance Check',
        checkType: 'measurement',
        parameters: {
          unit: 'ohms',
          minValue: 0.5,
          maxValue: 1.5,
          nominal: 1.0,
        },
        stationIds: [stationA.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Visual Inspection',
        checkType: 'pass_fail',
        parameters: {
          criteria: ['No visible defects', 'Proper alignment', 'Clean surface'],
        },
        stationIds: [stationA.id, stationB.id, stationC.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Housing Torque Check',
        checkType: 'measurement',
        parameters: {
          unit: 'Nm',
          minValue: 2.5,
          maxValue: 3.5,
          nominal: 3.0,
        },
        stationIds: [stationC.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Full Quality Inspection',
        checkType: 'pass_fail',
        parameters: {
          criteria: ['Assembly complete', 'No gaps or misalignment', 'Labels applied', 'Cleanliness verified'],
        },
        stationIds: [stationD.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Electrical Test - Continuity',
        checkType: 'pass_fail',
        parameters: {
          criteria: ['Phase A continuity', 'Phase B continuity', 'Phase C continuity', 'No shorts to ground'],
        },
        stationIds: [stationE.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Electrical Test - Insulation',
        checkType: 'measurement',
        parameters: {
          unit: 'MΩ',
          minValue: 100,
          maxValue: 1000,
          nominal: 500,
        },
        stationIds: [stationE.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Final Test - RPM',
        checkType: 'measurement',
        parameters: {
          unit: 'rpm',
          minValue: 2800,
          maxValue: 3200,
          nominal: 3000,
        },
        stationIds: [stationF.id],
      },
    }),
    prisma.qualityCheckDefinition.create({
      data: {
        name: 'Final Test - Current Draw',
        checkType: 'measurement',
        parameters: {
          unit: 'amps',
          minValue: 1.8,
          maxValue: 2.2,
          nominal: 2.0,
        },
        stationIds: [stationF.id],
      },
    }),
  ]);

  // Create Routing
  console.log('Creating routing...');
  const routing = await prisma.routing.create({
    data: {
      id: FIXED_IDS.routing,
      name: 'Standard Motor Assembly',
      description: 'Standard 6-station motor assembly process',
      productCode: 'MOTOR-STD-001',
      operations: [
        { stationId: stationA.id, sequence: 1, estimatedMinutes: 15 },
        { stationId: stationB.id, sequence: 2, estimatedMinutes: 10 },
        { stationId: stationC.id, sequence: 3, estimatedMinutes: 12 },
        { stationId: stationD.id, sequence: 4, estimatedMinutes: 8 },
        { stationId: stationE.id, sequence: 5, estimatedMinutes: 6 },
        { stationId: stationF.id, sequence: 6, estimatedMinutes: 5 },
      ],
    },
  });

  // Create Material Lots
  console.log('Creating material lots...');
  const materialLots = await Promise.all([
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-WIRE-2024-001',
        materialCode: 'WIRE-CU-18AWG',
        description: 'Copper Winding Wire 18AWG',
        qtyReceived: 1000,
        qtyRemaining: 950,
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-MAG-2024-001',
        materialCode: 'MAG-NEOD-10MM',
        description: 'Neodymium Magnets 10mm',
        qtyReceived: 500,
        qtyRemaining: 480,
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-BEAR-2024-001',
        materialCode: 'BEAR-608-2RS',
        description: 'Ball Bearing 608-2RS',
        qtyReceived: 200,
        qtyRemaining: 190,
      },
    }),
  ]);

  // Create Demo Users (with placeholder Clerk IDs - replace with real ones)
  console.log('Creating demo users...');
  const adminUser = await prisma.user.create({
    data: {
      id: FIXED_IDS.users.admin,
      clerkId: 'user_demo_admin',
      email: 'admin@mes-demo.local',
      name: 'Admin User',
      role: Role.admin,
      sites: { connect: { id: site.id } },
    },
  });

  const supervisorUser = await prisma.user.create({
    data: {
      id: FIXED_IDS.users.supervisor,
      clerkId: 'user_demo_supervisor',
      email: 'supervisor@mes-demo.local',
      name: 'Supervisor User',
      role: Role.supervisor,
      sites: { connect: { id: site.id } },
    },
  });

  const operator1 = await prisma.user.create({
    data: {
      id: FIXED_IDS.users.operator1,
      clerkId: 'user_demo_operator1',
      email: 'operator1@mes-demo.local',
      name: 'Operator One',
      role: Role.operator,
      sites: { connect: { id: site.id } },
    },
  });

  const operator2 = await prisma.user.create({
    data: {
      id: FIXED_IDS.users.operator2,
      clerkId: 'user_demo_operator2',
      email: 'operator2@mes-demo.local',
      name: 'Operator Two',
      role: Role.operator,
      sites: { connect: { id: site.id } },
    },
  });

  const users = [adminUser, supervisorUser, operator1, operator2];

  // Create a demo Work Order
  console.log('Creating demo work order...');
  // Use fixed dates for deterministic demo
  const fixedReleaseDate = new Date('2024-01-15T08:00:00Z');
  const fixedDueDate = new Date('2024-01-22T08:00:00Z');

  const workOrder = await prisma.workOrder.create({
    data: {
      id: FIXED_IDS.workOrder,
      siteId: site.id,
      routingId: routing.id,
      orderNumber: 'WO-1001',
      productCode: 'MOTOR-STD-001',
      productName: 'Standard Motor Assembly',
      qtyOrdered: 5,
      qtyCompleted: 0,
      status: 'released',
      priority: 1,
      releasedAt: fixedReleaseDate,
      dueDate: fixedDueDate,
    },
  });

  // Create Work Order Operations
  console.log('Creating work order operations...');
  const operations = await Promise.all([
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationA.id,
        sequence: 1,
        estimatedMinutes: 15,
        status: 'pending',
      },
    }),
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationB.id,
        sequence: 2,
        estimatedMinutes: 10,
        status: 'pending',
      },
    }),
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationC.id,
        sequence: 3,
        estimatedMinutes: 12,
        status: 'pending',
      },
    }),
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationD.id,
        sequence: 4,
        estimatedMinutes: 8,
        status: 'pending',
      },
    }),
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationE.id,
        sequence: 5,
        estimatedMinutes: 6,
        status: 'pending',
      },
    }),
    prisma.workOrderOperation.create({
      data: {
        workOrderId: workOrder.id,
        stationId: stationF.id,
        sequence: 6,
        estimatedMinutes: 5,
        status: 'pending',
      },
    }),
  ]);

  // Create initial event for work order release
  console.log('Creating initial events...');
  await prisma.event.create({
    data: {
      eventType: 'work_order_released',
      siteId: site.id,
      workOrderId: workOrder.id,
      operatorId: adminUser.id,
      payload: {
        orderNumber: workOrder.orderNumber,
        productCode: workOrder.productCode,
        qtyOrdered: workOrder.qtyOrdered,
      },
      source: 'ui',
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Site: ${site.name}`);
  console.log(`   - Stations: ${stations.length}`);
  console.log(`   - Downtime Reasons: ${downtimeReasons.length}`);
  console.log(`   - Quality Checks: ${qualityChecks.length}`);
  console.log(`   - Material Lots: ${materialLots.length}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Work Order: ${workOrder.orderNumber} (${workOrder.qtyOrdered} units)`);
  console.log('\n🚀 Ready for demo!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
