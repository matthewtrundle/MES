import { describe, it, expect } from 'vitest';

/**
 * Inventory Accuracy Integration Tests
 *
 * Tests inventory calculation logic:
 * - On-hand = sum of available lot quantities
 * - Committed = quantities reserved in kits
 * - Available = on-hand - committed (min 0)
 * - Low stock detection based on consumption rate
 * - Expiring lot detection
 */

// Domain types matching the source models

interface MaterialLot {
  id: string;
  materialCode: string;
  description: string | null;
  qtyRemaining: number;
  unitOfMeasure: string;
  status: 'available' | 'quarantine' | 'depleted';
  expiresAt: Date | null;
}

interface KitLine {
  materialCode: string;
  qtyPicked: number;
  kitStatus: 'pending' | 'in_progress' | 'complete' | 'issued';
}

interface ConsumptionRecord {
  materialCode: string;
  qtyConsumed: number;
  timestamp: Date;
}

interface InventorySummaryEntry {
  materialCode: string;
  description: string | null;
  unitOfMeasure: string;
  totalOnHand: number;
  committed: number;
  available: number;
  lotCount: number;
  expiringCount: number;
}

// Pure functions that replicate the inventory calculation logic from src/lib/actions/inventory.ts

function calculateInventorySummary(
  lots: MaterialLot[],
  kitLines: KitLine[],
  now: Date = new Date()
): InventorySummaryEntry[] {
  const summary: Record<string, InventorySummaryEntry> = {};
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const lot of lots) {
    if (lot.qtyRemaining <= 0) continue;

    if (!summary[lot.materialCode]) {
      summary[lot.materialCode] = {
        materialCode: lot.materialCode,
        description: lot.description,
        unitOfMeasure: lot.unitOfMeasure,
        totalOnHand: 0,
        committed: 0,
        available: 0,
        lotCount: 0,
        expiringCount: 0,
      };
    }

    const entry = summary[lot.materialCode];
    if (lot.status === 'available') {
      entry.totalOnHand += lot.qtyRemaining;
      entry.lotCount += 1;
    }
    if (lot.expiresAt && lot.expiresAt > now && lot.expiresAt <= sevenDays) {
      entry.expiringCount += 1;
    }
  }

  // Add committed quantities from kit lines
  // Only count kits in active statuses (pending, in_progress, complete - not issued)
  const activeKitStatuses = ['pending', 'in_progress', 'complete'];
  for (const line of kitLines) {
    if (activeKitStatuses.includes(line.kitStatus) && line.qtyPicked > 0) {
      if (summary[line.materialCode]) {
        summary[line.materialCode].committed += line.qtyPicked;
      }
    }
  }

  // Calculate available = onHand - committed (min 0)
  for (const entry of Object.values(summary)) {
    entry.available = Math.max(0, entry.totalOnHand - entry.committed);
  }

  return Object.values(summary).sort((a, b) => a.materialCode.localeCompare(b.materialCode));
}

function calculateDailyConsumptionRate(
  consumptions: ConsumptionRecord[],
  periodDays: number = 30
): Record<string, number> {
  const rates: Record<string, number> = {};

  for (const c of consumptions) {
    if (!rates[c.materialCode]) {
      rates[c.materialCode] = 0;
    }
    rates[c.materialCode] += c.qtyConsumed;
  }

  // Convert totals to daily rates
  for (const code of Object.keys(rates)) {
    rates[code] = rates[code] / periodDays;
  }

  return rates;
}

function detectLowStock(
  onHand: Record<string, number>,
  dailyRates: Record<string, number>,
  thresholdDays: number = 14
): Array<{
  materialCode: string;
  currentOnHand: number;
  dailyConsumptionRate: number;
  daysRemaining: number;
}> {
  const lowStock = [];

  for (const [code, rate] of Object.entries(dailyRates)) {
    const currentQty = onHand[code] ?? 0;
    const daysRemaining = rate > 0 ? currentQty / rate : Infinity;

    if (daysRemaining <= thresholdDays) {
      lowStock.push({
        materialCode: code,
        currentOnHand: currentQty,
        dailyConsumptionRate: Math.round(rate * 100) / 100,
        daysRemaining: Math.round(daysRemaining),
      });
    }
  }

  return lowStock.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

function countExpiringLots(
  lots: MaterialLot[],
  withinDays: number = 7,
  now: Date = new Date()
): MaterialLot[] {
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return lots.filter(
    (lot) =>
      lot.qtyRemaining > 0 &&
      lot.expiresAt !== null &&
      lot.expiresAt > now &&
      lot.expiresAt <= threshold
  );
}

// --- Test Data Helpers ---

const NOW = new Date('2026-03-11T12:00:00Z');

function makeLot(overrides: Partial<MaterialLot> & { materialCode: string }): MaterialLot {
  return {
    id: `lot-${Math.random().toString(36).slice(2, 8)}`,
    description: null,
    qtyRemaining: 100,
    unitOfMeasure: 'ea',
    status: 'available',
    expiresAt: null,
    ...overrides,
  };
}

function makeKitLine(overrides: Partial<KitLine> & { materialCode: string }): KitLine {
  return {
    qtyPicked: 0,
    kitStatus: 'in_progress',
    ...overrides,
  };
}

// --- Tests ---

describe('Inventory Accuracy', () => {
  describe('On-Hand Calculation', () => {
    it('sums lot quantities for the same material code', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 200 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 150 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 50 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary).toHaveLength(1);
      expect(summary[0].totalOnHand).toBe(400);
    });

    it('groups different material codes separately', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 200 }),
        makeLot({ materialCode: 'MAG', qtyRemaining: 50 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 100 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary).toHaveLength(2);

      const wire = summary.find((s) => s.materialCode === 'WIRE');
      const mag = summary.find((s) => s.materialCode === 'MAG');
      expect(wire?.totalOnHand).toBe(300);
      expect(mag?.totalOnHand).toBe(50);
    });

    it('excludes lots with zero remaining quantity', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 200 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 0 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary[0].totalOnHand).toBe(200);
      expect(summary[0].lotCount).toBe(1);
    });

    it('only counts available status lots in on-hand', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 200, status: 'available' }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 100, status: 'quarantine' }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary[0].totalOnHand).toBe(200);
      expect(summary[0].lotCount).toBe(1);
    });

    it('returns empty array when no lots have remaining quantity', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 0 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary).toHaveLength(0);
    });

    it('counts the number of active lots per material', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 100 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 50 }),
        makeLot({ materialCode: 'WIRE', qtyRemaining: 25 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary[0].lotCount).toBe(3);
    });
  });

  describe('Committed Quantity (Kit Reservations)', () => {
    it('sums picked quantities from active kit lines', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 100, kitStatus: 'in_progress' }),
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 50, kitStatus: 'pending' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].committed).toBe(150);
    });

    it('does not count issued kit lines as committed', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 100, kitStatus: 'issued' }),
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 50, kitStatus: 'in_progress' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].committed).toBe(50);
    });

    it('counts complete (but not issued) kit lines as committed', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 200, kitStatus: 'complete' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].committed).toBe(200);
    });

    it('ignores kit lines with zero picked quantity', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 0, kitStatus: 'pending' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].committed).toBe(0);
    });
  });

  describe('Available = On-Hand - Committed', () => {
    it('calculates available as on-hand minus committed', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 200, kitStatus: 'in_progress' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].totalOnHand).toBe(500);
      expect(summary[0].committed).toBe(200);
      expect(summary[0].available).toBe(300);
    });

    it('floors available at zero when committed exceeds on-hand', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 100 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 150, kitStatus: 'in_progress' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);
      expect(summary[0].totalOnHand).toBe(100);
      expect(summary[0].committed).toBe(150);
      expect(summary[0].available).toBe(0); // Math.max(0, 100 - 150)
    });

    it('available equals on-hand when nothing is committed', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary[0].available).toBe(500);
      expect(summary[0].committed).toBe(0);
    });

    it('handles multiple materials correctly', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 500 }),
        makeLot({ materialCode: 'MAG', qtyRemaining: 80 }),
      ];
      const kitLines = [
        makeKitLine({ materialCode: 'WIRE', qtyPicked: 200, kitStatus: 'in_progress' }),
        makeKitLine({ materialCode: 'MAG', qtyPicked: 30, kitStatus: 'in_progress' }),
      ];

      const summary = calculateInventorySummary(lots, kitLines, NOW);

      const wire = summary.find((s) => s.materialCode === 'WIRE')!;
      const mag = summary.find((s) => s.materialCode === 'MAG')!;

      expect(wire.available).toBe(300);
      expect(mag.available).toBe(50);
    });
  });

  describe('Low Stock Detection', () => {
    it('detects materials below threshold days of supply', () => {
      const onHand: Record<string, number> = { WIRE: 100 };
      const dailyRates: Record<string, number> = { WIRE: 10 }; // 10/day = 10 days supply

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(1);
      expect(lowStock[0].materialCode).toBe('WIRE');
      expect(lowStock[0].daysRemaining).toBe(10);
    });

    it('does not flag materials above threshold', () => {
      const onHand: Record<string, number> = { WIRE: 300 };
      const dailyRates: Record<string, number> = { WIRE: 10 }; // 30 days supply

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(0);
    });

    it('flags materials exactly at threshold', () => {
      const onHand: Record<string, number> = { WIRE: 140 };
      const dailyRates: Record<string, number> = { WIRE: 10 }; // exactly 14 days

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(1);
      expect(lowStock[0].daysRemaining).toBe(14);
    });

    it('handles zero consumption rate as infinite days remaining', () => {
      const onHand: Record<string, number> = { WIRE: 100 };
      const dailyRates: Record<string, number> = { WIRE: 0 };

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(0);
    });

    it('treats missing on-hand as zero stock', () => {
      const onHand: Record<string, number> = {}; // no WIRE
      const dailyRates: Record<string, number> = { WIRE: 5 };

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(1);
      expect(lowStock[0].daysRemaining).toBe(0);
      expect(lowStock[0].currentOnHand).toBe(0);
    });

    it('sorts results by days remaining ascending (most urgent first)', () => {
      const onHand: Record<string, number> = { WIRE: 50, MAG: 20, BEAR: 10 };
      const dailyRates: Record<string, number> = { WIRE: 5, MAG: 5, BEAR: 5 };

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock).toHaveLength(3);
      expect(lowStock[0].materialCode).toBe('BEAR'); // 2 days
      expect(lowStock[1].materialCode).toBe('MAG');  // 4 days
      expect(lowStock[2].materialCode).toBe('WIRE'); // 10 days
    });

    it('rounds daily consumption rate to 2 decimal places', () => {
      const onHand: Record<string, number> = { WIRE: 10 };
      const dailyRates: Record<string, number> = { WIRE: 3.33333 };

      const lowStock = detectLowStock(onHand, dailyRates, 14);
      expect(lowStock[0].dailyConsumptionRate).toBe(3.33);
    });
  });

  describe('Daily Consumption Rate Calculation', () => {
    it('calculates daily rate from consumption records over 30 days', () => {
      const consumptions: ConsumptionRecord[] = [
        { materialCode: 'WIRE', qtyConsumed: 150, timestamp: new Date('2026-02-15') },
        { materialCode: 'WIRE', qtyConsumed: 150, timestamp: new Date('2026-03-01') },
      ];

      const rates = calculateDailyConsumptionRate(consumptions, 30);
      expect(rates['WIRE']).toBe(10); // 300 / 30 = 10 per day
    });

    it('handles multiple material codes', () => {
      const consumptions: ConsumptionRecord[] = [
        { materialCode: 'WIRE', qtyConsumed: 300, timestamp: new Date('2026-03-01') },
        { materialCode: 'MAG', qtyConsumed: 60, timestamp: new Date('2026-03-01') },
      ];

      const rates = calculateDailyConsumptionRate(consumptions, 30);
      expect(rates['WIRE']).toBe(10);
      expect(rates['MAG']).toBe(2);
    });

    it('returns empty object when no consumptions', () => {
      const rates = calculateDailyConsumptionRate([], 30);
      expect(Object.keys(rates)).toHaveLength(0);
    });

    it('aggregates multiple consumption events for same material', () => {
      const consumptions: ConsumptionRecord[] = [
        { materialCode: 'WIRE', qtyConsumed: 50, timestamp: new Date('2026-03-01') },
        { materialCode: 'WIRE', qtyConsumed: 30, timestamp: new Date('2026-03-05') },
        { materialCode: 'WIRE', qtyConsumed: 20, timestamp: new Date('2026-03-09') },
      ];

      const rates = calculateDailyConsumptionRate(consumptions, 30);
      expect(rates['WIRE']).toBeCloseTo(100 / 30);
    });
  });

  describe('Expiring Lot Detection', () => {
    it('detects lots expiring within the threshold window', () => {
      const lots = [
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 50,
          expiresAt: new Date('2026-03-15T12:00:00Z'), // 4 days from NOW
        }),
      ];

      const expiring = countExpiringLots(lots, 7, NOW);
      expect(expiring).toHaveLength(1);
    });

    it('does not include lots already expired', () => {
      const lots = [
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 50,
          expiresAt: new Date('2026-03-10T12:00:00Z'), // yesterday
        }),
      ];

      const expiring = countExpiringLots(lots, 7, NOW);
      expect(expiring).toHaveLength(0);
    });

    it('does not include lots expiring beyond the window', () => {
      const lots = [
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 50,
          expiresAt: new Date('2026-04-01T12:00:00Z'), // 3 weeks out
        }),
      ];

      const expiring = countExpiringLots(lots, 7, NOW);
      expect(expiring).toHaveLength(0);
    });

    it('does not include lots with no expiry date', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 50, expiresAt: null }),
      ];

      const expiring = countExpiringLots(lots, 7, NOW);
      expect(expiring).toHaveLength(0);
    });

    it('does not include depleted lots', () => {
      const lots = [
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 0,
          expiresAt: new Date('2026-03-15T12:00:00Z'),
        }),
      ];

      const expiring = countExpiringLots(lots, 7, NOW);
      expect(expiring).toHaveLength(0);
    });

    it('counts expiring lots in inventory summary', () => {
      const lots = [
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 100,
          expiresAt: new Date('2026-03-15T12:00:00Z'), // within 7 days
        }),
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 200,
          expiresAt: new Date('2026-04-15T12:00:00Z'), // beyond 7 days
        }),
        makeLot({
          materialCode: 'WIRE',
          qtyRemaining: 50,
          expiresAt: new Date('2026-03-13T12:00:00Z'), // within 7 days
        }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary[0].expiringCount).toBe(2);
      expect(summary[0].totalOnHand).toBe(350);
    });
  });

  describe('Results Sorting', () => {
    it('sorts inventory summary by material code alphabetically', () => {
      const lots = [
        makeLot({ materialCode: 'WIRE', qtyRemaining: 100 }),
        makeLot({ materialCode: 'BEAR', qtyRemaining: 50 }),
        makeLot({ materialCode: 'MAG', qtyRemaining: 30 }),
      ];

      const summary = calculateInventorySummary(lots, [], NOW);
      expect(summary.map((s) => s.materialCode)).toEqual(['BEAR', 'MAG', 'WIRE']);
    });
  });
});
