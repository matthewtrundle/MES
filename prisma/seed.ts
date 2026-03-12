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
  await prisma.stepDataCapture.deleteMany();
  await prisma.processStepDefinition.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.kitLine.deleteMany();
  await prisma.kit.deleteMany();
  await prisma.qualityCheckResult.deleteMany();
  await prisma.unitMaterialConsumption.deleteMany();
  await prisma.downtimeInterval.deleteMany();
  await prisma.nonconformanceRecord.deleteMany();
  await prisma.unitOperationExecution.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.workOrderOperation.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.billOfMaterial.deleteMany();
  await prisma.qualityCheckDefinition.deleteMany();
  await prisma.routing.deleteMany();
  await prisma.downtimeReason.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();
  // Disable immutable events trigger temporarily, then truncate
  await prisma.$executeRawUnsafe(`ALTER TABLE events DISABLE TRIGGER ALL`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE events CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE events ENABLE TRIGGER ALL`);

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

  // Create Bill of Materials
  console.log('Creating BOM...');
  await Promise.all([
    prisma.billOfMaterial.create({
      data: {
        routingId: routing.id,
        stationId: stationA.id,
        materialCode: 'WIRE-CU-18AWG',
        description: 'Copper Winding Wire 18AWG',
        qtyPerUnit: 50,
        unitOfMeasure: 'FT',
      },
    }),
    prisma.billOfMaterial.create({
      data: {
        routingId: routing.id,
        stationId: stationB.id,
        materialCode: 'MAG-NEOD-10MM',
        description: 'Neodymium Magnets 10mm',
        qtyPerUnit: 4,
        unitOfMeasure: 'EA',
      },
    }),
    prisma.billOfMaterial.create({
      data: {
        routingId: routing.id,
        stationId: stationC.id,
        materialCode: 'HOUS-ALU-M42',
        description: 'Aluminum Housing M42',
        qtyPerUnit: 1,
        unitOfMeasure: 'EA',
      },
    }),
    prisma.billOfMaterial.create({
      data: {
        routingId: routing.id,
        stationId: stationC.id,
        materialCode: 'BEAR-608-2RS',
        description: 'Ball Bearing 608-2RS',
        qtyPerUnit: 2,
        unitOfMeasure: 'EA',
      },
    }),
    prisma.billOfMaterial.create({
      data: {
        routingId: routing.id,
        stationId: stationC.id,
        materialCode: 'SEAL-NBR-42',
        description: 'NBR Seal Ring 42mm',
        qtyPerUnit: 2,
        unitOfMeasure: 'EA',
      },
    }),
  ]);

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
        unitOfMeasure: 'FT',
        supplier: 'Acme Wire Co',
        purchaseOrderNumber: 'PO-2024-001',
        status: 'available',
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-MAG-2024-001',
        materialCode: 'MAG-NEOD-10MM',
        description: 'Neodymium Magnets 10mm',
        qtyReceived: 500,
        qtyRemaining: 480,
        unitOfMeasure: 'EA',
        supplier: 'MagnetWorld',
        purchaseOrderNumber: 'PO-2024-002',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-BEAR-2024-001',
        materialCode: 'BEAR-608-2RS',
        description: 'Ball Bearing 608-2RS',
        qtyReceived: 200,
        qtyRemaining: 190,
        unitOfMeasure: 'EA',
        supplier: 'BearingsCo',
        purchaseOrderNumber: 'PO-2024-003',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-HOUS-2024-001',
        materialCode: 'HOUS-ALU-M42',
        description: 'Aluminum Housing M42',
        qtyReceived: 100,
        qtyRemaining: 95,
        unitOfMeasure: 'EA',
        supplier: 'CastingCo',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-SEAL-2024-001',
        materialCode: 'SEAL-NBR-42',
        description: 'NBR Seal Ring 42mm',
        qtyReceived: 300,
        qtyRemaining: 290,
        unitOfMeasure: 'EA',
        supplier: 'SealTech',
        status: 'available',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Expiring soon for demo
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

  // Create Shifts
  console.log('Creating shifts...');
  const shifts = await Promise.all([
    prisma.shift.create({
      data: {
        siteId: site.id,
        name: 'Day Shift',
        startTime: '06:00',
        endTime: '14:00',
        active: true,
      },
    }),
    prisma.shift.create({
      data: {
        siteId: site.id,
        name: 'Swing Shift',
        startTime: '14:00',
        endTime: '22:00',
        active: true,
      },
    }),
    prisma.shift.create({
      data: {
        siteId: site.id,
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:00',
        active: true,
      },
    }),
  ]);

  // ==========================================================================
  // Create 26 Process Step Definitions for BLDC Motor Production
  // ==========================================================================
  console.log('Creating process step definitions (26 steps)...');

  const processSteps = await Promise.all([
    // ---- Stator Production (Steps 1-7) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Winding',
        description: 'Wind stator coils with specified wire gauge and turns count',
        sequenceOrder: 1,
        category: 'stator',
        cycleTimeTarget: 12,
        dataFields: [
          { key: 'wire_gauge', label: 'Wire Gauge', type: 'select', options: ['16AWG', '18AWG', '20AWG', '22AWG'], required: true },
          { key: 'turns_count', label: 'Turns Count', type: 'number', unit: 'turns', min: 80, max: 120, nominal: 100, required: true },
          { key: 'resistance', label: 'Resistance Measurement', type: 'measurement', unit: 'ohms', min: 0.5, max: 1.5, nominal: 1.0, required: true },
          { key: 'winding_direction', label: 'Winding Direction', type: 'select', options: ['CW', 'CCW'], required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Stator Lamination Stack Assembly',
        description: 'Assemble and press stator lamination stack to specified height',
        sequenceOrder: 2,
        category: 'stator',
        cycleTimeTarget: 8,
        dataFields: [
          { key: 'stack_height', label: 'Stack Height', type: 'measurement', unit: 'mm', min: 24.8, max: 25.2, nominal: 25.0, required: true },
          { key: 'press_force', label: 'Press Force', type: 'measurement', unit: 'kN', min: 4.5, max: 5.5, nominal: 5.0, required: true },
          { key: 'lamination_count', label: 'Lamination Count', type: 'number', unit: 'pcs', min: 48, max: 52, nominal: 50, required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Insulation Application',
        description: 'Apply slot insulation and verify complete coverage',
        sequenceOrder: 3,
        category: 'stator',
        cycleTimeTarget: 6,
        dataFields: [
          { key: 'insulation_type', label: 'Insulation Type', type: 'select', options: ['Nomex 410', 'Kapton', 'Mylar'], required: true },
          { key: 'coverage_check', label: 'Coverage Check', type: 'boolean', required: true },
          { key: 'insulation_thickness', label: 'Insulation Thickness', type: 'measurement', unit: 'mm', min: 0.18, max: 0.22, nominal: 0.20, required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Lead Wire Termination',
        description: 'Terminate lead wires and verify crimp quality',
        sequenceOrder: 4,
        category: 'stator',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'crimp_force', label: 'Crimp Force', type: 'measurement', unit: 'N', min: 45, max: 55, nominal: 50, required: true },
          { key: 'pull_test', label: 'Pull Test Force', type: 'measurement', unit: 'N', min: 30, max: 100, nominal: 50, required: true },
          { key: 'pull_test_pass', label: 'Pull Test Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Stator Varnish/Epoxy',
        description: 'Apply varnish or epoxy impregnation and cure',
        sequenceOrder: 5,
        category: 'stator',
        cycleTimeTarget: 15,
        dataFields: [
          { key: 'varnish_type', label: 'Varnish Type', type: 'select', options: ['Polyester', 'Epoxy', 'Silicone'], required: true },
          { key: 'cure_temp', label: 'Cure Temperature', type: 'measurement', unit: 'C', min: 145, max: 155, nominal: 150, required: true },
          { key: 'cure_time', label: 'Cure Time', type: 'measurement', unit: 'min', min: 55, max: 65, nominal: 60, required: true },
          { key: 'cure_complete', label: 'Cure Complete', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationE.id,
        name: 'Stator Electrical Test',
        description: 'Perform hi-pot, surge, and resistance tests on stator',
        sequenceOrder: 6,
        category: 'stator',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'hipot_voltage', label: 'Hi-Pot Test Voltage', type: 'measurement', unit: 'VAC', min: 1490, max: 1510, nominal: 1500, required: true },
          { key: 'hipot_pass', label: 'Hi-Pot Pass', type: 'boolean', required: true },
          { key: 'surge_test_pass', label: 'Surge Test Pass', type: 'boolean', required: true },
          { key: 'phase_resistance', label: 'Phase Resistance', type: 'measurement', unit: 'ohms', min: 0.5, max: 1.5, nominal: 1.0, required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationD.id,
        name: 'Stator Dimensional Inspection',
        description: 'Measure stator outer diameter, inner diameter, and stack height',
        sequenceOrder: 7,
        category: 'stator',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'outer_diameter', label: 'Outer Diameter', type: 'measurement', unit: 'mm', min: 41.95, max: 42.05, nominal: 42.0, required: true },
          { key: 'inner_diameter', label: 'Inner Diameter', type: 'measurement', unit: 'mm', min: 24.95, max: 25.05, nominal: 25.0, required: true },
          { key: 'stack_height', label: 'Stack Height', type: 'measurement', unit: 'mm', min: 24.8, max: 25.2, nominal: 25.0, required: true },
        ],
      },
    }),

    // ---- Rotor Assembly (Steps 8-11) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationB.id,
        name: 'Magnet Bonding',
        description: 'Bond magnets to rotor with proper adhesive and orientation',
        sequenceOrder: 8,
        category: 'rotor',
        cycleTimeTarget: 10,
        dataFields: [
          { key: 'adhesive_type', label: 'Adhesive Type', type: 'select', options: ['Loctite 638', 'Loctite 648', 'Epoxy 2216'], required: true },
          { key: 'cure_temp', label: 'Cure Temperature', type: 'measurement', unit: 'C', min: 20, max: 25, nominal: 23, required: true },
          { key: 'magnet_orientation', label: 'Magnet Orientation Check', type: 'boolean', required: true },
          { key: 'magnet_count', label: 'Magnet Count', type: 'number', unit: 'pcs', min: 4, max: 4, nominal: 4, required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationB.id,
        name: 'Rotor Balancing',
        description: 'Balance rotor and apply correction if needed',
        sequenceOrder: 9,
        category: 'rotor',
        cycleTimeTarget: 8,
        dataFields: [
          { key: 'imbalance_grams', label: 'Imbalance', type: 'measurement', unit: 'g', min: 0, max: 0.5, nominal: 0, required: true },
          { key: 'correction_method', label: 'Correction Method', type: 'select', options: ['None needed', 'Material removal', 'Weight addition'], required: true },
          { key: 'balance_pass', label: 'Balance Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationB.id,
        name: 'Shaft Press',
        description: 'Press shaft into rotor core and verify runout',
        sequenceOrder: 10,
        category: 'rotor',
        cycleTimeTarget: 6,
        dataFields: [
          { key: 'press_force', label: 'Press Force', type: 'measurement', unit: 'kN', min: 2.8, max: 3.2, nominal: 3.0, required: true },
          { key: 'runout', label: 'Shaft Runout', type: 'measurement', unit: 'mm', min: 0, max: 0.02, nominal: 0, required: true },
          { key: 'press_pass', label: 'Press Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationD.id,
        name: 'Rotor Dimensional Inspection',
        description: 'Inspect rotor outer diameter and shaft runout',
        sequenceOrder: 11,
        category: 'rotor',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'rotor_od', label: 'Rotor OD', type: 'measurement', unit: 'mm', min: 24.45, max: 24.55, nominal: 24.5, required: true },
          { key: 'shaft_runout', label: 'Shaft Runout', type: 'measurement', unit: 'mm', min: 0, max: 0.02, nominal: 0, required: true },
          { key: 'inspection_pass', label: 'Inspection Pass', type: 'boolean', required: true },
        ],
      },
    }),

    // ---- Wire Harness (Steps 12-14) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Wire Cutting/Stripping',
        description: 'Cut wires to length and strip insulation',
        sequenceOrder: 12,
        category: 'wire_harness',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'wire_length', label: 'Wire Length', type: 'measurement', unit: 'mm', min: 148, max: 152, nominal: 150, required: true },
          { key: 'strip_length', label: 'Strip Length', type: 'measurement', unit: 'mm', min: 5.5, max: 6.5, nominal: 6.0, required: true },
          { key: 'wire_count', label: 'Wire Count', type: 'number', unit: 'pcs', min: 3, max: 3, nominal: 3, required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationA.id,
        name: 'Connector Crimping',
        description: 'Crimp connectors and verify quality',
        sequenceOrder: 13,
        category: 'wire_harness',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'crimp_height', label: 'Crimp Height', type: 'measurement', unit: 'mm', min: 1.8, max: 2.2, nominal: 2.0, required: true },
          { key: 'pull_force', label: 'Pull Force', type: 'measurement', unit: 'N', min: 30, max: 100, nominal: 50, required: true },
          { key: 'crimp_pass', label: 'Crimp Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationE.id,
        name: 'Harness Continuity Test',
        description: 'Test harness continuity and resistance per conductor',
        sequenceOrder: 14,
        category: 'wire_harness',
        cycleTimeTarget: 3,
        dataFields: [
          { key: 'conductor_a_resistance', label: 'Conductor A Resistance', type: 'measurement', unit: 'mohms', min: 0, max: 50, nominal: 10, required: true },
          { key: 'conductor_b_resistance', label: 'Conductor B Resistance', type: 'measurement', unit: 'mohms', min: 0, max: 50, nominal: 10, required: true },
          { key: 'conductor_c_resistance', label: 'Conductor C Resistance', type: 'measurement', unit: 'mohms', min: 0, max: 50, nominal: 10, required: true },
          { key: 'continuity_pass', label: 'Continuity Pass', type: 'boolean', required: true },
        ],
      },
    }),

    // ---- Base/Housing Assembly (Steps 15-17) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Bearing Press',
        description: 'Press bearings into housing bores',
        sequenceOrder: 15,
        category: 'base_housing',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'press_force', label: 'Press Force', type: 'measurement', unit: 'kN', min: 0.8, max: 1.2, nominal: 1.0, required: true },
          { key: 'bearing_type', label: 'Bearing Type', type: 'select', options: ['608-2RS', '6001-2RS', '6002-2RS'], required: true },
          { key: 'bearing_seated', label: 'Bearing Fully Seated', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Seal Installation',
        description: 'Install seals and verify orientation',
        sequenceOrder: 16,
        category: 'base_housing',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'seal_type', label: 'Seal Type', type: 'select', options: ['NBR 42mm', 'Viton 42mm', 'PTFE 42mm'], required: true },
          { key: 'orientation_check', label: 'Orientation Correct', type: 'boolean', required: true },
          { key: 'seal_seated', label: 'Seal Fully Seated', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationD.id,
        name: 'Base Dimensional Inspection',
        description: 'Inspect bearing bore and mounting hole dimensions',
        sequenceOrder: 17,
        category: 'base_housing',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'bearing_bore', label: 'Bearing Bore Diameter', type: 'measurement', unit: 'mm', min: 21.98, max: 22.02, nominal: 22.0, required: true },
          { key: 'mounting_hole_spacing', label: 'Mounting Hole Spacing', type: 'measurement', unit: 'mm', min: 49.9, max: 50.1, nominal: 50.0, required: true },
          { key: 'inspection_pass', label: 'Inspection Pass', type: 'boolean', required: true },
        ],
      },
    }),

    // ---- Final Assembly (Steps 18-23) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Rotor Insertion',
        description: 'Insert rotor into stator and verify clearance and free rotation',
        sequenceOrder: 18,
        category: 'final_assembly',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'air_gap_clearance', label: 'Air Gap Clearance', type: 'measurement', unit: 'mm', min: 0.3, max: 0.7, nominal: 0.5, required: true },
          { key: 'free_rotation', label: 'Free Rotation Check', type: 'boolean', required: true },
          { key: 'no_rubbing', label: 'No Rubbing/Contact', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'End Bell Assembly',
        description: 'Attach end bell with proper torque and gasket',
        sequenceOrder: 19,
        category: 'final_assembly',
        cycleTimeTarget: 6,
        dataFields: [
          { key: 'torque_spec', label: 'Fastener Torque', type: 'measurement', unit: 'Nm', min: 2.5, max: 3.5, nominal: 3.0, required: true },
          { key: 'gasket_check', label: 'Gasket Properly Seated', type: 'boolean', required: true },
          { key: 'all_fasteners_installed', label: 'All Fasteners Installed', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Wire Harness Routing',
        description: 'Route wire harness through housing and install strain relief',
        sequenceOrder: 20,
        category: 'final_assembly',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'routing_path', label: 'Routing Path Correct', type: 'boolean', required: true },
          { key: 'strain_relief', label: 'Strain Relief Installed', type: 'boolean', required: true },
          { key: 'no_pinch_points', label: 'No Pinch Points', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Connector Mating',
        description: 'Mate connectors and verify engagement and locking',
        sequenceOrder: 21,
        category: 'final_assembly',
        cycleTimeTarget: 3,
        dataFields: [
          { key: 'engagement_check', label: 'Full Engagement Check', type: 'boolean', required: true },
          { key: 'locking_mechanism', label: 'Locking Mechanism Engaged', type: 'boolean', required: true },
          { key: 'pull_test_pass', label: 'Pull Test Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Cover/Housing Closure',
        description: 'Close housing cover with proper torque and seal verification',
        sequenceOrder: 22,
        category: 'final_assembly',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'torque_spec', label: 'Cover Torque', type: 'measurement', unit: 'Nm', min: 2.0, max: 3.0, nominal: 2.5, required: true },
          { key: 'seal_verification', label: 'Seal Verified', type: 'boolean', required: true },
          { key: 'all_fasteners', label: 'All Fasteners Installed', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationC.id,
        name: 'Label Application',
        description: 'Apply product and serial labels, verify placement and readability',
        sequenceOrder: 23,
        category: 'final_assembly',
        cycleTimeTarget: 3,
        dataFields: [
          { key: 'label_type', label: 'Label Type', type: 'select', options: ['Product Label', 'Serial Label', 'Rating Label', 'Safety Label'], required: true },
          { key: 'placement_correct', label: 'Placement Correct', type: 'boolean', required: true },
          { key: 'readability_check', label: 'Readability Check', type: 'boolean', required: true },
        ],
      },
    }),

    // ---- End-of-Line Testing (Steps 24-26) ----
    prisma.processStepDefinition.create({
      data: {
        stationId: stationE.id,
        name: 'Hi-Pot Test',
        description: 'High-potential dielectric withstand test',
        sequenceOrder: 24,
        category: 'eol_testing',
        cycleTimeTarget: 3,
        dataFields: [
          { key: 'test_voltage', label: 'Test Voltage', type: 'measurement', unit: 'VAC', min: 1490, max: 1510, nominal: 1500, required: true },
          { key: 'leakage_current', label: 'Leakage Current', type: 'measurement', unit: 'mA', min: 0, max: 5.0, nominal: 1.0, required: true },
          { key: 'hipot_pass', label: 'Hi-Pot Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationF.id,
        name: 'Functional Run Test',
        description: 'Run motor under load and measure performance parameters',
        sequenceOrder: 25,
        category: 'eol_testing',
        cycleTimeTarget: 5,
        dataFields: [
          { key: 'rpm', label: 'Motor RPM', type: 'measurement', unit: 'rpm', min: 2800, max: 3200, nominal: 3000, required: true },
          { key: 'current_draw', label: 'Current Draw', type: 'measurement', unit: 'A', min: 1.8, max: 2.2, nominal: 2.0, required: true },
          { key: 'vibration_level', label: 'Vibration Level', type: 'measurement', unit: 'mm/s', min: 0, max: 2.5, nominal: 1.0, required: true },
          { key: 'noise_level', label: 'Noise Level', type: 'measurement', unit: 'dBA', min: 0, max: 55, nominal: 40, required: false },
          { key: 'run_test_pass', label: 'Run Test Pass', type: 'boolean', required: true },
        ],
      },
    }),
    prisma.processStepDefinition.create({
      data: {
        stationId: stationF.id,
        name: 'Final Inspection',
        description: 'Final cosmetic inspection and packaging readiness check',
        sequenceOrder: 26,
        category: 'eol_testing',
        cycleTimeTarget: 4,
        dataFields: [
          { key: 'cosmetic_check', label: 'Cosmetic Check Pass', type: 'boolean', required: true },
          { key: 'packaging_readiness', label: 'Packaging Readiness', type: 'boolean', required: true },
          { key: 'documentation_complete', label: 'Documentation Complete', type: 'boolean', required: true },
          { key: 'final_disposition', label: 'Final Disposition', type: 'select', options: ['Ship', 'Hold', 'Rework'], required: true },
        ],
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
  console.log(`   - Shifts: ${shifts.length}`);
  console.log(`   - Process Steps: ${processSteps.length}`);
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
