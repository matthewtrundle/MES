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
  workOrder2: '55555555-2222-2222-2222-222222222222',
  suppliers: {
    acmeWire: '66666666-1111-1111-1111-111111111111',
    magnetWorld: '66666666-2222-2222-2222-222222222222',
    bearingsCo: '66666666-3333-3333-3333-333333333333',
    castingCo: '66666666-4444-4444-4444-444444444444',
    sealTech: '66666666-5555-5555-5555-555555555555',
  },
  parts: {
    wire: '77777777-1111-1111-1111-111111111111',
    magnet: '77777777-2222-2222-2222-222222222222',
    housing: '77777777-3333-3333-3333-333333333333',
    bearing: '77777777-4444-4444-4444-444444444444',
    seal: '77777777-5555-5555-5555-555555555555',
    lamination: '77777777-6666-6666-6666-666666666666',
    connector: '77777777-7777-7777-7777-777777777777',
  },
  units: {
    unit1: '88888888-1111-1111-1111-111111111111',
    unit2: '88888888-2222-2222-2222-222222222222',
    unit3: '88888888-3333-3333-3333-333333333333',
    unit4: '88888888-4444-4444-4444-444444444444',
    unit5: '88888888-5555-5555-5555-555555555555',
  },
  steps: {
    winding: '99999999-0001-0001-0001-000000000001',
    stator_lamination: '99999999-0001-0001-0001-000000000002',
    insulation: '99999999-0001-0001-0001-000000000003',
    lead_wire: '99999999-0001-0001-0001-000000000004',
    varnish: '99999999-0001-0001-0001-000000000005',
    stator_electrical: '99999999-0001-0001-0001-000000000006',
    stator_dimensional: '99999999-0001-0001-0001-000000000007',
    magnet_bonding: '99999999-0001-0001-0001-000000000008',
    rotor_balancing: '99999999-0001-0001-0001-000000000009',
    shaft_press: '99999999-0001-0001-0001-000000000010',
    rotor_dimensional: '99999999-0001-0001-0001-000000000011',
    wire_cutting: '99999999-0001-0001-0001-000000000012',
    connector_crimping: '99999999-0001-0001-0001-000000000013',
    harness_continuity: '99999999-0001-0001-0001-000000000014',
    bearing_press: '99999999-0001-0001-0001-000000000015',
    seal_installation: '99999999-0001-0001-0001-000000000016',
    base_dimensional: '99999999-0001-0001-0001-000000000017',
    rotor_insertion: '99999999-0001-0001-0001-000000000018',
    end_bell: '99999999-0001-0001-0001-000000000019',
    wire_harness_routing: '99999999-0001-0001-0001-000000000020',
    connector_mating: '99999999-0001-0001-0001-000000000021',
    cover_closure: '99999999-0001-0001-0001-000000000022',
    label_application: '99999999-0001-0001-0001-000000000023',
    hipot_test: '99999999-0001-0001-0001-000000000024',
    functional_run: '99999999-0001-0001-0001-000000000025',
    final_inspection: '99999999-0001-0001-0001-000000000026',
  },
};

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (in reverse dependency order)
  console.log('Cleaning existing data...');
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookSubscription.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.shipmentLine.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.eolTestResult.deleteMany();
  await prisma.eolTestParameter.deleteMany();
  await prisma.eolTestSuite.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.iQCResult.deleteMany();
  await prisma.incomingInspection.deleteMany();
  await prisma.cTQMeasurement.deleteMany();
  await prisma.cTQDefinition.deleteMany();
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
  await prisma.purchaseOrderLineItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.partSupplier.deleteMany();
  await prisma.partMaster.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.billOfMaterial.deleteMany();
  await prisma.qualityCheckDefinition.deleteMany();
  await prisma.routing.deleteMany();
  await prisma.downtimeReason.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.aIInsight.deleteMany();
  await prisma.aIConversation.deleteMany();
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

  // ==========================================================================
  // Create Suppliers
  // ==========================================================================
  console.log('Creating suppliers...');
  const supplierAcme = await prisma.supplier.create({
    data: {
      id: FIXED_IDS.suppliers.acmeWire,
      name: 'Acme Wire Co',
      supplierId: 'SUP-001',
      contactEmail: 'orders@acmewire.com',
      contactPhone: '+1-555-0101',
      address: '1234 Industrial Blvd, Detroit, MI 48201',
      countryOfOrigin: 'US',
      qualificationStatus: 'qualified',
    },
  });
  const supplierMagnet = await prisma.supplier.create({
    data: {
      id: FIXED_IDS.suppliers.magnetWorld,
      name: 'MagnetWorld Inc',
      supplierId: 'SUP-002',
      contactEmail: 'sales@magnetworld.com',
      contactPhone: '+1-555-0202',
      address: '5678 Magnetic Dr, Austin, TX 78701',
      countryOfOrigin: 'JP',
      qualificationStatus: 'qualified',
    },
  });
  const supplierBearings = await prisma.supplier.create({
    data: {
      id: FIXED_IDS.suppliers.bearingsCo,
      name: 'BearingsCo Ltd',
      supplierId: 'SUP-003',
      contactEmail: 'info@bearingsco.com',
      contactPhone: '+1-555-0303',
      address: '910 Precision Way, Cleveland, OH 44101',
      countryOfOrigin: 'DE',
      qualificationStatus: 'qualified',
    },
  });
  const supplierCasting = await prisma.supplier.create({
    data: {
      id: FIXED_IDS.suppliers.castingCo,
      name: 'CastingCo Industries',
      supplierId: 'SUP-004',
      contactEmail: 'procurement@castingco.com',
      contactPhone: '+1-555-0404',
      address: '2468 Foundry Ln, Pittsburgh, PA 15201',
      countryOfOrigin: 'US',
      qualificationStatus: 'qualified',
    },
  });
  const supplierSeal = await prisma.supplier.create({
    data: {
      id: FIXED_IDS.suppliers.sealTech,
      name: 'SealTech Solutions',
      supplierId: 'SUP-005',
      contactEmail: 'orders@sealtech.com',
      contactPhone: '+1-555-0505',
      address: '1357 Polymer Ave, Akron, OH 44301',
      countryOfOrigin: 'US',
      qualificationStatus: 'conditional',
      notes: 'Conditional approval — pending ISO 9001 recertification due 2026-06',
    },
  });

  // ==========================================================================
  // Create Part Masters
  // ==========================================================================
  console.log('Creating part masters...');
  const partWire = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.wire,
      partNumber: '510-00001',
      name: 'Copper Winding Wire 18AWG',
      description: 'Magnet wire, polyester-imide insulated, 18AWG',
      category: 'raw_material',
      unitOfMeasure: 'FT',
      reorderPoint: 500,
      targetStockLevel: 2000,
      standardCost: 0.15,
      serializationType: 'lot',
    },
  });
  const partMagnet = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.magnet,
      partNumber: '510-00002',
      name: 'Neodymium Magnet 10mm',
      description: 'N52 grade NdFeB permanent magnet, 10mm dia x 5mm',
      category: 'component',
      unitOfMeasure: 'EA',
      reorderPoint: 100,
      targetStockLevel: 600,
      standardCost: 2.50,
      serializationType: 'lot',
      countryOfOrigin: 'JP',
    },
  });
  const partHousing = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.housing,
      partNumber: '510-00003',
      name: 'Aluminum Housing M42',
      description: 'Die-cast aluminum motor housing, M42 frame size',
      category: 'component',
      unitOfMeasure: 'EA',
      reorderPoint: 25,
      targetStockLevel: 120,
      standardCost: 18.75,
      serializationType: 'serial',
    },
  });
  const partBearing = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.bearing,
      partNumber: '510-00004',
      name: 'Ball Bearing 608-2RS',
      description: 'Deep groove ball bearing, 608-2RS, 8x22x7mm',
      category: 'component',
      unitOfMeasure: 'EA',
      reorderPoint: 50,
      targetStockLevel: 250,
      standardCost: 3.20,
      serializationType: 'lot',
      countryOfOrigin: 'DE',
    },
  });
  const partSeal = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.seal,
      partNumber: '510-00005',
      name: 'NBR Seal Ring 42mm',
      description: 'Nitrile butadiene rubber shaft seal, 42mm ID',
      category: 'component',
      unitOfMeasure: 'EA',
      reorderPoint: 60,
      targetStockLevel: 350,
      standardCost: 1.10,
      serializationType: 'lot',
    },
  });
  const partLamination = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.lamination,
      partNumber: '510-00006',
      name: 'Stator Lamination Stack',
      description: 'Silicon steel lamination stack, 0.5mm thickness',
      category: 'subassembly',
      unitOfMeasure: 'EA',
      reorderPoint: 20,
      targetStockLevel: 100,
      standardCost: 12.00,
      serializationType: 'lot',
      countryOfOrigin: 'US',
    },
  });
  const partConnector = await prisma.partMaster.create({
    data: {
      id: FIXED_IDS.parts.connector,
      partNumber: '510-00007',
      name: '3-Phase Motor Connector',
      description: '3-pin power connector, IP67 rated, 30A',
      category: 'component',
      unitOfMeasure: 'EA',
      reorderPoint: 30,
      targetStockLevel: 150,
      standardCost: 5.40,
      serializationType: 'none',
    },
  });

  // ==========================================================================
  // Create Part-Supplier Links
  // ==========================================================================
  console.log('Creating part-supplier links...');
  await Promise.all([
    prisma.partSupplier.create({ data: { partId: partWire.id, supplierId: supplierAcme.id, supplierPartNumber: 'ACW-18-PE', isPreferred: true, unitCost: 0.14, leadTimeDays: 7 } }),
    prisma.partSupplier.create({ data: { partId: partMagnet.id, supplierId: supplierMagnet.id, supplierPartNumber: 'MW-N52-10', isPreferred: true, unitCost: 2.35, leadTimeDays: 21 } }),
    prisma.partSupplier.create({ data: { partId: partHousing.id, supplierId: supplierCasting.id, supplierPartNumber: 'CC-ALU-M42', isPreferred: true, unitCost: 17.50, leadTimeDays: 14 } }),
    prisma.partSupplier.create({ data: { partId: partBearing.id, supplierId: supplierBearings.id, supplierPartNumber: 'BC-608-2RS', isPreferred: true, unitCost: 2.95, leadTimeDays: 10 } }),
    prisma.partSupplier.create({ data: { partId: partSeal.id, supplierId: supplierSeal.id, supplierPartNumber: 'ST-NBR-42', isPreferred: true, unitCost: 0.98, leadTimeDays: 5 } }),
    prisma.partSupplier.create({ data: { partId: partLamination.id, supplierId: supplierCasting.id, supplierPartNumber: 'CC-LAM-STK', isPreferred: true, unitCost: 11.20, leadTimeDays: 14 } }),
    prisma.partSupplier.create({ data: { partId: partConnector.id, supplierId: supplierAcme.id, supplierPartNumber: 'ACW-CON-3P', isPreferred: true, unitCost: 4.90, leadTimeDays: 7 } }),
  ]);

  // ==========================================================================
  // Create Purchase Orders
  // ==========================================================================
  console.log('Creating purchase orders...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0001',
      supplierId: supplierAcme.id,
      buyerName: 'Admin User',
      orderDate: new Date('2026-01-10'),
      expectedDate: new Date('2026-01-20'),
      status: 'fully_received',
      totalValue: 826.00,
      paymentTerms: 'Net 30',
      shippingMethod: 'Ground',
    },
  });
  await Promise.all([
    prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po1.id, lineNumber: 1, partNumber: '510-00001', description: 'Copper Winding Wire 18AWG', qtyOrdered: 1000, qtyReceived: 1000, unitOfMeasure: 'FT', unitCost: 0.14, totalCost: 140.00, countryOfOrigin: 'US' } }),
    prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po1.id, lineNumber: 2, partNumber: '510-00007', description: '3-Phase Motor Connector', qtyOrdered: 100, qtyReceived: 100, unitOfMeasure: 'EA', unitCost: 4.90, totalCost: 490.00, countryOfOrigin: 'US' } }),
  ]);

  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0002',
      supplierId: supplierMagnet.id,
      buyerName: 'Admin User',
      orderDate: new Date('2026-01-12'),
      expectedDate: new Date('2026-02-05'),
      status: 'fully_received',
      totalValue: 1175.00,
      paymentTerms: 'Net 45',
      shippingMethod: 'Air Freight',
    },
  });
  await prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po2.id, lineNumber: 1, partNumber: '510-00002', description: 'Neodymium Magnets 10mm', qtyOrdered: 500, qtyReceived: 500, unitOfMeasure: 'EA', unitCost: 2.35, totalCost: 1175.00, countryOfOrigin: 'JP' } });

  const po3 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0003',
      supplierId: supplierBearings.id,
      buyerName: 'Admin User',
      orderDate: new Date('2026-01-15'),
      expectedDate: new Date('2026-01-28'),
      status: 'fully_received',
      totalValue: 590.00,
      paymentTerms: 'Net 30',
      shippingMethod: 'Ground',
    },
  });
  await prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po3.id, lineNumber: 1, partNumber: '510-00004', description: 'Ball Bearing 608-2RS', qtyOrdered: 200, qtyReceived: 200, unitOfMeasure: 'EA', unitCost: 2.95, totalCost: 590.00, countryOfOrigin: 'DE' } });

  const po4 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0004',
      supplierId: supplierCasting.id,
      buyerName: 'Admin User',
      orderDate: new Date('2026-02-01'),
      expectedDate: new Date('2026-02-18'),
      status: 'partially_received',
      totalValue: 2870.00,
      paymentTerms: 'Net 30',
      shippingMethod: 'LTL Freight',
    },
  });
  await Promise.all([
    prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po4.id, lineNumber: 1, partNumber: '510-00003', description: 'Aluminum Housing M42', qtyOrdered: 100, qtyReceived: 60, unitOfMeasure: 'EA', unitCost: 17.50, totalCost: 1750.00, countryOfOrigin: 'US' } }),
    prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po4.id, lineNumber: 2, partNumber: '510-00006', description: 'Stator Lamination Stack', qtyOrdered: 100, qtyReceived: 100, unitOfMeasure: 'EA', unitCost: 11.20, totalCost: 1120.00, countryOfOrigin: 'US' } }),
  ]);

  const po5 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0005',
      supplierId: supplierSeal.id,
      buyerName: 'Admin User',
      orderDate: new Date('2026-02-10'),
      expectedDate: new Date('2026-02-18'),
      status: 'submitted',
      totalValue: 294.00,
      paymentTerms: 'Net 15',
      shippingMethod: 'Ground',
      notes: 'Urgent reorder — stock running low',
    },
  });
  await prisma.purchaseOrderLineItem.create({ data: { purchaseOrderId: po5.id, lineNumber: 1, partNumber: '510-00005', description: 'NBR Seal Ring 42mm', qtyOrdered: 300, qtyReceived: 0, unitOfMeasure: 'EA', unitCost: 0.98, totalCost: 294.00, countryOfOrigin: 'US' } });

  // Create Material Lots (now with supplier references)
  console.log('Creating material lots...');
  const materialLots = await Promise.all([
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-WIRE-2024-001',
        materialCode: 'WIRE-CU-18AWG',
        description: 'Copper Winding Wire 18AWG',
        qtyReceived: 1000,
        qtyRemaining: 750,
        unitOfMeasure: 'FT',
        supplier: 'Acme Wire Co',
        supplierId: supplierAcme.id,
        purchaseOrderNumber: 'PO-2026-0001',
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
        qtyRemaining: 484,
        unitOfMeasure: 'EA',
        supplier: 'MagnetWorld Inc',
        supplierId: supplierMagnet.id,
        purchaseOrderNumber: 'PO-2026-0002',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-BEAR-2024-001',
        materialCode: 'BEAR-608-2RS',
        description: 'Ball Bearing 608-2RS',
        qtyReceived: 200,
        qtyRemaining: 192,
        unitOfMeasure: 'EA',
        supplier: 'BearingsCo Ltd',
        supplierId: supplierBearings.id,
        purchaseOrderNumber: 'PO-2026-0003',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-HOUS-2024-001',
        materialCode: 'HOUS-ALU-M42',
        description: 'Aluminum Housing M42',
        qtyReceived: 60,
        qtyRemaining: 56,
        unitOfMeasure: 'EA',
        supplier: 'CastingCo Industries',
        supplierId: supplierCasting.id,
        purchaseOrderNumber: 'PO-2026-0004',
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
        supplier: 'SealTech Solutions',
        supplierId: supplierSeal.id,
        status: 'available',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Expiring soon for demo
      },
    }),
    // Extra lots for variety
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-LAM-2024-001',
        materialCode: 'LAM-STEEL-50',
        description: 'Stator Lamination Stack',
        qtyReceived: 100,
        qtyRemaining: 96,
        unitOfMeasure: 'EA',
        supplier: 'CastingCo Industries',
        supplierId: supplierCasting.id,
        purchaseOrderNumber: 'PO-2026-0004',
        status: 'available',
      },
    }),
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-CONN-2024-001',
        materialCode: 'CONN-3PH-30A',
        description: '3-Phase Motor Connector',
        qtyReceived: 100,
        qtyRemaining: 96,
        unitOfMeasure: 'EA',
        supplier: 'Acme Wire Co',
        supplierId: supplierAcme.id,
        purchaseOrderNumber: 'PO-2026-0001',
        status: 'available',
      },
    }),
    // A quarantined lot for demo
    prisma.materialLot.create({
      data: {
        lotNumber: 'LOT-HOUS-2024-002',
        materialCode: 'HOUS-ALU-M42',
        description: 'Aluminum Housing M42 (second shipment)',
        qtyReceived: 40,
        qtyRemaining: 40,
        unitOfMeasure: 'EA',
        supplier: 'CastingCo Industries',
        supplierId: supplierCasting.id,
        purchaseOrderNumber: 'PO-2026-0004',
        status: 'quarantine',
        conditionNotes: 'Surface blemishes on 3 units — pending IQC',
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
      qtyOrdered: 50,
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
        id: FIXED_IDS.steps.winding,
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
        id: FIXED_IDS.steps.stator_lamination,
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
        id: FIXED_IDS.steps.insulation,
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
        id: FIXED_IDS.steps.lead_wire,
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
        id: FIXED_IDS.steps.varnish,
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
        id: FIXED_IDS.steps.stator_electrical,
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
        id: FIXED_IDS.steps.stator_dimensional,
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
        id: FIXED_IDS.steps.magnet_bonding,
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
        id: FIXED_IDS.steps.rotor_balancing,
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
        id: FIXED_IDS.steps.shaft_press,
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
        id: FIXED_IDS.steps.rotor_dimensional,
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
        id: FIXED_IDS.steps.wire_cutting,
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
        id: FIXED_IDS.steps.connector_crimping,
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
        id: FIXED_IDS.steps.harness_continuity,
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
        id: FIXED_IDS.steps.bearing_press,
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
        id: FIXED_IDS.steps.seal_installation,
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
        id: FIXED_IDS.steps.base_dimensional,
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
        id: FIXED_IDS.steps.rotor_insertion,
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
        id: FIXED_IDS.steps.end_bell,
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
        id: FIXED_IDS.steps.wire_harness_routing,
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
        id: FIXED_IDS.steps.connector_mating,
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
        id: FIXED_IDS.steps.cover_closure,
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
        id: FIXED_IDS.steps.label_application,
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
        id: FIXED_IDS.steps.hipot_test,
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
        id: FIXED_IDS.steps.functional_run,
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
        id: FIXED_IDS.steps.final_inspection,
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

  // ==========================================================================
  // Create CTQ Definitions (for IQC)
  // ==========================================================================
  console.log('Creating CTQ definitions...');
  const ctqHousingOD = await prisma.cTQDefinition.create({
    data: {
      partNumber: '510-00003',
      revision: 'A',
      dimensionName: 'Housing OD',
      nominal: 42.0,
      usl: 42.05,
      lsl: 41.95,
      unitOfMeasure: 'mm',
      measurementTool: 'Digital caliper',
      sampleSizeRule: 'fixed_count',
      sampleSize: 5,
    },
  });
  const ctqHousingBore = await prisma.cTQDefinition.create({
    data: {
      partNumber: '510-00003',
      revision: 'A',
      dimensionName: 'Bearing Bore Diameter',
      nominal: 22.0,
      usl: 22.02,
      lsl: 21.98,
      unitOfMeasure: 'mm',
      measurementTool: 'Bore gauge',
      sampleSizeRule: 'fixed_count',
      sampleSize: 5,
      safetyCritical: true,
    },
  });
  const ctqBearingOD = await prisma.cTQDefinition.create({
    data: {
      partNumber: '510-00004',
      revision: 'A',
      dimensionName: 'Bearing OD',
      nominal: 22.0,
      usl: 22.01,
      lsl: 21.99,
      unitOfMeasure: 'mm',
      measurementTool: 'Micrometer',
      sampleSizeRule: 'all',
      safetyCritical: true,
    },
  });
  const ctqMagnetStrength = await prisma.cTQDefinition.create({
    data: {
      partNumber: '510-00002',
      revision: 'A',
      dimensionName: 'Surface Flux Density',
      nominal: 1.45,
      usl: 1.52,
      lsl: 1.38,
      unitOfMeasure: 'T',
      measurementTool: 'Gaussmeter',
      sampleSizeRule: 'fixed_count',
      sampleSize: 10,
    },
  });
  const ctqSealDiameter = await prisma.cTQDefinition.create({
    data: {
      partNumber: '510-00005',
      revision: 'A',
      dimensionName: 'Seal ID',
      nominal: 42.0,
      usl: 42.10,
      lsl: 41.90,
      unitOfMeasure: 'mm',
      measurementTool: 'Digital caliper',
      sampleSizeRule: 'fixed_count',
      sampleSize: 3,
    },
  });

  // ==========================================================================
  // Create Incoming Inspections with IQC Results
  // ==========================================================================
  console.log('Creating incoming inspections...');
  const iqc1 = await prisma.incomingInspection.create({
    data: {
      materialLotId: materialLots[3].id, // Housing lot
      inspectorId: supervisorUser.id,
      status: 'completed',
      overallResult: 'conforming',
      startedAt: new Date('2026-02-16T09:00:00Z'),
      completedAt: new Date('2026-02-16T09:45:00Z'),
    },
  });
  // IQC results for housing lot (all pass)
  for (let i = 1; i <= 5; i++) {
    await prisma.iQCResult.create({
      data: {
        inspectionId: iqc1.id,
        ctqDefinitionId: ctqHousingOD.id,
        sampleNumber: i,
        measuredValue: 42.0 + (Math.random() * 0.04 - 0.02),
        result: 'pass',
        inspectorId: supervisorUser.id,
      },
    });
    await prisma.iQCResult.create({
      data: {
        inspectionId: iqc1.id,
        ctqDefinitionId: ctqHousingBore.id,
        sampleNumber: i,
        measuredValue: 22.0 + (Math.random() * 0.02 - 0.01),
        result: 'pass',
        inspectorId: supervisorUser.id,
      },
    });
  }

  const iqc2 = await prisma.incomingInspection.create({
    data: {
      materialLotId: materialLots[7].id, // Quarantined housing lot
      inspectorId: supervisorUser.id,
      status: 'completed',
      overallResult: 'nonconforming_rework',
      dispositionNotes: 'Surface blemishes found on 3 of 5 samples. Lot requires rework polishing.',
      startedAt: new Date('2026-02-20T10:00:00Z'),
      completedAt: new Date('2026-02-20T11:30:00Z'),
    },
  });
  for (let i = 1; i <= 5; i++) {
    const fail = i <= 3;
    await prisma.iQCResult.create({
      data: {
        inspectionId: iqc2.id,
        ctqDefinitionId: ctqHousingOD.id,
        sampleNumber: i,
        measuredValue: fail ? 42.08 : 42.0 + (Math.random() * 0.04 - 0.02),
        result: fail ? 'fail' : 'pass',
        inspectorId: supervisorUser.id,
        notes: fail ? 'Surface blemish detected' : undefined,
      },
    });
  }

  // Pending inspection for bearing lot
  await prisma.incomingInspection.create({
    data: {
      materialLotId: materialLots[2].id, // Bearing lot
      inspectorId: null,
      status: 'pending',
    },
  });

  // ==========================================================================
  // Create a second Work Order (completed for demo history)
  // ==========================================================================
  console.log('Creating second work order (completed)...');
  const workOrder2 = await prisma.workOrder.create({
    data: {
      id: FIXED_IDS.workOrder2,
      siteId: site.id,
      routingId: routing.id,
      orderNumber: 'WO-1002',
      productCode: 'MOTOR-STD-001',
      productName: 'Standard Motor Assembly',
      qtyOrdered: 3,
      qtyCompleted: 3,
      status: 'completed',
      priority: 2,
      releasedAt: new Date('2026-01-08T08:00:00Z'),
      dueDate: new Date('2026-01-14T08:00:00Z'),
      completedAt: new Date('2026-01-13T16:00:00Z'),
      customerName: 'TechDrive Motors',
      customerOrderRef: 'TD-2026-0042',
    },
  });
  // WO2 operations
  const wo2Operations = await Promise.all(
    stations.map((st, idx) =>
      prisma.workOrderOperation.create({
        data: {
          workOrderId: workOrder2.id,
          stationId: st.id,
          sequence: idx + 1,
          estimatedMinutes: [15, 10, 12, 8, 6, 5][idx],
          status: 'completed',
        },
      })
    )
  );

  // ==========================================================================
  // Create Units with Operation Executions
  // ==========================================================================
  console.log('Creating units and executions...');
  const baseTime = new Date('2026-01-15T08:00:00Z');

  // Units for WO-1001 (4 created, 2 completed through all stations, 1 in-progress, 1 just created)
  const unit1 = await prisma.unit.create({
    data: {
      id: FIXED_IDS.units.unit1,
      workOrderId: workOrder.id,
      serialNumber: 'MTR-20260001',
      serialAssigned: true,
      status: 'completed',
      currentStationId: null,
    },
  });
  const unit2 = await prisma.unit.create({
    data: {
      id: FIXED_IDS.units.unit2,
      workOrderId: workOrder.id,
      serialNumber: 'MTR-20260002',
      serialAssigned: true,
      status: 'completed',
      currentStationId: null,
    },
  });
  const unit3 = await prisma.unit.create({
    data: {
      id: FIXED_IDS.units.unit3,
      workOrderId: workOrder.id,
      serialNumber: 'MTR-20260003',
      serialAssigned: true,
      status: 'in_progress',
      currentStationId: stationC.id,
    },
  });
  const unit4 = await prisma.unit.create({
    data: {
      id: FIXED_IDS.units.unit4,
      workOrderId: workOrder.id,
      serialNumber: 'MTR-20260004',
      serialAssigned: true,
      status: 'created',
      currentStationId: null,
    },
  });

  // Units for WO-1002 (all completed)
  const unit5 = await prisma.unit.create({
    data: {
      id: FIXED_IDS.units.unit5,
      workOrderId: workOrder2.id,
      serialNumber: 'MTR-20260005',
      serialAssigned: true,
      status: 'completed',
      currentStationId: null,
    },
  });

  // Update WO-1001 completed count
  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { qtyCompleted: 2, status: 'in_progress' },
  });

  // Create unit operation executions for completed units
  const createExecutions = async (unit: { id: string }, ops: typeof operations[number][], operatorId: string, startTime: Date, unitIndex: number) => {
    const execs = [];
    let t = new Date(startTime.getTime() + unitIndex * 70 * 60 * 1000); // Offset each unit
    for (let i = 0; i < ops.length; i++) {
      const cycleMins = [14.2, 9.5, 11.8, 7.3, 5.8, 4.9][i];
      const startAt = new Date(t);
      const endAt = new Date(t.getTime() + cycleMins * 60 * 1000);
      const exec = await prisma.unitOperationExecution.create({
        data: {
          unitId: unit.id,
          operationId: ops[i].id,
          stationId: stations[i].id,
          operatorId,
          startedAt: startAt,
          completedAt: endAt,
          cycleTimeMinutes: cycleMins,
          result: 'pass',
        },
      });
      execs.push(exec);
      t = new Date(endAt.getTime() + 2 * 60 * 1000); // 2 min gap
    }
    return execs;
  };

  const unit1Execs = await createExecutions(unit1, operations, operator1.id, baseTime, 0);
  await createExecutions(unit2, operations, operator2.id, baseTime, 1);

  // Unit 3 — in progress at station C (completed A and B only)
  for (let i = 0; i < 2; i++) {
    const cycleMins = [15.1, 10.3][i];
    const startAt = new Date(baseTime.getTime() + 140 * 60 * 1000 + i * 20 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + cycleMins * 60 * 1000);
    await prisma.unitOperationExecution.create({
      data: {
        unitId: unit3.id,
        operationId: operations[i].id,
        stationId: stations[i].id,
        operatorId: operator1.id,
        startedAt: startAt,
        completedAt: endAt,
        cycleTimeMinutes: cycleMins,
        result: 'pass',
      },
    });
  }
  // Unit 3 — currently at station C, started but not finished
  await prisma.unitOperationExecution.create({
    data: {
      unitId: unit3.id,
      operationId: operations[2].id,
      stationId: stationC.id,
      operatorId: operator1.id,
      startedAt: new Date(baseTime.getTime() + 200 * 60 * 1000),
      completedAt: null,
      cycleTimeMinutes: null,
      result: null,
    },
  });

  // WO-1002 unit 5 — all completed (past data)
  await createExecutions(unit5, wo2Operations, operator2.id, new Date('2026-01-09T08:00:00Z'), 0);

  // ==========================================================================
  // Create Material Consumption Records
  // ==========================================================================
  console.log('Creating material consumption records...');
  // Unit 1 consumed materials at each station
  await Promise.all([
    prisma.unitMaterialConsumption.create({ data: { unitId: unit1.id, materialLotId: materialLots[0].id, qtyConsumed: 50, stationId: stationA.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit1.id, materialLotId: materialLots[1].id, qtyConsumed: 4, stationId: stationB.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 20 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit1.id, materialLotId: materialLots[3].id, qtyConsumed: 1, stationId: stationC.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 35 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit1.id, materialLotId: materialLots[2].id, qtyConsumed: 2, stationId: stationC.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 36 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit1.id, materialLotId: materialLots[4].id, qtyConsumed: 2, stationId: stationC.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 37 * 60 * 1000) } }),
    // Unit 2
    prisma.unitMaterialConsumption.create({ data: { unitId: unit2.id, materialLotId: materialLots[0].id, qtyConsumed: 50, stationId: stationA.id, operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 75 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit2.id, materialLotId: materialLots[1].id, qtyConsumed: 4, stationId: stationB.id, operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 90 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit2.id, materialLotId: materialLots[3].id, qtyConsumed: 1, stationId: stationC.id, operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 105 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit2.id, materialLotId: materialLots[2].id, qtyConsumed: 2, stationId: stationC.id, operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 106 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit2.id, materialLotId: materialLots[4].id, qtyConsumed: 2, stationId: stationC.id, operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 107 * 60 * 1000) } }),
    // Unit 3 (partial — only winding and magnet stations so far)
    prisma.unitMaterialConsumption.create({ data: { unitId: unit3.id, materialLotId: materialLots[0].id, qtyConsumed: 50, stationId: stationA.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 145 * 60 * 1000) } }),
    prisma.unitMaterialConsumption.create({ data: { unitId: unit3.id, materialLotId: materialLots[1].id, qtyConsumed: 4, stationId: stationB.id, operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 165 * 60 * 1000) } }),
  ]);

  // ==========================================================================
  // Create Quality Check Results
  // ==========================================================================
  console.log('Creating quality check results...');
  // Unit 1 — all pass
  await Promise.all([
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[0].id, operatorId: operator1.id, result: 'pass', valuesJson: { resistance: 0.98 }, timestamp: new Date(baseTime.getTime() + 14 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[1].id, operatorId: operator1.id, result: 'pass', valuesJson: { noDefects: true, alignment: true, clean: true }, timestamp: new Date(baseTime.getTime() + 15 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[2].id, operatorId: operator1.id, result: 'pass', valuesJson: { torque: 3.1 }, timestamp: new Date(baseTime.getTime() + 40 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[3].id, operatorId: supervisorUser.id, result: 'pass', valuesJson: { assemblyComplete: true, noGaps: true, labels: true, clean: true }, timestamp: new Date(baseTime.getTime() + 50 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[4].id, operatorId: operator1.id, result: 'pass', valuesJson: { phaseA: true, phaseB: true, phaseC: true, noShorts: true }, timestamp: new Date(baseTime.getTime() + 55 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[5].id, operatorId: operator1.id, result: 'pass', valuesJson: { insulation: 520 }, timestamp: new Date(baseTime.getTime() + 56 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[6].id, operatorId: operator1.id, result: 'pass', valuesJson: { rpm: 3010 }, timestamp: new Date(baseTime.getTime() + 60 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit1.id, definitionId: qualityChecks[7].id, operatorId: operator1.id, result: 'pass', valuesJson: { current: 2.01 }, timestamp: new Date(baseTime.getTime() + 61 * 60 * 1000) } }),
  ]);

  // Unit 2 — one failure at electrical test (triggers NCR)
  await Promise.all([
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[0].id, operatorId: operator2.id, result: 'pass', valuesJson: { resistance: 1.02 }, timestamp: new Date(baseTime.getTime() + 80 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[1].id, operatorId: operator2.id, result: 'pass', valuesJson: { noDefects: true, alignment: true, clean: true }, timestamp: new Date(baseTime.getTime() + 81 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[2].id, operatorId: operator2.id, result: 'pass', valuesJson: { torque: 2.9 }, timestamp: new Date(baseTime.getTime() + 110 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[3].id, operatorId: supervisorUser.id, result: 'pass', valuesJson: { assemblyComplete: true, noGaps: true, labels: true, clean: true }, timestamp: new Date(baseTime.getTime() + 120 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[5].id, operatorId: operator2.id, result: 'fail', valuesJson: { insulation: 85 }, timestamp: new Date(baseTime.getTime() + 125 * 60 * 1000) } }),
    // After rework, passed on second attempt
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[5].id, operatorId: operator2.id, result: 'pass', valuesJson: { insulation: 480 }, timestamp: new Date(baseTime.getTime() + 135 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[6].id, operatorId: operator2.id, result: 'pass', valuesJson: { rpm: 2980 }, timestamp: new Date(baseTime.getTime() + 138 * 60 * 1000) } }),
    prisma.qualityCheckResult.create({ data: { unitId: unit2.id, definitionId: qualityChecks[7].id, operatorId: operator2.id, result: 'pass', valuesJson: { current: 1.95 }, timestamp: new Date(baseTime.getTime() + 139 * 60 * 1000) } }),
  ]);

  // ==========================================================================
  // Create NCRs
  // ==========================================================================
  console.log('Creating NCRs...');
  // NCR 1: Unit 2 insulation failure — dispositioned as rework, now closed
  await prisma.nonconformanceRecord.create({
    data: {
      ncrNumber: 'NCR-2026-0001',
      unitId: unit2.id,
      stationId: stationE.id,
      defectType: 'Insulation Failure',
      description: 'Insulation resistance measured at 85 MΩ, below minimum of 100 MΩ. Likely moisture ingress during varnish cure.',
      disposition: 'rework',
      dispositionRationale: 'Re-bake stator at 150°C for 30 min, then retest insulation.',
      correctiveAction: 'Adjusted varnish cure humidity control setpoint from 40% to 35% RH.',
      severity: 'major',
      status: 'closed',
      source: 'production',
      closedAt: new Date(baseTime.getTime() + 140 * 60 * 1000),
    },
  });

  // NCR 2: IQC housing lot surface blemishes — open
  await prisma.nonconformanceRecord.create({
    data: {
      ncrNumber: 'NCR-2026-0002',
      materialLotId: materialLots[7].id,
      defectType: 'Surface Defect',
      description: 'Surface blemishes found on 3 of 5 sampled housings from LOT-HOUS-2024-002. Cosmetic issue, not structural.',
      affectedQty: 24,
      severity: 'minor',
      status: 'open',
      source: 'iqc',
      partNumber: '510-00003',
      responsibleParty: 'CastingCo Industries',
      supplierNotified: true,
      supplierNotifiedAt: new Date('2026-02-20T14:00:00Z'),
    },
  });

  // NCR 3: Magnet adhesion concern — dispositioned, awaiting corrective action
  await prisma.nonconformanceRecord.create({
    data: {
      ncrNumber: 'NCR-2026-0003',
      unitId: unit5.id,
      stationId: stationB.id,
      defectType: 'Adhesion Failure',
      description: 'During vibration test on WO-1002 unit, slight magnet shift detected. Root cause: adhesive batch may be below spec.',
      disposition: 'use_as_is',
      dispositionRationale: 'Measured shift of 0.05mm is within acceptable tolerance. Unit meets performance requirements.',
      correctiveAction: 'Request COA for adhesive batch. Add incoming adhesive viscosity check to IQC.',
      severity: 'major',
      status: 'dispositioned',
      source: 'production',
      responsibleParty: 'MagnetWorld Inc',
      actionDueDate: new Date('2026-03-01'),
    },
  });

  // ==========================================================================
  // Create Downtime Intervals
  // ==========================================================================
  console.log('Creating downtime intervals...');
  await Promise.all([
    prisma.downtimeInterval.create({
      data: {
        stationId: stationA.id,
        reasonId: downtimeReasons[0].id,
        operatorId: operator1.id,
        startedAt: new Date(baseTime.getTime() + 30 * 60 * 1000),
        endedAt: new Date(baseTime.getTime() + 42 * 60 * 1000),
        notes: 'Winding machine tension sensor malfunction. Replaced sensor.',
      },
    }),
    prisma.downtimeInterval.create({
      data: {
        stationId: stationB.id,
        reasonId: downtimeReasons[1].id,
        operatorId: operator2.id,
        startedAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
        endedAt: new Date(baseTime.getTime() + 68 * 60 * 1000),
        notes: 'Changeover from standard to high-torque magnet configuration.',
      },
    }),
    prisma.downtimeInterval.create({
      data: {
        stationId: stationC.id,
        reasonId: downtimeReasons[2].id,
        operatorId: operator1.id,
        startedAt: new Date(baseTime.getTime() + 100 * 60 * 1000),
        endedAt: new Date(baseTime.getTime() + 115 * 60 * 1000),
        notes: 'Waiting for bearing lot — IQC hold.',
      },
    }),
    prisma.downtimeInterval.create({
      data: {
        stationId: stationA.id,
        reasonId: downtimeReasons[3].id,
        operatorId: operator1.id,
        startedAt: new Date(baseTime.getTime() + 240 * 60 * 1000),
        endedAt: new Date(baseTime.getTime() + 270 * 60 * 1000),
        notes: 'Scheduled lunch break.',
      },
    }),
    prisma.downtimeInterval.create({
      data: {
        stationId: stationE.id,
        reasonId: downtimeReasons[4].id,
        operatorId: operator2.id,
        startedAt: new Date(baseTime.getTime() + 125 * 60 * 1000),
        endedAt: new Date(baseTime.getTime() + 135 * 60 * 1000),
        notes: 'Quality hold pending NCR disposition for unit MTR-20260002.',
      },
    }),
    // A recent downtime (ended) for demo — keeping it ended so E2E tests can create units
    prisma.downtimeInterval.create({
      data: {
        stationId: stationD.id,
        reasonId: downtimeReasons[0].id,
        operatorId: operator1.id,
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        endedAt: new Date(Date.now() - 5 * 60 * 1000),
        notes: 'Inspection camera calibration drift detected.',
      },
    }),
  ]);

  // ==========================================================================
  // Create Kit with Kit Lines
  // ==========================================================================
  console.log('Creating kits...');
  const kit1 = await prisma.kit.create({
    data: {
      workOrderId: workOrder.id,
      status: 'in_progress',
      createdById: adminUser.id,
    },
  });
  await Promise.all([
    prisma.kitLine.create({ data: { kitId: kit1.id, materialCode: 'WIRE-CU-18AWG', description: 'Copper Winding Wire 18AWG', qtyRequired: 250, qtyPicked: 200, materialLotId: materialLots[0].id, pickedById: operator1.id, pickedAt: new Date(baseTime.getTime() - 30 * 60 * 1000) } }),
    prisma.kitLine.create({ data: { kitId: kit1.id, materialCode: 'MAG-NEOD-10MM', description: 'Neodymium Magnets 10mm', qtyRequired: 20, qtyPicked: 20, materialLotId: materialLots[1].id, pickedById: operator1.id, pickedAt: new Date(baseTime.getTime() - 28 * 60 * 1000) } }),
    prisma.kitLine.create({ data: { kitId: kit1.id, materialCode: 'HOUS-ALU-M42', description: 'Aluminum Housing M42', qtyRequired: 5, qtyPicked: 4, materialLotId: materialLots[3].id, pickedById: operator2.id, pickedAt: new Date(baseTime.getTime() - 25 * 60 * 1000) } }),
    prisma.kitLine.create({ data: { kitId: kit1.id, materialCode: 'BEAR-608-2RS', description: 'Ball Bearing 608-2RS', qtyRequired: 10, qtyPicked: 10, materialLotId: materialLots[2].id, pickedById: operator2.id, pickedAt: new Date(baseTime.getTime() - 22 * 60 * 1000) } }),
    prisma.kitLine.create({ data: { kitId: kit1.id, materialCode: 'SEAL-NBR-42', description: 'NBR Seal Ring 42mm', qtyRequired: 10, qtyPicked: 8, materialLotId: materialLots[4].id, pickedById: operator1.id, pickedAt: new Date(baseTime.getTime() - 20 * 60 * 1000) } }),
  ]);

  // ==========================================================================
  // Create EOL Test Suite with Parameters and Results
  // ==========================================================================
  console.log('Creating EOL test suites...');
  const eolSuite = await prisma.eolTestSuite.create({
    data: {
      routingId: routing.id,
      name: 'Standard Motor EOL Test',
      description: 'End-of-line performance and safety test suite for BLDC outrunner motors',
    },
  });
  const eolParams = await Promise.all([
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'No-Load RPM', unit: 'rpm', minValue: 2800, maxValue: 3200, targetValue: 3000, sequence: 1 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'No-Load Current', unit: 'A', minValue: 0.3, maxValue: 0.8, targetValue: 0.5, sequence: 2 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'Rated Load Current', unit: 'A', minValue: 1.8, maxValue: 2.2, targetValue: 2.0, sequence: 3 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'Vibration Level', unit: 'mm/s', minValue: 0, maxValue: 2.5, targetValue: 1.0, sequence: 4 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'Noise Level', unit: 'dBA', minValue: 0, maxValue: 55, targetValue: 40, sequence: 5 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'Hi-Pot Leakage', unit: 'mA', minValue: 0, maxValue: 5, targetValue: 1.0, sequence: 6 } }),
    prisma.eolTestParameter.create({ data: { suiteId: eolSuite.id, name: 'Insulation Resistance', unit: 'MΩ', minValue: 100, maxValue: 1000, targetValue: 500, sequence: 7 } }),
  ]);

  // EOL results for unit 1 (pass)
  await prisma.eolTestResult.create({
    data: {
      unitId: unit1.id,
      suiteId: eolSuite.id,
      operatorId: operator1.id,
      compositeResult: 'pass',
      parameterResults: [
        { parameterId: eolParams[0].id, name: 'No-Load RPM', value: 3010, pass: true },
        { parameterId: eolParams[1].id, name: 'No-Load Current', value: 0.52, pass: true },
        { parameterId: eolParams[2].id, name: 'Rated Load Current', value: 2.01, pass: true },
        { parameterId: eolParams[3].id, name: 'Vibration Level', value: 0.8, pass: true },
        { parameterId: eolParams[4].id, name: 'Noise Level', value: 38, pass: true },
        { parameterId: eolParams[5].id, name: 'Hi-Pot Leakage', value: 0.9, pass: true },
        { parameterId: eolParams[6].id, name: 'Insulation Resistance', value: 520, pass: true },
      ],
      testedAt: new Date(baseTime.getTime() + 62 * 60 * 1000),
    },
  });

  // EOL results for unit 2 (pass after rework)
  await prisma.eolTestResult.create({
    data: {
      unitId: unit2.id,
      suiteId: eolSuite.id,
      operatorId: operator2.id,
      compositeResult: 'pass',
      parameterResults: [
        { parameterId: eolParams[0].id, name: 'No-Load RPM', value: 2980, pass: true },
        { parameterId: eolParams[1].id, name: 'No-Load Current', value: 0.55, pass: true },
        { parameterId: eolParams[2].id, name: 'Rated Load Current', value: 1.95, pass: true },
        { parameterId: eolParams[3].id, name: 'Vibration Level', value: 1.2, pass: true },
        { parameterId: eolParams[4].id, name: 'Noise Level', value: 42, pass: true },
        { parameterId: eolParams[5].id, name: 'Hi-Pot Leakage', value: 1.1, pass: true },
        { parameterId: eolParams[6].id, name: 'Insulation Resistance', value: 480, pass: true },
      ],
      testedAt: new Date(baseTime.getTime() + 140 * 60 * 1000),
    },
  });

  // ==========================================================================
  // Create Shipment
  // ==========================================================================
  console.log('Creating shipments...');
  const shipment = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SHP-2026-0001',
      workOrderId: workOrder2.id,
      customerName: 'TechDrive Motors',
      customerAddress: '9876 Innovation Pkwy, San Jose, CA 95101',
      shipDate: new Date('2026-01-14T10:00:00Z'),
      carrier: 'FedEx',
      trackingNumber: '1Z999AA1012345678',
      totalBoxes: 1,
      totalWeight: 8.5,
      weightUnit: 'lbs',
      status: 'shipped',
      shippedById: adminUser.id,
    },
  });
  await prisma.shipmentLine.create({
    data: {
      shipmentId: shipment.id,
      unitId: unit5.id,
      serialNumber: 'MTR-20260005',
      boxNumber: 1,
    },
  });

  // Pending shipment for WO-1001 completed units
  const shipment2 = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SHP-2026-0002',
      workOrderId: workOrder.id,
      customerName: 'ElectroDrive Corp',
      customerAddress: '4321 Motor Way, Dearborn, MI 48120',
      status: 'pending',
      specialNotes: 'Customer requires Certificate of Conformance with each shipment.',
    },
  });

  // ==========================================================================
  // Create Inventory Transactions (ledger)
  // ==========================================================================
  console.log('Creating inventory transactions...');
  await Promise.all([
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[0].id, transactionType: 'receive', quantity: 1000, previousQty: 0, newQty: 1000, referenceType: 'manual', reason: 'Initial receipt PO-2026-0001', operatorId: adminUser.id, timestamp: new Date('2026-01-20T10:00:00Z') } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[0].id, transactionType: 'issue', quantity: -150, previousQty: 1000, newQty: 850, referenceType: 'work_order', referenceId: workOrder.id, reason: 'Issued for WO-1001 production', operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000) } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[0].id, transactionType: 'issue', quantity: -100, previousQty: 850, newQty: 750, referenceType: 'work_order', referenceId: workOrder.id, reason: 'Issued for WO-1001 production (units 2-3)', operatorId: operator2.id, timestamp: new Date(baseTime.getTime() + 75 * 60 * 1000) } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[1].id, transactionType: 'receive', quantity: 500, previousQty: 0, newQty: 500, referenceType: 'manual', reason: 'Initial receipt PO-2026-0002', operatorId: adminUser.id, timestamp: new Date('2026-02-05T14:00:00Z') } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[1].id, transactionType: 'issue', quantity: -16, previousQty: 500, newQty: 484, referenceType: 'work_order', referenceId: workOrder.id, reason: 'Issued for WO-1001 magnet install', operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 20 * 60 * 1000) } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[3].id, transactionType: 'receive', quantity: 60, previousQty: 0, newQty: 60, referenceType: 'manual', reason: 'Partial receipt PO-2026-0004', operatorId: adminUser.id, timestamp: new Date('2026-02-16T08:00:00Z') } }),
    prisma.inventoryTransaction.create({ data: { materialLotId: materialLots[3].id, transactionType: 'issue', quantity: -4, previousQty: 60, newQty: 56, referenceType: 'work_order', referenceId: workOrder.id, reason: 'Issued for WO-1001 housing assembly', operatorId: operator1.id, timestamp: new Date(baseTime.getTime() + 35 * 60 * 1000) } }),
  ]);

  // ==========================================================================
  // Create Notifications
  // ==========================================================================
  console.log('Creating notifications...');
  await Promise.all([
    prisma.notification.create({ data: { userId: supervisorUser.id, title: 'NCR Created', message: 'NCR-2026-0001 created for unit MTR-20260002 — Insulation failure at Electrical Test station.', type: 'warning', category: 'quality', entityType: 'ncr', entityId: 'NCR-2026-0001' } }),
    prisma.notification.create({ data: { userId: supervisorUser.id, title: 'NCR Closed', message: 'NCR-2026-0001 has been closed. Rework completed successfully.', type: 'success', category: 'quality', entityType: 'ncr', entityId: 'NCR-2026-0001', read: true, readAt: new Date(baseTime.getTime() + 150 * 60 * 1000) } }),
    prisma.notification.create({ data: { userId: adminUser.id, title: 'Low Stock Alert', message: 'NBR Seal Ring 42mm (SEAL-NBR-42) — only 5 days until expiration. 290 units remaining.', type: 'warning', category: 'inventory', entityType: 'material_lot' } }),
    prisma.notification.create({ data: { userId: adminUser.id, title: 'IQC Rejection', message: 'LOT-HOUS-2024-002 failed incoming inspection — surface blemishes on 3/5 samples.', type: 'error', category: 'quality', entityType: 'incoming_inspection' } }),
    prisma.notification.create({ data: { userId: operator1.id, title: 'Downtime Logged', message: 'Equipment failure at Winding station resolved after 12 minutes. Sensor replaced.', type: 'info', category: 'production', entityType: 'downtime_interval' } }),
    prisma.notification.create({ data: { userId: adminUser.id, title: 'Work Order Released', message: 'WO-1001 has been released for production. 5 units ordered.', type: 'info', category: 'production', entityType: 'work_order', entityId: workOrder.id, read: true, readAt: fixedReleaseDate } }),
    prisma.notification.create({ data: { userId: supervisorUser.id, title: 'Shipment Pending', message: 'SHP-2026-0002 for WO-1001 (ElectroDrive Corp) is pending packing.', type: 'info', category: 'shipping', entityType: 'shipment' } }),
    prisma.notification.create({ data: { userId: adminUser.id, title: 'PO Partially Received', message: 'PO-2026-0004 from CastingCo: 60 of 100 housings received. 40 still outstanding.', type: 'warning', category: 'inventory', entityType: 'purchase_order' } }),
  ]);

  // ==========================================================================
  // Create Audit Logs
  // ==========================================================================
  console.log('Creating audit logs...');
  await Promise.all([
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'create', entityType: 'work_order', entityId: workOrder.id, afterJson: { orderNumber: 'WO-1001', qtyOrdered: 50, status: 'draft' }, timestamp: new Date('2026-01-14T07:00:00Z') } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'update', entityType: 'work_order', entityId: workOrder.id, beforeJson: { status: 'draft' }, afterJson: { status: 'released', releasedAt: fixedReleaseDate.toISOString() }, timestamp: fixedReleaseDate } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'create', entityType: 'routing', entityId: routing.id, afterJson: { name: 'Standard Motor Assembly', productCode: 'MOTOR-STD-001' }, timestamp: new Date('2026-01-10T09:00:00Z') } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'create', entityType: 'supplier', entityId: supplierAcme.id, afterJson: { name: 'Acme Wire Co', supplierId: 'SUP-001', qualificationStatus: 'qualified' }, timestamp: new Date('2026-01-05T10:00:00Z') } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'config_change', entityType: 'quality_check_definition', entityId: qualityChecks[5].id, beforeJson: { minValue: 50 }, afterJson: { minValue: 100 }, timestamp: new Date('2026-01-12T11:00:00Z') } }),
    prisma.auditLog.create({ data: { userId: supervisorUser.id, action: 'update', entityType: 'ncr', entityId: 'NCR-2026-0001', beforeJson: { status: 'open' }, afterJson: { status: 'closed', disposition: 'rework' }, timestamp: new Date(baseTime.getTime() + 140 * 60 * 1000) } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'create', entityType: 'user', entityId: operator1.id, afterJson: { email: 'operator1@mes-demo.local', role: 'operator' }, timestamp: new Date('2026-01-02T08:00:00Z') } }),
    prisma.auditLog.create({ data: { userId: adminUser.id, action: 'update', entityType: 'supplier', entityId: supplierSeal.id, beforeJson: { qualificationStatus: 'pending' }, afterJson: { qualificationStatus: 'conditional', notes: 'Pending ISO recertification' }, timestamp: new Date('2026-02-15T09:00:00Z') } }),
  ]);

  // ==========================================================================
  // Create API Keys
  // ==========================================================================
  console.log('Creating API keys...');
  await Promise.all([
    prisma.apiKey.create({ data: { name: 'ERP Integration', keyHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', keyPrefix: 'mes_erp_', permissions: ['read:work_orders', 'write:work_orders', 'read:inventory'], expiresAt: new Date('2027-01-01'), createdById: adminUser.id, lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }),
    prisma.apiKey.create({ data: { name: 'Label Printer Service', keyHash: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5', keyPrefix: 'mes_lbl_', permissions: ['read:units', 'read:work_orders'], expiresAt: new Date('2026-12-01'), createdById: adminUser.id } }),
    prisma.apiKey.create({ data: { name: 'QMS Sync (Deprecated)', keyHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', keyPrefix: 'mes_qms_', permissions: ['read:quality', 'read:ncr'], active: false, createdById: adminUser.id } }),
  ]);

  // ==========================================================================
  // Create Webhook Subscriptions
  // ==========================================================================
  console.log('Creating webhook subscriptions...');
  await Promise.all([
    prisma.webhookSubscription.create({ data: { name: 'ERP Work Order Sync', url: 'https://erp.example.com/webhooks/mes', secret: 'whsec_demo_erp_sync_key_12345', events: ['work_order_released', 'work_order_completed', 'unit_completed'], active: true } }),
    prisma.webhookSubscription.create({ data: { name: 'Quality Alert Channel', url: 'https://hooks.slack.example.com/services/T000/B000/xxx', secret: 'whsec_demo_slack_quality_67890', events: ['ncr_created', 'quality_check_failed'], active: true } }),
    prisma.webhookSubscription.create({ data: { name: 'Shipping Notifications', url: 'https://logistics.example.com/api/shipment-updates', secret: 'whsec_demo_shipping_abcdef', events: ['shipment_created', 'shipment_shipped'], active: false } }),
  ]);

  // ==========================================================================
  // Create AI Insights
  // ==========================================================================
  console.log('Creating AI insights...');
  await Promise.all([
    prisma.aIInsight.create({ data: { siteId: site.id, stationId: stationA.id, insightType: 'anomaly', severity: 'warning', title: 'Winding cycle time trending up', description: 'Average cycle time at Winding station has increased 12% over the last 8 hours (14.2 min → 15.9 min). Possible cause: wire tension inconsistency.', payload: { metric: 'cycle_time', baseline: 14.2, current: 15.9, changePercent: 12 }, confidence: 0.85 } }),
    prisma.aIInsight.create({ data: { siteId: site.id, insightType: 'recommendation', severity: 'info', title: 'Reorder SEAL-NBR-42 within 3 days', description: 'Based on current consumption rate (8 units/day) and remaining stock (290 units), seal rings will reach reorder point in 3 days. Lead time is 5 days.', payload: { materialCode: 'SEAL-NBR-42', daysToReorder: 3, dailyRate: 8, remaining: 290 }, confidence: 0.92 } }),
    prisma.aIInsight.create({ data: { siteId: site.id, stationId: stationE.id, insightType: 'prediction', severity: 'critical', title: 'Insulation test failure rate spike predicted', description: 'Pattern analysis of recent varnish cure data suggests 15% probability of insulation test failures in next batch if humidity remains above 38% RH.', payload: { failureProbability: 0.15, currentHumidity: 39, threshold: 38 }, confidence: 0.78 } }),
    prisma.aIInsight.create({ data: { siteId: site.id, insightType: 'recommendation', severity: 'info', title: 'Shift schedule optimization opportunity', description: 'Day shift consistently achieves 18% higher throughput than swing shift. Consider cross-training or redistributing experienced operators.', payload: { dayShiftOutput: 4.2, swingShiftOutput: 3.5, gapPercent: 18 }, confidence: 0.88, acknowledged: true, acknowledgedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), acknowledgedBy: supervisorUser.id } }),
  ]);

  // ==========================================================================
  // Create Events (rich event history)
  // ==========================================================================
  console.log('Creating events...');
  await Promise.all([
    prisma.event.create({ data: { eventType: 'work_order_released', siteId: site.id, workOrderId: workOrder.id, operatorId: adminUser.id, payload: { orderNumber: 'WO-1001', productCode: 'MOTOR-STD-001', qtyOrdered: 50 }, source: 'ui', timestampUtc: fixedReleaseDate } }),
    prisma.event.create({ data: { eventType: 'unit_created', siteId: site.id, workOrderId: workOrder.id, unitId: unit1.id, operatorId: operator1.id, payload: { serialNumber: 'MTR-20260001' }, source: 'ui', timestampUtc: baseTime } }),
    prisma.event.create({ data: { eventType: 'operation_started', siteId: site.id, stationId: stationA.id, workOrderId: workOrder.id, unitId: unit1.id, operatorId: operator1.id, payload: { station: 'Winding', sequence: 1 }, source: 'ui', timestampUtc: baseTime } }),
    prisma.event.create({ data: { eventType: 'material_lot_consumed', siteId: site.id, stationId: stationA.id, unitId: unit1.id, operatorId: operator1.id, payload: { lotNumber: 'LOT-WIRE-2024-001', materialCode: 'WIRE-CU-18AWG', qty: 50 }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 5 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'operation_completed', siteId: site.id, stationId: stationA.id, workOrderId: workOrder.id, unitId: unit1.id, operatorId: operator1.id, payload: { station: 'Winding', cycleTimeMinutes: 14.2, result: 'pass' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 14 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'quality_check_recorded', siteId: site.id, stationId: stationA.id, unitId: unit1.id, operatorId: operator1.id, payload: { checkName: 'Winding Resistance Check', result: 'pass', resistance: 0.98 }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 14 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'operation_completed', siteId: site.id, stationId: stationB.id, workOrderId: workOrder.id, unitId: unit1.id, operatorId: operator1.id, payload: { station: 'Magnet Install', cycleTimeMinutes: 9.5, result: 'pass' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 26 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'downtime_started', siteId: site.id, stationId: stationA.id, operatorId: operator1.id, payload: { reason: 'Equipment Failure', code: 'EQUIP_FAIL' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 30 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'downtime_ended', siteId: site.id, stationId: stationA.id, operatorId: operator1.id, payload: { reason: 'Equipment Failure', durationMinutes: 12 }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 42 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'ncr_created', siteId: site.id, stationId: stationE.id, unitId: unit2.id, operatorId: operator2.id, payload: { ncrNumber: 'NCR-2026-0001', defectType: 'Insulation Failure', severity: 'major' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 125 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'ncr_dispositioned', siteId: site.id, unitId: unit2.id, operatorId: supervisorUser.id, payload: { ncrNumber: 'NCR-2026-0001', disposition: 'rework' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 130 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'rework_completed', siteId: site.id, stationId: stationE.id, unitId: unit2.id, operatorId: operator2.id, payload: { ncrNumber: 'NCR-2026-0001', retestResult: 'pass' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 135 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'unit_created', siteId: site.id, workOrderId: workOrder.id, unitId: unit2.id, operatorId: operator2.id, payload: { serialNumber: 'MTR-20260002' }, source: 'ui', timestampUtc: new Date(baseTime.getTime() + 70 * 60 * 1000) } }),
    prisma.event.create({ data: { eventType: 'config_changed', siteId: site.id, operatorId: adminUser.id, payload: { entity: 'quality_check_definition', change: 'Updated insulation resistance min from 50 to 100 MΩ' }, source: 'ui', timestampUtc: new Date('2026-01-12T11:00:00Z') } }),
    prisma.event.create({ data: { eventType: 'user_login', siteId: site.id, operatorId: adminUser.id, payload: { role: 'admin' }, source: 'ui', timestampUtc: new Date('2026-01-15T07:55:00Z') } }),
  ]);

  console.log('✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Site: ${site.name}`);
  console.log(`   - Stations: ${stations.length}`);
  console.log(`   - Suppliers: 5`);
  console.log(`   - Part Masters: 7`);
  console.log(`   - Purchase Orders: 5`);
  console.log(`   - Downtime Reasons: ${downtimeReasons.length}`);
  console.log(`   - Quality Checks: ${qualityChecks.length}`);
  console.log(`   - Material Lots: ${materialLots.length}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Shifts: ${shifts.length}`);
  console.log(`   - Process Steps: ${processSteps.length}`);
  console.log(`   - Work Orders: 2 (WO-1001 in-progress, WO-1002 completed)`);
  console.log(`   - Units: 5 (2 completed, 1 in-progress, 1 created, 1 shipped)`);
  console.log(`   - NCRs: 3 | Quality Results: 16+ | Downtime Intervals: 6`);
  console.log(`   - EOL Test Suite: 1 (7 parameters) | Kits: 1`);
  console.log(`   - Shipments: 2 | Notifications: 8 | Audit Logs: 8`);
  console.log(`   - API Keys: 3 | Webhooks: 3 | AI Insights: 4`);
  console.log(`   - CTQ Definitions: 5 | IQC Inspections: 3`);
  console.log(`   - Inventory Transactions: 7 | Events: 15`);
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
