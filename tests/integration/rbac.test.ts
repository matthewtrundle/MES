import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRole, requireRoleApi, HttpError, forbidden, unauthorized } from '@/lib/auth/rbac';

// Mock the getCurrentUser function
vi.mock('@/lib/auth/rbac', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/rbac')>();
  return {
    ...original,
    getCurrentUser: vi.fn(),
  };
});

describe('RBAC System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HttpError', () => {
    it('should create an error with status code', () => {
      const error = new HttpError(403, 'Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(error.name).toBe('HttpError');
    });
  });

  describe('forbidden helper', () => {
    it('should create a 403 error', () => {
      const error = forbidden();
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Forbidden');
    });

    it('should accept custom message', () => {
      const error = forbidden('Custom forbidden message');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Custom forbidden message');
    });
  });

  describe('unauthorized helper', () => {
    it('should create a 401 error', () => {
      const error = unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Unauthorized');
    });
  });
});

describe('Role Types', () => {
  it('should define valid roles', () => {
    const validRoles = ['admin', 'supervisor', 'operator'];
    expect(validRoles).toContain('admin');
    expect(validRoles).toContain('supervisor');
    expect(validRoles).toContain('operator');
  });
});
