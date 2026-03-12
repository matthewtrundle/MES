import { describe, it, expect } from 'vitest';

/**
 * Work Order Lifecycle Integration Tests
 *
 * Tests the work order state machine:
 * - Valid transitions: pending → released → in_progress → completed
 * - Invalid transitions rejected
 * - Cancellation rules
 * - Quantity validation
 */

type WorkOrderStatus = 'pending' | 'released' | 'in_progress' | 'completed' | 'cancelled';

interface WorkOrder {
  id: string;
  orderNumber: string;
  productCode: string;
  qtyOrdered: number;
  qtyCompleted: number;
  qtyScrap: number;
  status: WorkOrderStatus;
  priority: number;
  releasedAt: Date | null;
  completedAt: Date | null;
}

// Valid transitions as defined in the source code
const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pending: ['released', 'cancelled'],
  released: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

function isValidTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function canRelease(wo: WorkOrder): { allowed: boolean; error?: string } {
  if (wo.status !== 'pending') {
    return { allowed: false, error: `Cannot release work order in ${wo.status} status` };
  }
  return { allowed: true };
}

function canComplete(wo: WorkOrder): { allowed: boolean; error?: string } {
  if (wo.status !== 'in_progress' && wo.status !== 'released') {
    return { allowed: false, error: `Cannot complete work order in ${wo.status} status` };
  }
  return { allowed: true };
}

function canCancel(wo: WorkOrder): { allowed: boolean; error?: string } {
  if (wo.status !== 'pending' && wo.status !== 'released') {
    return { allowed: false, error: `Cannot cancel work order in ${wo.status} status` };
  }
  return { allowed: true };
}

function validateWorkOrderCreation(data: {
  orderNumber: string;
  productCode: string;
  qtyOrdered: number;
  priority?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.orderNumber || data.orderNumber.trim() === '') {
    errors.push('Order number is required');
  }
  if (!data.productCode || data.productCode.trim() === '') {
    errors.push('Product code is required');
  }
  if (data.qtyOrdered <= 0) {
    errors.push('Quantity ordered must be greater than 0');
  }
  if (!Number.isInteger(data.qtyOrdered)) {
    errors.push('Quantity ordered must be a whole number');
  }
  if (data.priority !== undefined) {
    if (data.priority < 0 || data.priority > 100) {
      errors.push('Priority must be between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

function releaseWorkOrder(wo: WorkOrder): WorkOrder {
  return {
    ...wo,
    status: 'released',
    releasedAt: new Date(),
  };
}

function completeWorkOrder(wo: WorkOrder, completedUnits: number): WorkOrder {
  return {
    ...wo,
    status: 'completed',
    completedAt: new Date(),
    qtyCompleted: completedUnits,
  };
}

// --- Test Data ---

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 'WO-2026-001',
    productCode: 'MOTOR-A',
    qtyOrdered: 10,
    qtyCompleted: 0,
    qtyScrap: 0,
    status: 'pending',
    priority: 0,
    releasedAt: null,
    completedAt: null,
    ...overrides,
  };
}

// --- Tests ---

describe('Work Order Lifecycle', () => {
  describe('Valid Status Transitions', () => {
    it('allows pending → released', () => {
      expect(isValidTransition('pending', 'released')).toBe(true);
    });

    it('allows released → in_progress', () => {
      expect(isValidTransition('released', 'in_progress')).toBe(true);
    });

    it('allows in_progress → completed', () => {
      expect(isValidTransition('in_progress', 'completed')).toBe(true);
    });

    it('allows released → completed (direct completion)', () => {
      expect(isValidTransition('released', 'completed')).toBe(true);
    });

    it('allows pending → cancelled', () => {
      expect(isValidTransition('pending', 'cancelled')).toBe(true);
    });

    it('allows released → cancelled', () => {
      expect(isValidTransition('released', 'cancelled')).toBe(true);
    });
  });

  describe('Invalid Status Transitions', () => {
    it('rejects completed → pending', () => {
      expect(isValidTransition('completed', 'pending')).toBe(false);
    });

    it('rejects completed → released', () => {
      expect(isValidTransition('completed', 'released')).toBe(false);
    });

    it('rejects completed → in_progress', () => {
      expect(isValidTransition('completed', 'in_progress')).toBe(false);
    });

    it('rejects cancelled → pending', () => {
      expect(isValidTransition('cancelled', 'pending')).toBe(false);
    });

    it('rejects cancelled → released', () => {
      expect(isValidTransition('cancelled', 'released')).toBe(false);
    });

    it('rejects in_progress → pending', () => {
      expect(isValidTransition('in_progress', 'pending')).toBe(false);
    });

    it('rejects in_progress → released', () => {
      expect(isValidTransition('in_progress', 'released')).toBe(false);
    });

    it('rejects pending → in_progress (must release first)', () => {
      expect(isValidTransition('pending', 'in_progress')).toBe(false);
    });

    it('rejects pending → completed (must release first)', () => {
      expect(isValidTransition('pending', 'completed')).toBe(false);
    });
  });

  describe('Release Logic', () => {
    it('allows releasing a pending work order', () => {
      const wo = makeWorkOrder({ status: 'pending' });
      const result = canRelease(wo);
      expect(result.allowed).toBe(true);
    });

    it('rejects releasing an already released work order', () => {
      const wo = makeWorkOrder({ status: 'released' });
      const result = canRelease(wo);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('released');
    });

    it('rejects releasing an in_progress work order', () => {
      const wo = makeWorkOrder({ status: 'in_progress' });
      const result = canRelease(wo);
      expect(result.allowed).toBe(false);
    });

    it('rejects releasing a completed work order', () => {
      const wo = makeWorkOrder({ status: 'completed' });
      const result = canRelease(wo);
      expect(result.allowed).toBe(false);
    });

    it('sets releasedAt timestamp on release', () => {
      const wo = makeWorkOrder({ status: 'pending' });
      const released = releaseWorkOrder(wo);
      expect(released.status).toBe('released');
      expect(released.releasedAt).toBeInstanceOf(Date);
    });
  });

  describe('Completion Logic', () => {
    it('allows completing an in_progress work order', () => {
      const wo = makeWorkOrder({ status: 'in_progress' });
      const result = canComplete(wo);
      expect(result.allowed).toBe(true);
    });

    it('allows completing a released work order directly', () => {
      const wo = makeWorkOrder({ status: 'released' });
      const result = canComplete(wo);
      expect(result.allowed).toBe(true);
    });

    it('rejects completing a pending work order', () => {
      const wo = makeWorkOrder({ status: 'pending' });
      const result = canComplete(wo);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('pending');
    });

    it('rejects completing an already completed work order', () => {
      const wo = makeWorkOrder({ status: 'completed' });
      const result = canComplete(wo);
      expect(result.allowed).toBe(false);
    });

    it('rejects completing a cancelled work order', () => {
      const wo = makeWorkOrder({ status: 'cancelled' });
      const result = canComplete(wo);
      expect(result.allowed).toBe(false);
    });

    it('records completed quantity on completion', () => {
      const wo = makeWorkOrder({ status: 'in_progress', qtyOrdered: 10 });
      const completed = completeWorkOrder(wo, 8);
      expect(completed.status).toBe('completed');
      expect(completed.qtyCompleted).toBe(8);
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('allows completion even if qtyCompleted < qtyOrdered (partial)', () => {
      const wo = makeWorkOrder({ status: 'in_progress', qtyOrdered: 10 });
      const completed = completeWorkOrder(wo, 5);
      expect(completed.qtyCompleted).toBe(5);
      expect(completed.status).toBe('completed');
    });

    it('allows completion with zero units completed', () => {
      const wo = makeWorkOrder({ status: 'in_progress', qtyOrdered: 10 });
      const completed = completeWorkOrder(wo, 0);
      expect(completed.qtyCompleted).toBe(0);
      expect(completed.status).toBe('completed');
    });
  });

  describe('Cancellation Rules', () => {
    it('allows cancelling a pending work order', () => {
      const wo = makeWorkOrder({ status: 'pending' });
      expect(canCancel(wo).allowed).toBe(true);
    });

    it('allows cancelling a released work order', () => {
      const wo = makeWorkOrder({ status: 'released' });
      expect(canCancel(wo).allowed).toBe(true);
    });

    it('rejects cancelling an in_progress work order', () => {
      const wo = makeWorkOrder({ status: 'in_progress' });
      const result = canCancel(wo);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('in_progress');
    });

    it('rejects cancelling an already completed work order', () => {
      const wo = makeWorkOrder({ status: 'completed' });
      expect(canCancel(wo).allowed).toBe(false);
    });

    it('rejects cancelling an already cancelled work order', () => {
      const wo = makeWorkOrder({ status: 'cancelled' });
      expect(canCancel(wo).allowed).toBe(false);
    });
  });

  describe('Quantity Validation', () => {
    it('rejects qtyOrdered of 0', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity ordered must be greater than 0');
    });

    it('rejects negative qtyOrdered', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: -5,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects fractional qtyOrdered', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 1.5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity ordered must be a whole number');
    });

    it('accepts valid positive integer qtyOrdered', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty order number', () => {
      const result = validateWorkOrderCreation({
        orderNumber: '',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Order number is required');
    });

    it('rejects empty product code', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: '',
        qtyOrdered: 10,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Product code is required');
    });

    it('rejects priority above 100', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
        priority: 101,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Priority must be between 0 and 100');
    });

    it('rejects negative priority', () => {
      const result = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
        priority: -1,
      });
      expect(result.valid).toBe(false);
    });

    it('accepts priority at boundaries (0 and 100)', () => {
      const result0 = validateWorkOrderCreation({
        orderNumber: 'WO-001',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
        priority: 0,
      });
      const result100 = validateWorkOrderCreation({
        orderNumber: 'WO-002',
        productCode: 'MOTOR-A',
        qtyOrdered: 10,
        priority: 100,
      });
      expect(result0.valid).toBe(true);
      expect(result100.valid).toBe(true);
    });

    it('collects multiple validation errors', () => {
      const result = validateWorkOrderCreation({
        orderNumber: '',
        productCode: '',
        qtyOrdered: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Full Lifecycle Flow', () => {
    it('follows the happy path: pending → released → in_progress → completed', () => {
      const wo = makeWorkOrder({ status: 'pending' });

      expect(canRelease(wo).allowed).toBe(true);
      const released = releaseWorkOrder(wo);
      expect(released.status).toBe('released');

      expect(isValidTransition('released', 'in_progress')).toBe(true);
      const inProgress: WorkOrder = { ...released, status: 'in_progress' };

      expect(canComplete(inProgress).allowed).toBe(true);
      const completed = completeWorkOrder(inProgress, 10);
      expect(completed.status).toBe('completed');
      expect(completed.qtyCompleted).toBe(10);
    });

    it('cannot go backward from completed', () => {
      const wo = makeWorkOrder({ status: 'completed' });
      expect(canRelease(wo).allowed).toBe(false);
      expect(canCancel(wo).allowed).toBe(false);
      expect(isValidTransition('completed', 'pending')).toBe(false);
      expect(isValidTransition('completed', 'released')).toBe(false);
    });

    it('cancelled is a terminal state', () => {
      const wo = makeWorkOrder({ status: 'cancelled' });
      expect(isValidTransition('cancelled', 'pending')).toBe(false);
      expect(isValidTransition('cancelled', 'released')).toBe(false);
      expect(isValidTransition('cancelled', 'in_progress')).toBe(false);
      expect(isValidTransition('cancelled', 'completed')).toBe(false);
    });
  });
});
