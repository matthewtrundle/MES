import { describe, it, expect } from 'vitest';

describe('Kit Generation Logic', () => {
  it('generates kit lines from BOM items x quantity', () => {
    const bomItems = [
      { materialCode: 'WIRE-CU-18AWG', description: 'Wire', qtyPerUnit: 50 },
      { materialCode: 'MAG-NEOD-10MM', description: 'Magnets', qtyPerUnit: 4 },
    ];
    const qtyOrdered = 5;

    const kitLines = bomItems.map(item => ({
      materialCode: item.materialCode,
      description: item.description,
      qtyRequired: item.qtyPerUnit * qtyOrdered,
      qtyPicked: 0,
    }));

    expect(kitLines).toHaveLength(2);
    expect(kitLines[0].qtyRequired).toBe(250);
    expect(kitLines[1].qtyRequired).toBe(20);
  });

  it('identifies unpicked lines as shortages', () => {
    const kitLines = [
      { materialCode: 'WIRE', qtyRequired: 250, qtyPicked: 250 },
      { materialCode: 'MAG', qtyRequired: 20, qtyPicked: 15 },
      { materialCode: 'BEAR', qtyRequired: 10, qtyPicked: 10 },
    ];

    const shortages = kitLines.filter(l => l.qtyPicked < l.qtyRequired);
    expect(shortages).toHaveLength(1);
    expect(shortages[0].materialCode).toBe('MAG');
  });

  it('kit is complete when all lines are fully picked', () => {
    const kitLines = [
      { qtyRequired: 250, qtyPicked: 250 },
      { qtyRequired: 20, qtyPicked: 20 },
    ];

    const isComplete = kitLines.every(l => l.qtyPicked >= l.qtyRequired);
    expect(isComplete).toBe(true);
  });

  it('kit is incomplete when any line is under-picked', () => {
    const kitLines = [
      { qtyRequired: 250, qtyPicked: 250 },
      { qtyRequired: 20, qtyPicked: 19 },
    ];

    const isComplete = kitLines.every(l => l.qtyPicked >= l.qtyRequired);
    expect(isComplete).toBe(false);
  });

  it('calculates pick percentage for each line', () => {
    const kitLines = [
      { materialCode: 'WIRE', qtyRequired: 250, qtyPicked: 125 },
      { materialCode: 'MAG', qtyRequired: 20, qtyPicked: 20 },
    ];

    const withPercentage = kitLines.map(l => ({
      ...l,
      percentPicked: Math.round((l.qtyPicked / l.qtyRequired) * 100),
    }));

    expect(withPercentage[0].percentPicked).toBe(50);
    expect(withPercentage[1].percentPicked).toBe(100);
  });

  it('over-picking is allowed and kit is still considered complete', () => {
    const kitLines = [
      { qtyRequired: 250, qtyPicked: 260 },
      { qtyRequired: 20, qtyPicked: 20 },
    ];

    const isComplete = kitLines.every(l => l.qtyPicked >= l.qtyRequired);
    expect(isComplete).toBe(true);
  });
});
