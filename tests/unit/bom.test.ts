import { describe, it, expect } from 'vitest';

describe('BOM Calculation', () => {
  it('calculates total material needed for a work order', () => {
    const bomItems = [
      { materialCode: 'WIRE-CU-18AWG', qtyPerUnit: 50 },
      { materialCode: 'MAG-NEOD-10MM', qtyPerUnit: 4 },
    ];
    const qtyOrdered = 10;

    const requirements = bomItems.map(item => ({
      materialCode: item.materialCode,
      totalRequired: item.qtyPerUnit * qtyOrdered,
    }));

    expect(requirements).toEqual([
      { materialCode: 'WIRE-CU-18AWG', totalRequired: 500 },
      { materialCode: 'MAG-NEOD-10MM', totalRequired: 40 },
    ]);
  });

  it('identifies shortages when available < required', () => {
    const required = [
      { materialCode: 'WIRE-CU-18AWG', totalRequired: 500 },
      { materialCode: 'MAG-NEOD-10MM', totalRequired: 40 },
    ];
    const available: Record<string, number> = {
      'WIRE-CU-18AWG': 450,
      'MAG-NEOD-10MM': 50,
    };

    const shortages = required.filter(
      r => (available[r.materialCode] ?? 0) < r.totalRequired
    );

    expect(shortages).toHaveLength(1);
    expect(shortages[0].materialCode).toBe('WIRE-CU-18AWG');
  });

  it('returns no shortages when all materials are sufficient', () => {
    const required = [
      { materialCode: 'WIRE-CU-18AWG', totalRequired: 500 },
      { materialCode: 'MAG-NEOD-10MM', totalRequired: 40 },
    ];
    const available: Record<string, number> = {
      'WIRE-CU-18AWG': 600,
      'MAG-NEOD-10MM': 50,
    };

    const shortages = required.filter(
      r => (available[r.materialCode] ?? 0) < r.totalRequired
    );

    expect(shortages).toHaveLength(0);
  });

  it('treats missing materials as zero available', () => {
    const required = [
      { materialCode: 'WIRE-CU-18AWG', totalRequired: 500 },
      { materialCode: 'BEAR-6205', totalRequired: 10 },
    ];
    const available: Record<string, number> = {
      'WIRE-CU-18AWG': 600,
    };

    const shortages = required.filter(
      r => (available[r.materialCode] ?? 0) < r.totalRequired
    );

    expect(shortages).toHaveLength(1);
    expect(shortages[0].materialCode).toBe('BEAR-6205');
  });

  it('handles zero quantity ordered', () => {
    const bomItems = [
      { materialCode: 'WIRE-CU-18AWG', qtyPerUnit: 50 },
    ];
    const qtyOrdered = 0;

    const requirements = bomItems.map(item => ({
      materialCode: item.materialCode,
      totalRequired: item.qtyPerUnit * qtyOrdered,
    }));

    expect(requirements[0].totalRequired).toBe(0);
  });
});
