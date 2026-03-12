import { describe, it, expect } from 'vitest';

/**
 * E2E Production Walkthrough Smoke Test
 *
 * Simulates the full happy path through the MES system:
 * 1. Material receiving
 * 2. Work order creation
 * 3. Kit generation from BOM
 * 4. Kit picking and issuing
 * 5. Work order release
 * 6. Unit processing through stations
 * 7. Quality checks
 * 8. Material consumption (FIFO)
 * 9. NCR flow
 * 10. Work order completion
 * 11. Traceability verification
 * 12. Inventory accuracy
 *
 * All tests are pure logic — no database required.
 */

// ── Types ────────────────────────────────────────────────────────

interface MaterialLot {
  id: string;
  lotNumber: string;
  materialCode: string;
  qtyReceived: number;
  qtyRemaining: number;
  status: 'available' | 'quarantine' | 'expired' | 'depleted';
  receivedAt: Date;
  expiresAt: Date | null;
  supplier: string | null;
}

interface BomItem {
  materialCode: string;
  qtyPerUnit: number;
  stationId: string;
}

interface KitLine {
  id: string;
  materialCode: string;
  qtyRequired: number;
  qtyPicked: number;
  materialLotId: string | null;
}

interface Kit {
  id: string;
  workOrderId: string;
  status: 'pending' | 'in_progress' | 'complete' | 'issued';
  lines: KitLine[];
}

interface WorkOrder {
  id: string;
  orderNumber: string;
  productCode: string;
  qtyOrdered: number;
  qtyCompleted: number;
  status: 'pending' | 'released' | 'in_progress' | 'completed' | 'cancelled';
}

interface Unit {
  id: string;
  serialNumber: string;
  workOrderId: string;
  status: 'created' | 'in_progress' | 'completed' | 'scrapped';
}

interface Execution {
  id: string;
  unitId: string;
  stationId: string;
  result: 'pass' | 'fail' | 'rework' | null;
  startedAt: Date;
  completedAt: Date | null;
  cycleTimeMinutes: number | null;
}

interface Consumption {
  unitId: string;
  materialLotId: string;
  materialCode: string;
  qtyConsumed: number;
}

// ── Simulation Helpers ───────────────────────────────────────────

function receiveLot(data: Omit<MaterialLot, 'status'>): MaterialLot {
  if (data.qtyReceived <= 0) throw new Error('Qty must be positive');
  if (!data.lotNumber) throw new Error('Lot number required');
  if (!data.materialCode) throw new Error('Material code required');
  return { ...data, status: 'available' };
}

function generateKitLines(bom: BomItem[], qtyOrdered: number): KitLine[] {
  return bom.map((item, i) => ({
    id: `kl-${i}`,
    materialCode: item.materialCode,
    qtyRequired: item.qtyPerUnit * qtyOrdered,
    qtyPicked: 0,
    materialLotId: null,
  }));
}

function pickKitLine(
  line: KitLine,
  lot: MaterialLot,
  qty: number
): { line: KitLine; lot: MaterialLot } {
  if (lot.materialCode !== line.materialCode) {
    throw new Error('Material code mismatch');
  }
  if (lot.status !== 'available') {
    throw new Error(`Lot is ${lot.status}, not available`);
  }
  if (lot.expiresAt && lot.expiresAt < new Date()) {
    throw new Error('Lot is expired');
  }
  if (qty > lot.qtyRemaining) {
    throw new Error('Insufficient lot quantity');
  }
  if (qty + line.qtyPicked > line.qtyRequired) {
    throw new Error('Over-picking not allowed');
  }

  const updatedLot = {
    ...lot,
    qtyRemaining: lot.qtyRemaining - qty,
    status: (lot.qtyRemaining - qty === 0 ? 'depleted' : 'available') as MaterialLot['status'],
  };
  const updatedLine = {
    ...line,
    qtyPicked: line.qtyPicked + qty,
    materialLotId: lot.id,
  };

  return { line: updatedLine, lot: updatedLot };
}

function isKitComplete(kit: Kit): boolean {
  return kit.lines.every((l) => l.qtyPicked >= l.qtyRequired);
}

function issueKit(kit: Kit): Kit {
  if (!isKitComplete(kit)) throw new Error('Kit not fully picked');
  return { ...kit, status: 'issued' };
}

function releaseWorkOrder(wo: WorkOrder, kit: Kit | null): WorkOrder & { kitWarning: string | null } {
  if (wo.status !== 'pending') throw new Error('Can only release pending work orders');
  const kitWarning = kit
    ? kit.status !== 'issued' ? `Kit in "${kit.status}" status` : null
    : 'No kit created';
  return { ...wo, status: 'released', kitWarning };
}

function startOperation(unitId: string, stationId: string): Execution {
  return {
    id: `exec-${unitId}-${stationId}`,
    unitId,
    stationId,
    result: null,
    startedAt: new Date(Date.now() - 5 * 60000), // 5 mins ago
    completedAt: null,
    cycleTimeMinutes: null,
  };
}

function completeOperation(exec: Execution, result: 'pass' | 'fail' | 'rework'): Execution {
  const completedAt = new Date();
  const cycleTimeMinutes = (completedAt.getTime() - exec.startedAt.getTime()) / 60000;
  return { ...exec, result, completedAt, cycleTimeMinutes: Math.round(cycleTimeMinutes * 100) / 100 };
}

function consumeMaterial(
  lot: MaterialLot,
  unitId: string,
  qty: number
): { lot: MaterialLot; consumption: Consumption } {
  if (lot.expiresAt && lot.expiresAt < new Date()) throw new Error('Lot expired');
  if (qty > lot.qtyRemaining) throw new Error('Insufficient quantity');
  if (qty <= 0) throw new Error('Qty must be positive');

  return {
    lot: {
      ...lot,
      qtyRemaining: lot.qtyRemaining - qty,
      status: lot.qtyRemaining - qty === 0 ? 'depleted' : 'available',
    },
    consumption: {
      unitId,
      materialLotId: lot.id,
      materialCode: lot.materialCode,
      qtyConsumed: qty,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('E2E Production Walkthrough', () => {
  // Shared state across the walkthrough
  const stations = ['station-winding', 'station-assembly', 'station-test'];
  const bom: BomItem[] = [
    { materialCode: 'WIRE-CU-18', qtyPerUnit: 2, stationId: stations[0] },
    { materialCode: 'BRKT-STL-M4', qtyPerUnit: 4, stationId: stations[1] },
    { materialCode: 'SEAL-NBR-42', qtyPerUnit: 1, stationId: stations[2] },
  ];

  describe('Step 1: Material Receiving', () => {
    it('receives material lots with proper validation', () => {
      const lot = receiveLot({
        id: 'lot-1',
        lotNumber: 'LOT-CU-001',
        materialCode: 'WIRE-CU-18',
        qtyReceived: 100,
        qtyRemaining: 100,
        receivedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        supplier: 'Acme Wire Co',
      });
      expect(lot.status).toBe('available');
      expect(lot.qtyRemaining).toBe(100);
    });

    it('rejects lots with invalid qty', () => {
      expect(() =>
        receiveLot({
          id: 'lot-bad', lotNumber: 'BAD', materialCode: 'X',
          qtyReceived: 0, qtyRemaining: 0, receivedAt: new Date(),
          expiresAt: null, supplier: null,
        })
      ).toThrow('Qty must be positive');
    });

    it('rejects lots without lot number', () => {
      expect(() =>
        receiveLot({
          id: 'lot-bad', lotNumber: '', materialCode: 'X',
          qtyReceived: 10, qtyRemaining: 10, receivedAt: new Date(),
          expiresAt: null, supplier: null,
        })
      ).toThrow('Lot number required');
    });
  });

  describe('Step 2: Work Order Creation', () => {
    it('creates a work order in pending status', () => {
      const wo: WorkOrder = {
        id: 'wo-1',
        orderNumber: 'WO-2026-001',
        productCode: 'MTR-42-STD',
        qtyOrdered: 5,
        qtyCompleted: 0,
        status: 'pending',
      };
      expect(wo.status).toBe('pending');
      expect(wo.qtyOrdered).toBe(5);
    });
  });

  describe('Step 3: Kit Generation from BOM', () => {
    it('generates correct kit lines from BOM × qty', () => {
      const lines = generateKitLines(bom, 5);
      expect(lines).toHaveLength(3);
      expect(lines[0].materialCode).toBe('WIRE-CU-18');
      expect(lines[0].qtyRequired).toBe(10); // 2 per unit × 5 units
      expect(lines[1].qtyRequired).toBe(20); // 4 per unit × 5 units
      expect(lines[2].qtyRequired).toBe(5);  // 1 per unit × 5 units
    });

    it('all lines start unpicked', () => {
      const lines = generateKitLines(bom, 5);
      expect(lines.every((l) => l.qtyPicked === 0)).toBe(true);
      expect(lines.every((l) => l.materialLotId === null)).toBe(true);
    });
  });

  describe('Step 4: Kit Picking', () => {
    it('picks kit lines from available lots', () => {
      const lot: MaterialLot = {
        id: 'lot-wire', lotNumber: 'LOT-CU-001', materialCode: 'WIRE-CU-18',
        qtyReceived: 100, qtyRemaining: 100, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      const line: KitLine = {
        id: 'kl-0', materialCode: 'WIRE-CU-18',
        qtyRequired: 10, qtyPicked: 0, materialLotId: null,
      };

      const result = pickKitLine(line, lot, 10);
      expect(result.line.qtyPicked).toBe(10);
      expect(result.lot.qtyRemaining).toBe(90);
    });

    it('rejects material code mismatch', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 100, qtyRemaining: 100, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      const line: KitLine = {
        id: 'kl-0', materialCode: 'BRKT-STL-M4',
        qtyRequired: 10, qtyPicked: 0, materialLotId: null,
      };
      expect(() => pickKitLine(line, lot, 10)).toThrow('Material code mismatch');
    });

    it('rejects expired lots', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 100, qtyRemaining: 100, status: 'available',
        receivedAt: new Date(), expiresAt: new Date(Date.now() - 1000), supplier: null,
      };
      const line: KitLine = {
        id: 'kl-0', materialCode: 'WIRE-CU-18',
        qtyRequired: 10, qtyPicked: 0, materialLotId: null,
      };
      expect(() => pickKitLine(line, lot, 10)).toThrow('expired');
    });

    it('rejects over-picking', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 100, qtyRemaining: 100, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      const line: KitLine = {
        id: 'kl-0', materialCode: 'WIRE-CU-18',
        qtyRequired: 10, qtyPicked: 0, materialLotId: null,
      };
      expect(() => pickKitLine(line, lot, 11)).toThrow('Over-picking');
    });
  });

  describe('Step 5: Kit Issuing', () => {
    it('issues fully picked kit', () => {
      const kit: Kit = {
        id: 'kit-1', workOrderId: 'wo-1', status: 'complete',
        lines: [
          { id: 'kl-0', materialCode: 'WIRE-CU-18', qtyRequired: 10, qtyPicked: 10, materialLotId: 'lot-1' },
          { id: 'kl-1', materialCode: 'BRKT-STL-M4', qtyRequired: 20, qtyPicked: 20, materialLotId: 'lot-2' },
        ],
      };
      const issued = issueKit(kit);
      expect(issued.status).toBe('issued');
    });

    it('rejects incomplete kit', () => {
      const kit: Kit = {
        id: 'kit-1', workOrderId: 'wo-1', status: 'in_progress',
        lines: [
          { id: 'kl-0', materialCode: 'WIRE-CU-18', qtyRequired: 10, qtyPicked: 5, materialLotId: 'lot-1' },
        ],
      };
      expect(() => issueKit(kit)).toThrow('not fully picked');
    });
  });

  describe('Step 6: Work Order Release', () => {
    it('releases with issued kit (no warning)', () => {
      const wo: WorkOrder = { id: 'wo-1', orderNumber: 'WO-001', productCode: 'MTR-42', qtyOrdered: 5, qtyCompleted: 0, status: 'pending' };
      const kit: Kit = { id: 'kit-1', workOrderId: 'wo-1', status: 'issued', lines: [] };
      const result = releaseWorkOrder(wo, kit);
      expect(result.status).toBe('released');
      expect(result.kitWarning).toBeNull();
    });

    it('releases without kit (with warning)', () => {
      const wo: WorkOrder = { id: 'wo-1', orderNumber: 'WO-001', productCode: 'MTR-42', qtyOrdered: 5, qtyCompleted: 0, status: 'pending' };
      const result = releaseWorkOrder(wo, null);
      expect(result.status).toBe('released');
      expect(result.kitWarning).toBe('No kit created');
    });

    it('warns if kit not issued', () => {
      const wo: WorkOrder = { id: 'wo-1', orderNumber: 'WO-001', productCode: 'MTR-42', qtyOrdered: 5, qtyCompleted: 0, status: 'pending' };
      const kit: Kit = { id: 'kit-1', workOrderId: 'wo-1', status: 'pending', lines: [] };
      const result = releaseWorkOrder(wo, kit);
      expect(result.kitWarning).toContain('pending');
    });

    it('rejects releasing non-pending work order', () => {
      const wo: WorkOrder = { id: 'wo-1', orderNumber: 'WO-001', productCode: 'MTR-42', qtyOrdered: 5, qtyCompleted: 0, status: 'released' };
      expect(() => releaseWorkOrder(wo, null)).toThrow('Can only release pending');
    });
  });

  describe('Step 7: Unit Processing Through Stations', () => {
    it('starts and completes operation with cycle time', () => {
      const exec = startOperation('unit-1', 'station-winding');
      expect(exec.result).toBeNull();
      expect(exec.completedAt).toBeNull();

      const completed = completeOperation(exec, 'pass');
      expect(completed.result).toBe('pass');
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.cycleTimeMinutes).toBeGreaterThan(0);
    });

    it('processes unit through multiple stations sequentially', () => {
      const results: Execution[] = [];
      for (const stationId of stations) {
        const exec = startOperation('unit-1', stationId);
        results.push(completeOperation(exec, 'pass'));
      }
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.result === 'pass')).toBe(true);
      expect(results.every((r) => r.cycleTimeMinutes !== null)).toBe(true);
    });

    it('handles fail result at a station', () => {
      const exec = startOperation('unit-1', 'station-test');
      const completed = completeOperation(exec, 'fail');
      expect(completed.result).toBe('fail');
    });

    it('handles rework result', () => {
      const exec = startOperation('unit-1', 'station-assembly');
      const completed = completeOperation(exec, 'rework');
      expect(completed.result).toBe('rework');
    });
  });

  describe('Step 8: Material Consumption (FIFO)', () => {
    it('consumes from lot and decrements quantity', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 100, qtyRemaining: 100, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      const { lot: updated, consumption } = consumeMaterial(lot, 'unit-1', 2);
      expect(updated.qtyRemaining).toBe(98);
      expect(updated.status).toBe('available');
      expect(consumption.qtyConsumed).toBe(2);
    });

    it('depletes lot when fully consumed', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 2, qtyRemaining: 2, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      const { lot: updated } = consumeMaterial(lot, 'unit-1', 2);
      expect(updated.qtyRemaining).toBe(0);
      expect(updated.status).toBe('depleted');
    });

    it('FIFO: consumes oldest lot first', () => {
      const lots: MaterialLot[] = [
        { id: 'lot-new', lotNumber: 'L2', materialCode: 'WIRE-CU-18', qtyReceived: 50, qtyRemaining: 50, status: 'available', receivedAt: new Date('2026-03-10'), expiresAt: null, supplier: null },
        { id: 'lot-old', lotNumber: 'L1', materialCode: 'WIRE-CU-18', qtyReceived: 50, qtyRemaining: 50, status: 'available', receivedAt: new Date('2026-03-01'), expiresAt: null, supplier: null },
      ];
      // Sort FIFO (oldest first)
      const sorted = [...lots].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      expect(sorted[0].id).toBe('lot-old');
      // Consume from oldest
      const { lot: consumed } = consumeMaterial(sorted[0], 'unit-1', 2);
      expect(consumed.id).toBe('lot-old');
      expect(consumed.qtyRemaining).toBe(48);
    });

    it('rejects expired lot consumption', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 50, qtyRemaining: 50, status: 'available',
        receivedAt: new Date(), expiresAt: new Date(Date.now() - 1000), supplier: null,
      };
      expect(() => consumeMaterial(lot, 'unit-1', 2)).toThrow('expired');
    });

    it('rejects over-consumption', () => {
      const lot: MaterialLot = {
        id: 'lot-1', lotNumber: 'L1', materialCode: 'WIRE-CU-18',
        qtyReceived: 5, qtyRemaining: 5, status: 'available',
        receivedAt: new Date(), expiresAt: null, supplier: null,
      };
      expect(() => consumeMaterial(lot, 'unit-1', 10)).toThrow('Insufficient');
    });
  });

  describe('Step 9: NCR Flow', () => {
    it('fail → NCR → disposition → close', () => {
      // Quality check fails
      const failedCheck = { result: 'fail' as const };
      expect(failedCheck.result).toBe('fail');

      // Create NCR
      const ncr = {
        id: 'ncr-1', unitId: 'unit-1', stationId: 'station-test',
        defectType: 'Insulation breakdown', status: 'open' as const,
        disposition: null as string | null, closedAt: null as Date | null,
      };
      expect(ncr.status).toBe('open');

      // Disposition as rework
      const dispositioned = { ...ncr, status: 'dispositioned' as const, disposition: 'rework' };
      expect(dispositioned.disposition).toBe('rework');

      // Close NCR
      const closed = { ...dispositioned, status: 'closed' as const, closedAt: new Date() };
      expect(closed.status).toBe('closed');
      expect(closed.closedAt).toBeInstanceOf(Date);
    });
  });

  describe('Step 10: Work Order Completion', () => {
    it('tracks completed unit count', () => {
      const units: Unit[] = [
        { id: 'u1', serialNumber: 'SN-001', workOrderId: 'wo-1', status: 'completed' },
        { id: 'u2', serialNumber: 'SN-002', workOrderId: 'wo-1', status: 'completed' },
        { id: 'u3', serialNumber: 'SN-003', workOrderId: 'wo-1', status: 'completed' },
        { id: 'u4', serialNumber: 'SN-004', workOrderId: 'wo-1', status: 'in_progress' },
        { id: 'u5', serialNumber: 'SN-005', workOrderId: 'wo-1', status: 'scrapped' },
      ];

      const completed = units.filter((u) => u.status === 'completed').length;
      expect(completed).toBe(3);

      const wo: WorkOrder = {
        id: 'wo-1', orderNumber: 'WO-001', productCode: 'MTR-42',
        qtyOrdered: 5, qtyCompleted: completed, status: 'completed',
      };
      expect(wo.qtyCompleted).toBe(3);
      expect(wo.qtyCompleted).toBeLessThan(wo.qtyOrdered);
    });
  });

  describe('Step 11: Traceability Verification', () => {
    const consumptions: Consumption[] = [
      { unitId: 'u1', materialLotId: 'lot-wire-1', materialCode: 'WIRE-CU-18', qtyConsumed: 2 },
      { unitId: 'u1', materialLotId: 'lot-brkt-1', materialCode: 'BRKT-STL-M4', qtyConsumed: 4 },
      { unitId: 'u2', materialLotId: 'lot-wire-1', materialCode: 'WIRE-CU-18', qtyConsumed: 2 },
      { unitId: 'u2', materialLotId: 'lot-brkt-2', materialCode: 'BRKT-STL-M4', qtyConsumed: 4 },
      { unitId: 'u3', materialLotId: 'lot-wire-2', materialCode: 'WIRE-CU-18', qtyConsumed: 2 },
    ];

    it('forward trace: unit → lots', () => {
      const unit1Lots = consumptions
        .filter((c) => c.unitId === 'u1')
        .map((c) => c.materialLotId);
      expect(unit1Lots).toEqual(['lot-wire-1', 'lot-brkt-1']);
    });

    it('reverse trace: lot → units', () => {
      const wire1Units = consumptions
        .filter((c) => c.materialLotId === 'lot-wire-1')
        .map((c) => c.unitId);
      expect(wire1Units).toEqual(['u1', 'u2']);
    });

    it('full material trace for a lot identifies all affected units', () => {
      const lotId = 'lot-wire-1';
      const affectedUnits = [...new Set(
        consumptions.filter((c) => c.materialLotId === lotId).map((c) => c.unitId)
      )];
      expect(affectedUnits).toHaveLength(2);
      expect(affectedUnits).toContain('u1');
      expect(affectedUnits).toContain('u2');
    });

    it('trace shows all materials used by a unit', () => {
      const unitId = 'u1';
      const materials = consumptions
        .filter((c) => c.unitId === unitId)
        .map((c) => c.materialCode);
      expect(materials).toEqual(['WIRE-CU-18', 'BRKT-STL-M4']);
    });
  });

  describe('Step 12: Inventory Accuracy', () => {
    it('on-hand = received - consumed', () => {
      const received = [
        { materialCode: 'WIRE-CU-18', qtyReceived: 100 },
        { materialCode: 'BRKT-STL-M4', qtyReceived: 200 },
      ];
      const consumed = [
        { materialCode: 'WIRE-CU-18', qtyConsumed: 6 },  // 3 units × 2
        { materialCode: 'BRKT-STL-M4', qtyConsumed: 8 },  // 2 units × 4
      ];

      for (const mat of received) {
        const totalConsumed = consumed
          .filter((c) => c.materialCode === mat.materialCode)
          .reduce((sum, c) => sum + c.qtyConsumed, 0);
        const onHand = mat.qtyReceived - totalConsumed;

        if (mat.materialCode === 'WIRE-CU-18') {
          expect(onHand).toBe(94);
        } else {
          expect(onHand).toBe(192);
        }
      }
    });

    it('committed qty comes from kit lines', () => {
      const kitLines: KitLine[] = [
        { id: 'kl-1', materialCode: 'WIRE-CU-18', qtyRequired: 10, qtyPicked: 10, materialLotId: 'lot-1' },
        { id: 'kl-2', materialCode: 'BRKT-STL-M4', qtyRequired: 20, qtyPicked: 20, materialLotId: 'lot-2' },
      ];

      const committed: Record<string, number> = {};
      for (const line of kitLines) {
        committed[line.materialCode] = (committed[line.materialCode] ?? 0) + line.qtyPicked;
      }

      expect(committed['WIRE-CU-18']).toBe(10);
      expect(committed['BRKT-STL-M4']).toBe(20);
    });

    it('available = on-hand - committed', () => {
      const onHand = 94;
      const committed = 10;
      const available = Math.max(0, onHand - committed);
      expect(available).toBe(84);
    });

    it('available floors at zero', () => {
      const onHand = 5;
      const committed = 10;
      const available = Math.max(0, onHand - committed);
      expect(available).toBe(0);
    });
  });
});
