/**
 * Role constants and display helpers.
 * This file has NO server-side imports (no Prisma, no DB),
 * so it is safe to import from client components.
 */

export type AppRole =
  | 'operator'
  | 'supervisor'
  | 'admin'
  | 'buyer'
  | 'receiving_mgr'
  | 'qa_inspector'
  | 'supply_chain_mgr'
  | 'shipping_coordinator';

export const ALL_ROLES: AppRole[] = [
  'admin',
  'supervisor',
  'operator',
  'buyer',
  'receiving_mgr',
  'qa_inspector',
  'supply_chain_mgr',
  'shipping_coordinator',
];

/**
 * Permission-based access control map
 */
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: ['*'],
  supervisor: [
    'production:read', 'production:write',
    'quality:read', 'quality:write',
    'ncr:disposition',
    'inventory:read',
    'reports:read',
  ],
  operator: ['production:read', 'production:write', 'quality:read'],
  buyer: [
    'purchase_orders:read', 'purchase_orders:write',
    'suppliers:read', 'suppliers:write',
    'inventory:read',
  ],
  receiving_mgr: [
    'receiving:read', 'receiving:write',
    'inventory:read', 'inventory:write',
    'purchase_orders:read',
  ],
  qa_inspector: [
    'quality:read', 'quality:write',
    'iqc:read', 'iqc:write',
    'ncr:read',
  ],
  supply_chain_mgr: [
    'inventory:read', 'inventory:write',
    'purchase_orders:read',
    'suppliers:read',
    'reports:read',
  ],
  shipping_coordinator: [
    'shipping:read', 'shipping:write',
    'production:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AppRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const displayNames: Record<string, string> = {
    operator: 'Operator',
    supervisor: 'Supervisor',
    admin: 'Administrator',
    buyer: 'Buyer',
    receiving_mgr: 'Receiving Manager',
    qa_inspector: 'QA Inspector',
    supply_chain_mgr: 'Supply Chain Manager',
    shipping_coordinator: 'Shipping Coordinator',
  };
  return displayNames[role] ?? role;
}
