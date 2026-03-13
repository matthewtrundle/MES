import { z } from 'zod';

const ALL_ROLES = [
  'operator',
  'supervisor',
  'admin',
  'buyer',
  'receiving_mgr',
  'qa_inspector',
  'supply_chain_mgr',
  'shipping_coordinator',
] as const;

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, { error: 'Email is required' })
    .email({ error: 'Invalid email address' }),
  name: z
    .string()
    .min(1, { error: 'Name is required' })
    .max(100, { error: 'Name must be 100 characters or fewer' }),
  role: z.enum(ALL_ROLES, {
    error: 'Please select a valid role',
  }),
  assignedStationId: z.string().uuid().nullable().optional(),
  siteIds: z.array(z.string().uuid()).optional(),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, { error: 'Name is required' })
    .max(100, { error: 'Name must be 100 characters or fewer' })
    .optional(),
  role: z.enum(ALL_ROLES, {
    error: 'Please select a valid role',
  }).optional(),
  assignedStationId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

export const userFiltersSchema = z.object({
  role: z.enum(ALL_ROLES).optional(),
  active: z.boolean().optional(),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFiltersInput = z.infer<typeof userFiltersSchema>;
