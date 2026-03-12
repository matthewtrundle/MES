import { describe, it, expect } from 'vitest';
import {
  consumeMaterialSchema,
  createUnitSchema,
  createWorkOrderSchema,
  recordQualityCheckSchema,
  startDowntimeSchema,
  dispositionNCRSchema,
} from '@/lib/validation/schemas';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440002';

describe('Validation Schemas', () => {
  describe('consumeMaterialSchema', () => {
    const validData = {
      unitId: VALID_UUID,
      materialLotId: VALID_UUID_2,
      qtyConsumed: 5,
      stationId: VALID_UUID_3,
    };

    it('accepts valid data', () => {
      expect(() => consumeMaterialSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid UUID for unitId', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, unitId: 'not-a-uuid' })
      ).toThrow();
    });

    it('rejects invalid UUID for materialLotId', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, materialLotId: 'bad' })
      ).toThrow();
    });

    it('rejects invalid UUID for stationId', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, stationId: '' })
      ).toThrow();
    });

    it('rejects zero quantity', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, qtyConsumed: 0 })
      ).toThrow();
    });

    it('rejects negative quantity', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, qtyConsumed: -3 })
      ).toThrow();
    });

    it('accepts fractional positive quantity', () => {
      expect(() =>
        consumeMaterialSchema.parse({ ...validData, qtyConsumed: 0.5 })
      ).not.toThrow();
    });
  });

  describe('createUnitSchema', () => {
    it('accepts valid data with serial number', () => {
      const data = { workOrderId: VALID_UUID, serialNumber: 'SN-001' };
      expect(() => createUnitSchema.parse(data)).not.toThrow();
    });

    it('accepts valid data without serial number', () => {
      const data = { workOrderId: VALID_UUID };
      expect(() => createUnitSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid workOrderId', () => {
      expect(() =>
        createUnitSchema.parse({ workOrderId: 'bad-uuid' })
      ).toThrow();
    });

    it('rejects empty serial number', () => {
      expect(() =>
        createUnitSchema.parse({ workOrderId: VALID_UUID, serialNumber: '' })
      ).toThrow();
    });

    it('rejects serial number with special characters', () => {
      expect(() =>
        createUnitSchema.parse({ workOrderId: VALID_UUID, serialNumber: 'SN@#$!' })
      ).toThrow();
    });

    it('accepts serial number with hyphens and underscores', () => {
      expect(() =>
        createUnitSchema.parse({ workOrderId: VALID_UUID, serialNumber: 'SN-001_A' })
      ).not.toThrow();
    });
  });

  describe('createWorkOrderSchema', () => {
    const validData = {
      siteId: VALID_UUID,
      orderNumber: 'WO-2024-001',
      productCode: 'MOTOR-A',
      qtyOrdered: 10,
    };

    it('accepts valid data', () => {
      expect(() => createWorkOrderSchema.parse(validData)).not.toThrow();
    });

    it('accepts valid data with optional fields', () => {
      const data = {
        ...validData,
        productName: 'Motor Assembly A',
        routingId: VALID_UUID_2,
        priority: 50,
        dueDate: '2026-12-31',
      };
      expect(() => createWorkOrderSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid siteId', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, siteId: 'not-uuid' })
      ).toThrow();
    });

    it('rejects empty order number', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, orderNumber: '' })
      ).toThrow();
    });

    it('rejects empty product code', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, productCode: '' })
      ).toThrow();
    });

    it('rejects zero quantity ordered', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, qtyOrdered: 0 })
      ).toThrow();
    });

    it('rejects negative quantity ordered', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, qtyOrdered: -5 })
      ).toThrow();
    });

    it('rejects fractional quantity ordered', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, qtyOrdered: 1.5 })
      ).toThrow();
    });

    it('rejects priority above 100', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, priority: 101 })
      ).toThrow();
    });

    it('rejects negative priority', () => {
      expect(() =>
        createWorkOrderSchema.parse({ ...validData, priority: -1 })
      ).toThrow();
    });
  });

  describe('recordQualityCheckSchema', () => {
    const validData = {
      unitId: VALID_UUID,
      definitionId: VALID_UUID_2,
      result: 'pass' as const,
      values: { torque: 25.5, alignment: 'ok' },
    };

    it('accepts valid pass result', () => {
      expect(() => recordQualityCheckSchema.parse(validData)).not.toThrow();
    });

    it('accepts valid fail result', () => {
      expect(() =>
        recordQualityCheckSchema.parse({ ...validData, result: 'fail' })
      ).not.toThrow();
    });

    it('rejects invalid result value', () => {
      expect(() =>
        recordQualityCheckSchema.parse({ ...validData, result: 'unknown' })
      ).toThrow();
    });

    it('rejects invalid unitId', () => {
      expect(() =>
        recordQualityCheckSchema.parse({ ...validData, unitId: 'bad' })
      ).toThrow();
    });

    it('rejects invalid definitionId', () => {
      expect(() =>
        recordQualityCheckSchema.parse({ ...validData, definitionId: '' })
      ).toThrow();
    });

    it('accepts empty values object', () => {
      expect(() =>
        recordQualityCheckSchema.parse({ ...validData, values: {} })
      ).not.toThrow();
    });
  });

  describe('startDowntimeSchema', () => {
    it('accepts valid data with notes', () => {
      const data = { stationId: VALID_UUID, notes: 'Machine jam' };
      expect(() => startDowntimeSchema.parse(data)).not.toThrow();
    });

    it('accepts valid data without notes', () => {
      const data = { stationId: VALID_UUID };
      expect(() => startDowntimeSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid stationId', () => {
      expect(() =>
        startDowntimeSchema.parse({ stationId: 'not-a-uuid' })
      ).toThrow();
    });

    it('rejects notes exceeding max length', () => {
      const data = { stationId: VALID_UUID, notes: 'x'.repeat(1001) };
      expect(() => startDowntimeSchema.parse(data)).toThrow();
    });

    it('accepts notes at max length', () => {
      const data = { stationId: VALID_UUID, notes: 'x'.repeat(1000) };
      expect(() => startDowntimeSchema.parse(data)).not.toThrow();
    });
  });

  describe('dispositionNCRSchema', () => {
    it('accepts valid rework disposition', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: VALID_UUID, disposition: 'rework' })
      ).not.toThrow();
    });

    it('accepts valid scrap disposition', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: VALID_UUID, disposition: 'scrap' })
      ).not.toThrow();
    });

    it('accepts valid use_as_is disposition', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: VALID_UUID, disposition: 'use_as_is' })
      ).not.toThrow();
    });

    it('accepts valid defer disposition', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: VALID_UUID, disposition: 'defer' })
      ).not.toThrow();
    });

    it('rejects invalid disposition', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: VALID_UUID, disposition: 'reject' })
      ).toThrow();
    });

    it('rejects invalid ncrId', () => {
      expect(() =>
        dispositionNCRSchema.parse({ ncrId: 'bad', disposition: 'scrap' })
      ).toThrow();
    });
  });
});
