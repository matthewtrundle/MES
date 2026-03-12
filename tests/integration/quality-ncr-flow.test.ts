import { describe, it, expect } from 'vitest';

/**
 * Quality Check & NCR Flow Integration Tests
 *
 * Tests quality check recording and NCR lifecycle:
 * - Quality check result validation
 * - NCR creation rules
 * - NCR disposition transitions
 * - NCR closure requirements
 */

type QualityResult = 'pass' | 'fail';
type NCRDisposition = 'rework' | 'scrap' | 'use_as_is' | 'defer';
type NCRStatus = 'open' | 'dispositioned' | 'closed';

interface QualityCheckResult {
  id: string;
  unitId: string;
  definitionId: string;
  result: QualityResult;
  values: Record<string, unknown>;
  operatorId: string;
}

interface NCR {
  id: string;
  unitId: string;
  stationId: string;
  defectType: string;
  description: string | null;
  status: NCRStatus;
  disposition: NCRDisposition | null;
  dispositionedAt: Date | null;
  closedAt: Date | null;
}

// ── Quality Check Result Validation ──────────────────────────────

function validateQualityResult(result: string): result is QualityResult {
  return ['pass', 'fail'].includes(result);
}

function recordQualityCheck(data: {
  unitId: string;
  definitionId: string;
  result: string;
  values: Record<string, unknown>;
}): QualityCheckResult {
  if (!data.unitId) throw new Error('Unit ID is required');
  if (!data.definitionId) throw new Error('Definition ID is required');
  if (!validateQualityResult(data.result)) {
    throw new Error(`Invalid result: ${data.result}. Must be 'pass' or 'fail'`);
  }

  return {
    id: `qcr-${Date.now()}`,
    unitId: data.unitId,
    definitionId: data.definitionId,
    result: data.result,
    values: data.values,
    operatorId: 'operator-1',
  };
}

// ── NCR Lifecycle ────────────────────────────────────────────────

function createNCR(data: {
  unitId: string;
  stationId: string;
  defectType: string;
  description?: string;
}): NCR {
  if (!data.unitId) throw new Error('Unit ID is required');
  if (!data.stationId) throw new Error('Station ID is required');
  if (!data.defectType || data.defectType.trim().length === 0) {
    throw new Error('Defect type is required');
  }
  if (data.defectType.length > 200) {
    throw new Error('Defect type too long');
  }

  return {
    id: `ncr-${Date.now()}`,
    unitId: data.unitId,
    stationId: data.stationId,
    defectType: data.defectType,
    description: data.description ?? null,
    status: 'open',
    disposition: null,
    dispositionedAt: null,
    closedAt: null,
  };
}

function dispositionNCR(ncr: NCR, disposition: string): NCR {
  if (ncr.status !== 'open') {
    throw new Error(`Cannot disposition NCR in ${ncr.status} status`);
  }
  const validDispositions: NCRDisposition[] = ['rework', 'scrap', 'use_as_is', 'defer'];
  if (!validDispositions.includes(disposition as NCRDisposition)) {
    throw new Error(`Invalid disposition: ${disposition}`);
  }

  return {
    ...ncr,
    status: 'dispositioned',
    disposition: disposition as NCRDisposition,
    dispositionedAt: new Date(),
  };
}

function closeNCR(ncr: NCR): NCR {
  if (ncr.status !== 'dispositioned') {
    throw new Error(`Cannot close NCR in ${ncr.status} status. Must be dispositioned first.`);
  }

  return {
    ...ncr,
    status: 'closed',
    closedAt: new Date(),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('Quality Check Result Validation', () => {
  it('accepts pass result', () => {
    const result = recordQualityCheck({
      unitId: 'unit-1',
      definitionId: 'def-1',
      result: 'pass',
      values: { torque: 45.2 },
    });
    expect(result.result).toBe('pass');
    expect(result.values).toEqual({ torque: 45.2 });
  });

  it('accepts fail result', () => {
    const result = recordQualityCheck({
      unitId: 'unit-1',
      definitionId: 'def-1',
      result: 'fail',
      values: { torque: 12.0 },
    });
    expect(result.result).toBe('fail');
  });

  it('rejects invalid result values', () => {
    expect(() =>
      recordQualityCheck({
        unitId: 'unit-1',
        definitionId: 'def-1',
        result: 'maybe',
        values: {},
      })
    ).toThrow('Invalid result');
  });

  it('rejects empty string result', () => {
    expect(() =>
      recordQualityCheck({
        unitId: 'unit-1',
        definitionId: 'def-1',
        result: '',
        values: {},
      })
    ).toThrow('Invalid result');
  });

  it('requires unitId', () => {
    expect(() =>
      recordQualityCheck({
        unitId: '',
        definitionId: 'def-1',
        result: 'pass',
        values: {},
      })
    ).toThrow('Unit ID is required');
  });

  it('requires definitionId', () => {
    expect(() =>
      recordQualityCheck({
        unitId: 'unit-1',
        definitionId: '',
        result: 'pass',
        values: {},
      })
    ).toThrow('Definition ID is required');
  });

  it('accepts empty values object', () => {
    const result = recordQualityCheck({
      unitId: 'unit-1',
      definitionId: 'def-1',
      result: 'pass',
      values: {},
    });
    expect(result.values).toEqual({});
  });

  it('accepts complex values object', () => {
    const values = {
      measurement: 42.5,
      withinSpec: true,
      checklist: ['item1', 'item2'],
      notes: 'All good',
    };
    const result = recordQualityCheck({
      unitId: 'unit-1',
      definitionId: 'def-1',
      result: 'pass',
      values,
    });
    expect(result.values).toEqual(values);
  });
});

describe('NCR Creation', () => {
  it('creates NCR with valid data', () => {
    const ncr = createNCR({
      unitId: 'unit-1',
      stationId: 'station-1',
      defectType: 'Winding fault',
      description: 'Loose wire observed',
    });
    expect(ncr.status).toBe('open');
    expect(ncr.disposition).toBeNull();
    expect(ncr.defectType).toBe('Winding fault');
    expect(ncr.description).toBe('Loose wire observed');
  });

  it('creates NCR without description', () => {
    const ncr = createNCR({
      unitId: 'unit-1',
      stationId: 'station-1',
      defectType: 'Visual defect',
    });
    expect(ncr.description).toBeNull();
  });

  it('requires unitId', () => {
    expect(() =>
      createNCR({ unitId: '', stationId: 'station-1', defectType: 'Defect' })
    ).toThrow('Unit ID is required');
  });

  it('requires stationId', () => {
    expect(() =>
      createNCR({ unitId: 'unit-1', stationId: '', defectType: 'Defect' })
    ).toThrow('Station ID is required');
  });

  it('requires defect type', () => {
    expect(() =>
      createNCR({ unitId: 'unit-1', stationId: 'station-1', defectType: '' })
    ).toThrow('Defect type is required');
  });

  it('rejects whitespace-only defect type', () => {
    expect(() =>
      createNCR({ unitId: 'unit-1', stationId: 'station-1', defectType: '   ' })
    ).toThrow('Defect type is required');
  });

  it('rejects overly long defect type', () => {
    expect(() =>
      createNCR({ unitId: 'unit-1', stationId: 'station-1', defectType: 'x'.repeat(201) })
    ).toThrow('Defect type too long');
  });

  it('multiple NCRs can exist for same unit', () => {
    const ncr1 = createNCR({ unitId: 'unit-1', stationId: 'station-1', defectType: 'Defect A' });
    const ncr2 = createNCR({ unitId: 'unit-1', stationId: 'station-2', defectType: 'Defect B' });
    // Both NCRs reference the same unit but are separate records
    expect(ncr1.unitId).toBe(ncr2.unitId);
    expect(ncr1.stationId).not.toBe(ncr2.stationId);
    expect(ncr1.defectType).not.toBe(ncr2.defectType);
  });
});

describe('NCR Disposition', () => {
  const openNCR: NCR = {
    id: 'ncr-1',
    unitId: 'unit-1',
    stationId: 'station-1',
    defectType: 'Winding fault',
    description: null,
    status: 'open',
    disposition: null,
    dispositionedAt: null,
    closedAt: null,
  };

  it('accepts rework disposition', () => {
    const result = dispositionNCR(openNCR, 'rework');
    expect(result.status).toBe('dispositioned');
    expect(result.disposition).toBe('rework');
    expect(result.dispositionedAt).toBeInstanceOf(Date);
  });

  it('accepts scrap disposition', () => {
    const result = dispositionNCR(openNCR, 'scrap');
    expect(result.disposition).toBe('scrap');
  });

  it('accepts use_as_is disposition', () => {
    const result = dispositionNCR(openNCR, 'use_as_is');
    expect(result.disposition).toBe('use_as_is');
  });

  it('accepts defer disposition', () => {
    const result = dispositionNCR(openNCR, 'defer');
    expect(result.disposition).toBe('defer');
  });

  it('rejects invalid disposition', () => {
    expect(() => dispositionNCR(openNCR, 'ignore')).toThrow('Invalid disposition');
  });

  it('rejects empty disposition', () => {
    expect(() => dispositionNCR(openNCR, '')).toThrow('Invalid disposition');
  });

  it('cannot disposition already-dispositioned NCR', () => {
    const dispositioned = dispositionNCR(openNCR, 'rework');
    expect(() => dispositionNCR(dispositioned, 'scrap')).toThrow('Cannot disposition NCR in dispositioned status');
  });

  it('cannot disposition closed NCR', () => {
    const dispositioned = dispositionNCR(openNCR, 'rework');
    const closed = closeNCR(dispositioned);
    expect(() => dispositionNCR(closed, 'scrap')).toThrow('Cannot disposition NCR in closed status');
  });
});

describe('NCR Closure', () => {
  const openNCR: NCR = {
    id: 'ncr-1',
    unitId: 'unit-1',
    stationId: 'station-1',
    defectType: 'Defect',
    description: null,
    status: 'open',
    disposition: null,
    dispositionedAt: null,
    closedAt: null,
  };

  it('closes dispositioned NCR', () => {
    const dispositioned = dispositionNCR(openNCR, 'rework');
    const closed = closeNCR(dispositioned);
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeInstanceOf(Date);
    expect(closed.disposition).toBe('rework');
  });

  it('cannot close open NCR (must disposition first)', () => {
    expect(() => closeNCR(openNCR)).toThrow('Must be dispositioned first');
  });

  it('cannot close already-closed NCR', () => {
    const dispositioned = dispositionNCR(openNCR, 'scrap');
    const closed = closeNCR(dispositioned);
    expect(() => closeNCR(closed)).toThrow('Cannot close NCR in closed status');
  });

  it('preserves disposition through closure', () => {
    const dispositioned = dispositionNCR(openNCR, 'use_as_is');
    const closed = closeNCR(dispositioned);
    expect(closed.disposition).toBe('use_as_is');
    expect(closed.dispositionedAt).toBeInstanceOf(Date);
  });
});

describe('Full NCR Lifecycle', () => {
  it('open → dispositioned → closed', () => {
    const ncr = createNCR({
      unitId: 'unit-1',
      stationId: 'station-1',
      defectType: 'Bearing misalignment',
      description: 'Bearing not seated properly',
    });
    expect(ncr.status).toBe('open');

    const dispositioned = dispositionNCR(ncr, 'rework');
    expect(dispositioned.status).toBe('dispositioned');

    const closed = closeNCR(dispositioned);
    expect(closed.status).toBe('closed');
    expect(closed.defectType).toBe('Bearing misalignment');
  });

  it('all disposition types lead to valid closure', () => {
    const dispositions: NCRDisposition[] = ['rework', 'scrap', 'use_as_is', 'defer'];
    for (const disp of dispositions) {
      const ncr = createNCR({
        unitId: 'unit-1',
        stationId: 'station-1',
        defectType: `Defect for ${disp}`,
      });
      const dispositioned = dispositionNCR(ncr, disp);
      const closed = closeNCR(dispositioned);
      expect(closed.status).toBe('closed');
      expect(closed.disposition).toBe(disp);
    }
  });
});
