'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

// ============================================================================
// Types
// ============================================================================

export interface SPCDataPoint {
  checkName: string;
  definitionId: string;
  sourceType: 'quality_check' | 'ctq';
  mean: number;
  sigma: number;
  cp: number | null;
  cpk: number | null;
  count: number;
  usl: number | null;
  lsl: number | null;
  controlLimits: {
    ucl: number;
    cl: number;
    lcl: number;
  };
}

export interface ControlChartPoint {
  index: number;
  value: number;
  timestamp: string;
  label: string;
}

export interface ControlChartData {
  definitionId: string;
  checkName: string;
  sourceType: 'quality_check' | 'ctq';
  points: ControlChartPoint[];
  mean: number;
  sigma: number;
  ucl: number;
  lcl: number;
  usl: number | null;
  lsl: number | null;
  cp: number | null;
  cpk: number | null;
}

export interface DriftAlert {
  rule: string;
  ruleDescription: string;
  severity: 'warning' | 'critical';
  pointIndices: number[];
  message: string;
}

// ============================================================================
// Helpers
// ============================================================================

function calculateStats(values: number[]): { mean: number; sigma: number } {
  if (values.length === 0) return { mean: 0, sigma: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sigma = Math.sqrt(variance);
  return { mean, sigma };
}

function calculateCp(usl: number, lsl: number, sigma: number): number | null {
  if (sigma === 0) return null;
  return (usl - lsl) / (6 * sigma);
}

function calculateCpk(mean: number, usl: number, lsl: number, sigma: number): number | null {
  if (sigma === 0) return null;
  const cpkUpper = (usl - mean) / (3 * sigma);
  const cpkLower = (mean - lsl) / (3 * sigma);
  return Math.min(cpkUpper, cpkLower);
}

function round(value: number, decimals: number = 3): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

// ============================================================================
// SPC Data - Summary of all quality checks with Cp/Cpk
// ============================================================================

export async function getSPCData(params: {
  stationId?: string;
  checkType?: string;
  days?: number;
} = {}): Promise<SPCDataPoint[]> {
  await requireRole(['admin', 'supervisor']);

  const { stationId, checkType, days = 30 } = params;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const results: SPCDataPoint[] = [];

  // 1. CTQ Measurements (have explicit USL/LSL)
  const ctqDefinitions = await prisma.cTQDefinition.findMany({
    where: { active: true },
    include: {
      measurements: {
        where: { measuredAt: { gte: since } },
        orderBy: { measuredAt: 'asc' },
      },
    },
  });

  for (const def of ctqDefinitions) {
    if (def.measurements.length < 2) continue;

    const values = def.measurements.map((m) => m.measuredValue);
    const { mean, sigma } = calculateStats(values);
    const cp = calculateCp(def.usl, def.lsl, sigma);
    const cpk = calculateCpk(mean, def.usl, def.lsl, sigma);

    results.push({
      checkName: `${def.dimensionName} (${def.partNumber})`,
      definitionId: def.id,
      sourceType: 'ctq',
      mean: round(mean),
      sigma: round(sigma),
      cp: cp !== null ? round(cp) : null,
      cpk: cpk !== null ? round(cpk) : null,
      count: values.length,
      usl: def.usl,
      lsl: def.lsl,
      controlLimits: {
        ucl: round(mean + 3 * sigma),
        cl: round(mean),
        lcl: round(mean - 3 * sigma),
      },
    });
  }

  // 2. Quality Check Results with measurement data
  const qualityDefs = await prisma.qualityCheckDefinition.findMany({
    where: {
      active: true,
      checkType: checkType ?? 'measurement',
      ...(stationId && { stationIds: { has: stationId } }),
    },
    include: {
      results: {
        where: { timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  for (const def of qualityDefs) {
    if (def.results.length < 2) continue;

    // Extract measurement values from valuesJson
    const values: number[] = [];
    for (const result of def.results) {
      const valJson = result.valuesJson as Record<string, unknown>;
      // valuesJson can contain { value: number } or { measured: number } or similar
      const numVal = extractNumericValue(valJson);
      if (numVal !== null) {
        values.push(numVal);
      }
    }

    if (values.length < 2) continue;

    const { mean, sigma } = calculateStats(values);

    // Try to extract spec limits from definition parameters
    const params = def.parameters as Record<string, unknown>;
    const usl = extractNumber(params, ['usl', 'upperLimit', 'upper_limit', 'max']);
    const lsl = extractNumber(params, ['lsl', 'lowerLimit', 'lower_limit', 'min']);

    const cp = usl !== null && lsl !== null ? calculateCp(usl, lsl, sigma) : null;
    const cpk = usl !== null && lsl !== null ? calculateCpk(mean, usl, lsl, sigma) : null;

    results.push({
      checkName: def.name,
      definitionId: def.id,
      sourceType: 'quality_check',
      mean: round(mean),
      sigma: round(sigma),
      cp: cp !== null ? round(cp) : null,
      cpk: cpk !== null ? round(cpk) : null,
      count: values.length,
      usl,
      lsl,
      controlLimits: {
        ucl: round(mean + 3 * sigma),
        cl: round(mean),
        lcl: round(mean - 3 * sigma),
      },
    });
  }

  return results;
}

// ============================================================================
// Control Chart Data - Time series for a specific definition
// ============================================================================

export async function getControlChartData(
  definitionId: string,
  sourceType: 'quality_check' | 'ctq',
  days: number = 30
): Promise<ControlChartData | null> {
  await requireRole(['admin', 'supervisor']);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (sourceType === 'ctq') {
    const def = await prisma.cTQDefinition.findUnique({
      where: { id: definitionId },
      include: {
        measurements: {
          where: { measuredAt: { gte: since } },
          orderBy: { measuredAt: 'asc' },
        },
      },
    });

    if (!def || def.measurements.length < 2) return null;

    const values = def.measurements.map((m) => m.measuredValue);
    const { mean, sigma } = calculateStats(values);

    const points: ControlChartPoint[] = def.measurements.map((m, i) => ({
      index: i,
      value: m.measuredValue,
      timestamp: m.measuredAt.toISOString(),
      label: `#${m.sampleNumber}`,
    }));

    return {
      definitionId: def.id,
      checkName: `${def.dimensionName} (${def.partNumber})`,
      sourceType: 'ctq',
      points,
      mean: round(mean),
      sigma: round(sigma),
      ucl: round(mean + 3 * sigma),
      lcl: round(mean - 3 * sigma),
      usl: def.usl,
      lsl: def.lsl,
      cp: calculateCp(def.usl, def.lsl, sigma) !== null ? round(calculateCp(def.usl, def.lsl, sigma)!) : null,
      cpk: calculateCpk(mean, def.usl, def.lsl, sigma) !== null ? round(calculateCpk(mean, def.usl, def.lsl, sigma)!) : null,
    };
  }

  // Quality check definition
  const def = await prisma.qualityCheckDefinition.findUnique({
    where: { id: definitionId },
    include: {
      results: {
        where: { timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
        include: { unit: { select: { serialNumber: true } } },
      },
    },
  });

  if (!def || def.results.length < 2) return null;

  const points: ControlChartPoint[] = [];
  const values: number[] = [];

  for (const result of def.results) {
    const valJson = result.valuesJson as Record<string, unknown>;
    const numVal = extractNumericValue(valJson);
    if (numVal !== null) {
      values.push(numVal);
      points.push({
        index: points.length,
        value: numVal,
        timestamp: result.timestamp.toISOString(),
        label: result.unit.serialNumber,
      });
    }
  }

  if (values.length < 2) return null;

  const { mean, sigma } = calculateStats(values);
  const params = def.parameters as Record<string, unknown>;
  const usl = extractNumber(params, ['usl', 'upperLimit', 'upper_limit', 'max']);
  const lsl = extractNumber(params, ['lsl', 'lowerLimit', 'lower_limit', 'min']);

  return {
    definitionId: def.id,
    checkName: def.name,
    sourceType: 'quality_check',
    points,
    mean: round(mean),
    sigma: round(sigma),
    ucl: round(mean + 3 * sigma),
    lcl: round(mean - 3 * sigma),
    usl,
    lsl,
    cp: usl !== null && lsl !== null ? (calculateCp(usl, lsl, sigma) !== null ? round(calculateCp(usl, lsl, sigma)!) : null) : null,
    cpk: usl !== null && lsl !== null ? (calculateCpk(mean, usl, lsl, sigma) !== null ? round(calculateCpk(mean, usl, lsl, sigma)!) : null) : null,
  };
}

// ============================================================================
// Drift Detection - Western Electric Rules
// ============================================================================

export async function detectDrift(
  definitionId: string,
  sourceType: 'quality_check' | 'ctq'
): Promise<DriftAlert[]> {
  await requireRole(['admin', 'supervisor']);

  const chartData = await getControlChartData(definitionId, sourceType, 30);
  if (!chartData || chartData.points.length < 8) return [];

  const { mean, sigma, points } = chartData;
  if (sigma === 0) return [];

  const alerts: DriftAlert[] = [];

  // Rule 1: One point beyond 3 sigma
  for (let i = 0; i < points.length; i++) {
    const z = Math.abs(points[i].value - mean) / sigma;
    if (z > 3) {
      alerts.push({
        rule: 'WE-1',
        ruleDescription: 'One point beyond 3 sigma',
        severity: 'critical',
        pointIndices: [i],
        message: `Point ${i + 1} (${points[i].label}) is ${z.toFixed(1)} sigma from mean`,
      });
    }
  }

  // Rule 2: 2 of 3 consecutive points beyond 2 sigma (same side)
  for (let i = 2; i < points.length; i++) {
    const window = [i - 2, i - 1, i];
    for (const side of [1, -1]) {
      const beyond2 = window.filter(
        (j) => side * (points[j].value - mean) > 2 * sigma
      );
      if (beyond2.length >= 2) {
        alerts.push({
          rule: 'WE-2',
          ruleDescription: '2 of 3 points beyond 2 sigma on same side',
          severity: 'warning',
          pointIndices: beyond2,
          message: `Points ${beyond2.map((j) => j + 1).join(', ')} are > 2 sigma ${side > 0 ? 'above' : 'below'} mean`,
        });
      }
    }
  }

  // Rule 3: 4 of 5 consecutive points beyond 1 sigma (same side)
  for (let i = 4; i < points.length; i++) {
    const window = [i - 4, i - 3, i - 2, i - 1, i];
    for (const side of [1, -1]) {
      const beyond1 = window.filter(
        (j) => side * (points[j].value - mean) > sigma
      );
      if (beyond1.length >= 4) {
        alerts.push({
          rule: 'WE-3',
          ruleDescription: '4 of 5 points beyond 1 sigma on same side',
          severity: 'warning',
          pointIndices: beyond1,
          message: `Points ${beyond1.map((j) => j + 1).join(', ')} are > 1 sigma ${side > 0 ? 'above' : 'below'} mean`,
        });
      }
    }
  }

  // Rule 4: 8 consecutive points on one side of center line
  for (let i = 7; i < points.length; i++) {
    const window = Array.from({ length: 8 }, (_, k) => i - 7 + k);
    const allAbove = window.every((j) => points[j].value > mean);
    const allBelow = window.every((j) => points[j].value < mean);
    if (allAbove || allBelow) {
      alerts.push({
        rule: 'WE-4',
        ruleDescription: '8 consecutive points on one side of center line',
        severity: 'warning',
        pointIndices: window,
        message: `Points ${window[0] + 1}-${window[7] + 1} all ${allAbove ? 'above' : 'below'} center line`,
      });
    }
  }

  // Deduplicate alerts by rule + overlapping point indices
  const unique: DriftAlert[] = [];
  for (const alert of alerts) {
    const key = `${alert.rule}-${alert.pointIndices.join(',')}`;
    if (!unique.find((u) => `${u.rule}-${u.pointIndices.join(',')}` === key)) {
      unique.push(alert);
    }
  }

  return unique;
}

// ============================================================================
// Utility: Extract numeric value from valuesJson
// ============================================================================

function extractNumericValue(json: Record<string, unknown>): number | null {
  // Try common field names
  for (const key of ['value', 'measured', 'measurement', 'reading', 'result']) {
    if (typeof json[key] === 'number') return json[key] as number;
  }
  // Try first numeric value in the object
  for (const val of Object.values(json)) {
    if (typeof val === 'number' && isFinite(val)) return val;
  }
  return null;
}

function extractNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (typeof obj[key] === 'number') return obj[key] as number;
  }
  return null;
}
